// select the database to use.
use('wishlist');

// Find all emails
db.users.distinct('email')

// Find a user ID by email provided in a variable
const userEmail = 'robodude678@gmail.com';
const userId = db.users.findOne({ email: userEmail })._id;

// Find all wishlists for a user
db.wishlists.find({ user: userId });

// Find all wishlists shared with a user
db.wishlists.find({ sharedWith: userId });

// Find all items claimed by a user
db.items.find({ claimedBy: userId });
