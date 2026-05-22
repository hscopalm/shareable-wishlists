// Custom Jest matchers used across the integration test suite.
//
// Why these exist: the $elemMatch/positional bug from earlier this week
// silently wrote to the wrong array index. Tests passed because they only
// asserted "the target item changed" and never "nothing else changed."
// `toHaveOnlyMutatedItem` closes that gap — it's the missing companion to
// every existing claim/update assertion.
const Wishlist = require('../../models/Wishlist');

// Compare an "after" wishlist (looked up by _id in the matcher) against
// a snapshot of its items[] taken before the operation, and assert that
// only the item at `expectedItemId` differs.
//
// Usage:
//   const before = await Wishlist.findById(wishlist._id).lean();
//   // ... perform mutation ...
//   await expect(wishlist._id).toHaveOnlyMutatedItem(before.items, itemId);
expect.extend({
  async toHaveOnlyMutatedItem(wishlistId, beforeItems, expectedItemId) {
    const after = await Wishlist.findById(wishlistId).lean();
    if (!after) {
      return { pass: false, message: () => `Wishlist ${wishlistId} not found` };
    }

    const expectedId = expectedItemId.toString();
    const unexpectedChanges = [];
    const expectedChanged = [];

    // Build a map of before-items keyed by _id for stable lookup
    const beforeById = new Map(
      beforeItems.map(it => [it._id.toString(), it])
    );

    for (const afterItem of after.items) {
      const id = afterItem._id.toString();
      const beforeItem = beforeById.get(id);
      if (!beforeItem) {
        // New item appeared. Treat as a change.
        if (id !== expectedId) {
          unexpectedChanges.push({ id, kind: 'new', after: afterItem });
        } else {
          expectedChanged.push(id);
        }
        continue;
      }
      const changed = JSON.stringify(beforeItem) !== JSON.stringify(afterItem);
      if (changed) {
        if (id === expectedId) {
          expectedChanged.push(id);
        } else {
          unexpectedChanges.push({
            id,
            kind: 'modified',
            before: beforeItem,
            after: afterItem
          });
        }
      }
    }

    // Detect deleted items (in before but not after)
    const afterIds = new Set(after.items.map(it => it._id.toString()));
    for (const beforeItem of beforeItems) {
      const id = beforeItem._id.toString();
      if (!afterIds.has(id)) {
        if (id === expectedId) {
          expectedChanged.push(id);
        } else {
          unexpectedChanges.push({ id, kind: 'deleted', before: beforeItem });
        }
      }
    }

    if (unexpectedChanges.length > 0) {
      return {
        pass: false,
        message: () =>
          `Expected only item ${expectedId} to change, but these items were also affected:\n` +
          unexpectedChanges.map(c => `  - ${c.id} (${c.kind})`).join('\n')
      };
    }
    if (expectedChanged.length === 0) {
      return {
        pass: false,
        message: () => `Expected item ${expectedId} to change, but it was untouched`
      };
    }
    return { pass: true, message: () => `Only item ${expectedId} changed, as expected` };
  }
});
