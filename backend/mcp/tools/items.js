const { z } = require('zod');
const itemsService = require('../../services/items');
const { formatItem } = require('../format');

const itemFields = {
  title: z.string().min(1).describe('Item name'),
  description: z.string().optional().describe('Longer description'),
  link: z.string().optional().describe('URL where the item can be bought'),
  imageUrl: z.string().optional().describe('URL of a picture of the item'),
  notes: z.string().optional().describe('Notes for gift givers, such as size or colour'),
  price: z.number().min(0).optional().describe('Approximate price'),
  priority: z.number().int().min(1).max(5).optional().describe('How much the user wants it, 1 (low) to 5 (high)'),
  quantity: z.number().int().min(1).optional()
    .describe('How many the user wants. Above 1, several people can each claim part of it. Gift items only.'),
  paymentLinks: z.object({
    venmo: z.string().optional(),
    paypal: z.string().optional(),
    cashapp: z.string().optional()
  }).optional().describe('Cash items only: payment handles (venmo, paypal, cashapp). At least one is required for cash items.')
};

function defined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

// Owners never see claim data, so the service result is formatted without
// claims and the service's warning text (which mentions claims) is dropped.
function ownerItem(item, ctx) {
  return formatItem(item, { viewerId: ctx.userId, includeClaims: false });
}

module.exports = [
  {
    name: 'add_item',
    title: 'Add item',
    description: 'Add an item to a list the user owns. Get listId from list_my_lists. Use type "gift" (default) for a '
      + 'product, or type "cash" for a cash fund (needs paymentLinks, ignores price, link, priority and quantity).',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    inputSchema: {
      listId: z.string().describe('ID of a list the user owns, from list_my_lists'),
      type: z.enum(['gift', 'cash']).optional().describe('"gift" (default) or "cash"'),
      ...itemFields
    },
    async handler({ listId, ...fields }, ctx) {
      const item = await itemsService.createItem({ userId: ctx.userId, listId, data: defined(fields) });
      const data = { item: ownerItem(item, ctx) };
      return { text: `Added "${data.item.title}" (id ${data.item.id}).`, data, wishlistId: listId };
    }
  },
  {
    name: 'update_item',
    title: 'Update item',
    description: 'Change fields of an item on a list the user owns. Only the fields you pass are changed. '
      + 'Get itemId from get_list. The type of an item cannot be changed.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    inputSchema: {
      itemId: z.string().describe('Item ID from get_list'),
      ...Object.fromEntries(Object.entries(itemFields).map(([k, v]) => [k, v.optional()]))
    },
    async handler({ itemId, ...fields }, ctx) {
      const item = await itemsService.updateItem({ userId: ctx.userId, itemId, data: defined(fields) });
      const data = { item: ownerItem(item, ctx) };
      return { text: `Updated "${data.item.title}".`, data };
    }
  },
  {
    name: 'delete_item',
    title: 'Delete item',
    description: 'Permanently remove an item from a list the user owns. This cannot be undone. '
      + 'Confirm with the user first. Get itemId from get_list.',
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    inputSchema: { itemId: z.string().describe('Item ID from get_list') },
    async handler({ itemId }, ctx) {
      await itemsService.deleteItem({ userId: ctx.userId, itemId });
      return { text: 'Item deleted.', data: { deleted: true, itemId } };
    }
  }
];
