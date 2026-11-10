const { z } = require('zod');
const listsService = require('../../services/lists');
const { sanitizeForOwner } = require('../../services/sanitize');
const { toPlain, pick, personRef, formatItem } = require('../format');

const listId = z.string().describe('List ID, from list_my_lists or list_shared_with_me');

function summarizeOwnList(list, viewerId) {
  const safe = toPlain(sanitizeForOwner(list, viewerId));
  return {
    ...pick(safe, ['id', 'name', 'description', 'event_date', 'createdAt', 'isArchived']),
    itemCount: (safe.items || []).length,
    sharedWithCount: (safe.sharedWith || []).length
  };
}

module.exports = [
  {
    name: 'list_my_lists',
    title: 'List my wishlists',
    description: 'List the wishlists the user owns, newest first, with IDs to pass to get_list and other tools. '
      + 'Does not include lists other people shared with the user (use list_shared_with_me).',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    inputSchema: {},
    async handler(_args, ctx) {
      const lists = await listsService.listLists({ userId: ctx.userId });
      const summaries = lists.map(l => summarizeOwnList(l, ctx.userId));
      const text = summaries.length
        ? summaries.map(l => `- ${l.name} (id ${l.id}, ${l.itemCount} items)`).join('\n')
        : 'You have no wishlists yet.';
      return { text, data: { lists: summaries } };
    }
  },
  {
    name: 'get_list',
    title: 'Get wishlist',
    description: 'Get one wishlist and its items. Works for lists the user owns and lists shared with them. '
      + 'For lists shared with the user, each item shows who claimed it. For the user\'s own lists, claim '
      + 'information is hidden by design so gifts stay a surprise.',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    inputSchema: { listId },
    async handler({ listId: id }, ctx) {
      const payload = sanitizeForOwner(
        await listsService.getList({ userId: ctx.userId, listId: id }),
        ctx.userId
      );
      const isOwner = !payload.isShared;
      const list = toPlain(payload.list);
      const items = payload.items.map(item =>
        formatItem(item, { viewerId: ctx.userId, includeClaims: !isOwner }));

      const data = {
        list: {
          ...pick(list, ['id', 'name', 'description', 'event_date', 'mailingAddress', 'createdAt', 'isArchived']),
          owner: personRef(list.user)
        },
        isOwner,
        items
      };
      const lines = items.map(i => {
        const claimed = isOwner ? '' : (i.claimedByMe ? ' [claimed by you]' : (i.claimedQuantity ? ' [claimed]' : ''));
        return `- ${i.title} (id ${i.id})${claimed}`;
      });
      const text = `${data.list.name}: ${items.length} item(s)${isOwner ? ' (your list: who bought what is hidden by design)' : ''}\n${lines.join('\n')}`;
      return { text, data, wishlistId: data.list.id };
    }
  }
];
