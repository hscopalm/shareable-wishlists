const { z } = require('zod');
const claimsService = require('../../services/claims');
const { formatItem, toPlain } = require('../format');

module.exports = [
  {
    name: 'claim_item',
    title: 'Claim item',
    description: 'Claim an item on a wishlist someone shared with the user, so other gift givers know it is taken. '
      + 'Get listId from list_shared_with_me and itemId from get_list. For items with a quantity above 1, '
      + 'quantity sets how many the user is buying (their claim becomes exactly that number). '
      + 'Calling it again on an item the user already claimed is a no-op. Owners cannot claim on their own lists.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    inputSchema: {
      listId: z.string().describe('ID of a list shared with the user, from list_shared_with_me'),
      itemId: z.string().describe('Item ID from get_list'),
      quantity: z.number().int().min(1).optional()
        .describe('How many to claim, for items with a quantity above 1. Defaults to 1.')
    },
    async handler({ listId, itemId, quantity }, ctx) {
      const item = await claimsService.claimItem({
        userId: ctx.userId,
        listId,
        itemId,
        // Always pass an explicit quantity: with none the service toggles,
        // which would unclaim on a repeated call.
        quantity: quantity || 1
      });
      const data = { item: formatItem(item, { viewerId: ctx.userId, includeClaims: true }) };
      const mine = data.item.claims.find(c => c.byMe);
      const text = `Claimed "${data.item.title}"${mine && mine.quantity > 1 ? ` x${mine.quantity}` : ''}.`;
      return { text, data, wishlistId: listId };
    }
  },
  {
    name: 'unclaim_item',
    title: 'Unclaim item',
    description: 'Remove the user\'s claim from an item on a list shared with them, so others can claim it. '
      + 'Does nothing if the user has no claim on it. Get listId from list_shared_with_me and itemId from get_list.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    inputSchema: {
      listId: z.string().describe('ID of a list shared with the user, from list_shared_with_me'),
      itemId: z.string().describe('Item ID from get_list')
    },
    async handler({ listId, itemId }, ctx) {
      const item = await claimsService.claimItem({ userId: ctx.userId, listId, itemId, quantity: 0 });
      const data = { item: formatItem(item, { viewerId: ctx.userId, includeClaims: true }) };
      return { text: `Removed your claim on "${data.item.title}".`, data, wishlistId: listId };
    }
  },
  {
    name: 'get_my_claims',
    title: 'Get my claims',
    description: 'List every item the user has claimed on lists shared with them, grouped by list with the list owner. '
      + 'Use it to answer "what am I buying for whom". Lists no longer shared with the user are left out.',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    inputSchema: {},
    async handler(_args, ctx) {
      const lists = toPlain(await claimsService.getMyClaims({ userId: ctx.userId }));
      const text = lists.length
        ? lists.map(l => `${l.listName} (${l.owner.name || 'someone'}, list id ${l.listId}):\n`
          + l.items.map(i => `- ${i.title} (id ${i.id})${i.myQuantity > 1 ? ` x${i.myQuantity}` : ''}`).join('\n')).join('\n')
        : 'You have not claimed anything yet.';
      return { text, data: { lists } };
    }
  }
];
