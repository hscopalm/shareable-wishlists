const { z } = require('zod');
const sharingService = require('../../services/sharing');
const { ServiceError } = require('../../services/errors');
const { getMcpConfig } = require('../config');
const { toPlain, pick, personRef } = require('../format');

const listId = z.string().describe('ID of a list the user owns, from list_my_lists');

// share_list calls per user in the last hour. In memory, so per ECS task
// (same caveat as the HTTP rate limit).
const HOUR_MS = 60 * 60 * 1000;
const shareCalls = new Map();

function checkShareLimit(userId) {
  const { shareLimitPerHour } = getMcpConfig();
  const now = Date.now();
  const recent = (shareCalls.get(userId) || []).filter(t => now - t < HOUR_MS);
  if (recent.length >= shareLimitPerHour) {
    shareCalls.set(userId, recent);
    throw new ServiceError(429, `Share limit reached (${shareLimitPerHour} per hour). Try again later.`);
  }
  recent.push(now);
  shareCalls.set(userId, recent);
}

module.exports = [
  {
    name: 'share_list',
    title: 'Share wishlist',
    description: 'Share a list the user owns with someone by email. They can then view it and claim items. '
      + 'Unknown emails get an account placeholder that activates when they sign up. By default Gift Guru emails '
      + 'them an invitation; pass notify false to share silently. Confirm the address with the user first. '
      + 'Limited to 20 shares per hour.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    inputSchema: {
      listId,
      email: z.string().describe('Email address of the person to share with'),
      notify: z.boolean().optional().describe('Send the invitation email. Defaults to true.')
    },
    async handler({ listId: id, email, notify }, ctx) {
      checkShareLimit(ctx.userId);
      const user = await sharingService.shareList({
        userId: ctx.userId, listId: id, email, notify: notify !== false
      });
      const data = { sharedWith: toPlain(user) };
      return { text: `Shared the list with ${data.sharedWith.email}.`, data, wishlistId: id };
    }
  },
  {
    name: 'list_shared_users',
    title: 'List people a list is shared with',
    description: 'List the people a list the user owns is shared with, including when each last viewed it. '
      + 'The userId values can be passed to unshare_list.',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    inputSchema: { listId },
    async handler({ listId: id }, ctx) {
      const users = toPlain(await sharingService.listSharedWith({ userId: ctx.userId, listId: id }));
      const text = users.length
        ? users.map(u => `- ${u.name || u.email} <${u.email}> (userId ${u.id})${u.isPending ? ' [not signed up yet]' : ''}`).join('\n')
        : 'This list is not shared with anyone.';
      return { text, data: { users }, wishlistId: id };
    }
  },
  {
    name: 'unshare_list',
    title: 'Stop sharing wishlist',
    description: 'Remove someone\'s access to a list the user owns. Their existing claims stay in place. '
      + 'Confirm with the user first. Get userId from list_shared_users.',
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    inputSchema: {
      listId,
      userId: z.string().describe('ID of the person to remove, from list_shared_users')
    },
    async handler({ listId: id, userId }, ctx) {
      await sharingService.unshareList({ userId: ctx.userId, listId: id, targetUserId: userId });
      return { text: 'Removed that person from the list.', data: { removed: true, userId }, wishlistId: id };
    }
  },
  {
    name: 'list_shared_with_me',
    title: 'List wishlists shared with me',
    description: 'List wishlists other people shared with the user, with IDs to pass to get_list and claim_item.',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    inputSchema: {},
    async handler(_args, ctx) {
      const lists = toPlain(await sharingService.listSharedWithMe({ userId: ctx.userId })).map(l => ({
        ...pick(l, ['id', 'name', 'description', 'event_date', 'isArchived']),
        owner: personRef(l.owner),
        itemCount: l.items.length
      }));
      const text = lists.length
        ? lists.map(l => `- ${l.name} by ${(l.owner && l.owner.name) || 'someone'} (id ${l.id}, ${l.itemCount} items)`).join('\n')
        : 'Nobody has shared a list with you yet.';
      return { text, data: { lists } };
    }
  }
];
