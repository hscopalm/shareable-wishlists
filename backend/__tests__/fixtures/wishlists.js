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

// Create a wishlist with items
async function createWishlistWithItems(owner, items = [], overrides = {}) {
  const defaultItems = items.length > 0 ? items : [
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

  return createWishlist(owner, { items: defaultItems, ...overrides });
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
  itemTemplates
};
