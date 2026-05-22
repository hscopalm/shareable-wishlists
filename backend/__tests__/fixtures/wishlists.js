const Wishlist = require('../../models/Wishlist');

// Factory function to create a wishlist with default values
async function createWishlist(owner, overrides = {}) {
  const defaults = {
    name: 'Test Wishlist',
    description: 'A test wishlist',
    user: owner._id,
    sharedWith: [],
    items: []
  };

  const wishlistData = { ...defaults, ...overrides };
  const wishlist = new Wishlist(wishlistData);
  await wishlist.save();
  return wishlist;
}

// Generic N-item generator used when a test wants more than the default 2.
// Returns plain items so callers can still apply per-item overrides via
// createWishlistWithItems's array form.
function generateItems(count) {
  return Array.from({ length: count }, (_, i) => ({
    title: `Item ${i + 1}`,
    description: `Generic test item #${i + 1}`,
    price: 10 + i,
    priority: ((i % 5) + 1)
  }));
}

// Create a wishlist with items. The second argument accepts either:
//   - an array of items (legacy callers): used as-is
//   - a number: generate that many generic items
//   - omitted: default 2-item fixture (back-compat)
//
// Tests that exercise index-sensitive logic should pass a number >= 3 so
// the target index is unambiguously non-zero. The default of 2 stays the
// same so existing tests don't change behavior.
async function createWishlistWithItems(owner, itemsOrCount, overrides = {}) {
  let items;
  if (typeof itemsOrCount === 'number') {
    items = generateItems(itemsOrCount);
  } else if (Array.isArray(itemsOrCount) && itemsOrCount.length > 0) {
    items = itemsOrCount;
  } else {
    items = [
      {
        title: 'Test Item 1',
        description: 'First test item',
        price: 25.99,
        priority: 3
      },
      {
        title: 'Test Item 2',
        description: 'Second test item',
        link: 'https://example.com/item2',
        price: 49.99,
        priority: 5
      }
    ];
  }

  return createWishlist(owner, { items, ...overrides });
}

// Create a wishlist shared with specific users
async function createSharedWishlist(owner, sharedWithUsers, overrides = {}) {
  const sharedWith = sharedWithUsers.map(u => u._id);
  return createWishlist(owner, { sharedWith, ...overrides });
}

// Create a wishlist with a specific event date
async function createWishlistWithEventDate(owner, eventDate, overrides = {}) {
  return createWishlist(owner, { event_date: eventDate, ...overrides });
}

// Pre-defined wishlist item templates
const itemTemplates = {
  headphones: {
    title: 'Sony WH-1000XM5 Headphones',
    description: 'Noise cancelling wireless headphones',
    link: 'https://example.com/headphones',
    price: 349.99,
    priority: 5
  },
  book: {
    title: 'The Pragmatic Programmer',
    description: 'Programming book',
    price: 49.99,
    priority: 3
  },
  giftCard: {
    title: 'Amazon Gift Card',
    description: '$50 gift card',
    price: 50,
    priority: 2
  }
};

module.exports = {
  createWishlist,
  createWishlistWithItems,
  createSharedWishlist,
  createWishlistWithEventDate,
  generateItems,
  itemTemplates
};
