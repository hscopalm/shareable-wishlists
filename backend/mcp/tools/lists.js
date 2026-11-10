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

const listFields = {
  name: z.string().min(1).describe('List name, for example "Birthday 2026"'),
  description: z.string().optional().describe('Short description of the list'),
  event_date: z.string().optional().describe('Event date as YYYY-MM-DD, for example the birthday'),
  mailingAddress: z.object({
    recipientName: z.string().optional(),
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional()
  }).optional().describe('Where gifts can be sent (recipientName, line1, line2, city, state, postalCode, country)')
};

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
  },
  {
    name: 'create_list',
    title: 'Create wishlist',
    description: 'Create a new empty wishlist owned by the user. Returns the list with its ID; use add_item to fill it '
      + 'and share_list or create_invite_link to share it.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    inputSchema: listFields,
    async handler(args, ctx) {
      const list = await listsService.createList({ userId: ctx.userId, ...args });
      const summary = summarizeOwnList(list, ctx.userId);
      return { text: `Created list "${summary.name}" (id ${summary.id}).`, data: { list: summary }, wishlistId: summary.id };
    }
  },
  {
    name: 'update_list',
    title: 'Update wishlist',
    description: 'Change the name, description, event date or mailing address of a list the user owns. '
      + 'Only the fields you pass are changed. Get listId from list_my_lists.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    inputSchema: {
      listId: z.string().describe('ID of a list the user owns, from list_my_lists'),
      ...Object.fromEntries(Object.entries(listFields).map(([k, v]) => [k, v.optional()]))
    },
    async handler({ listId: id, ...changes }, ctx) {
      // The service replaces every field, so start from the current values.
      const { list: current } = await listsService.getList({ userId: ctx.userId, listId: id });
      const merged = {
        name: current.name,
        description: current.description,
        event_date: current.event_date,
        mailingAddress: current.mailingAddress
      };
      for (const [k, v] of Object.entries(changes)) if (v !== undefined) merged[k] = v;
      const list = await listsService.updateList({ userId: ctx.userId, listId: id, ...merged });
      const summary = summarizeOwnList(list, ctx.userId);
      return { text: `Updated list "${summary.name}".`, data: { list: summary }, wishlistId: summary.id };
    }
  },
  {
    name: 'delete_list',
    title: 'Delete wishlist',
    description: 'Permanently delete a list the user owns, including all its items and claims. This cannot be undone. '
      + 'Confirm with the user first. Get listId from list_my_lists.',
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    inputSchema: { listId: z.string().describe('ID of a list the user owns, from list_my_lists') },
    async handler({ listId: id }, ctx) {
      await listsService.deleteList({ userId: ctx.userId, listId: id });
      return { text: 'List deleted.', data: { deleted: true, listId: id }, wishlistId: id };
    }
  }
];
