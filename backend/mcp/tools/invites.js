const { z } = require('zod');
const invitesService = require('../../services/invites');
const { ValidationError } = require('../../services/errors');

const listId = z.string().describe('ID of a list the user owns, from list_my_lists');

// Accepts a full invite URL (https://host/invite/<token>) or the bare token.
function parseInviteToken(input) {
  const text = String(input || '').trim();
  const match = text.match(/\/invite\/([^/?#\s]+)/);
  const token = match ? match[1] : text;
  if (!token || /[\s/]/.test(token)) throw new ValidationError('Invalid invite link');
  return token;
}

module.exports = [
  {
    name: 'get_invite_link',
    title: 'Get invite link',
    description: 'Get the current invite link of a list the user owns, whether it is enabled, and whether anonymous '
      + 'claims are allowed. The link is null if none was created yet (use create_invite_link). '
      + 'Requires the full wishlists scope because the link grants access to the list.',
    // Not read-only: the live token is a capability grant, so read-only tokens must not see it.
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    inputSchema: { listId },
    async handler({ listId: id }, ctx) {
      const info = await invitesService.getInviteLink({ userId: ctx.userId, listId: id });
      const text = info.link
        ? `Invite link (${info.enabled ? 'enabled' : 'disabled'}): ${info.link}`
        : 'No invite link has been created for this list.';
      return { text, data: info, wishlistId: id };
    }
  },
  {
    name: 'create_invite_link',
    title: 'Create invite link',
    description: 'Create an invite link for a list the user owns and enable it. Anyone with the link can join the list. '
      + 'If a link already exists this invalidates the previous link, so people holding the old one lose access to '
      + 'it. Confirm with the user first if a link exists.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    inputSchema: { listId },
    async handler({ listId: id }, ctx) {
      const info = await invitesService.createInviteLink({ userId: ctx.userId, listId: id });
      return { text: `New invite link: ${info.link} (any previous link no longer works).`, data: info, wishlistId: id };
    }
  },
  {
    name: 'disable_invite_link',
    title: 'Disable invite link',
    description: 'Turn off the invite link of a list the user owns so nobody new can join with it. '
      + 'People who already joined keep access.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    inputSchema: { listId },
    async handler({ listId: id }, ctx) {
      await invitesService.disableInviteLink({ userId: ctx.userId, listId: id });
      return { text: 'Invite link disabled.', data: { enabled: false }, wishlistId: id };
    }
  },
  {
    name: 'set_anonymous_claims',
    title: 'Allow anonymous claims',
    description: 'Choose whether visitors who open the invite link without signing in may claim items by name. '
      + 'Applies to a list the user owns.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    inputSchema: {
      listId,
      allow: z.boolean().describe('true to allow anonymous claims, false to require sign-in')
    },
    async handler({ listId: id, allow }, ctx) {
      const info = await invitesService.setAnonymousClaims({ userId: ctx.userId, listId: id, allow });
      return { text: `Anonymous claims ${info.allowAnonymousClaims ? 'allowed' : 'not allowed'}.`, data: info, wishlistId: id };
    }
  },
  {
    name: 'join_via_invite_link',
    title: 'Join list via invite link',
    description: 'Join a list someone else invited the user to, using the invite link they sent. '
      + 'Accepts the full URL (https://.../invite/<token>) or just the token. Afterwards the list appears in '
      + 'list_shared_with_me.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    inputSchema: { link: z.string().describe('The full invite URL or the bare invite token') },
    async handler({ link }, ctx) {
      const token = parseInviteToken(link);
      const res = await invitesService.joinInvite({ token, userId: ctx.userId });
      const listId = String(res.listId);
      return { text: 'Joined the list.', data: { listId }, wishlistId: listId };
    }
  }
];
