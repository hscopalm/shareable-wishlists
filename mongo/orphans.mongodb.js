// select the database to use.
use('wishlist');

// Find wishlists where the user doesn't exist in the users collection
db.wishlists.find({
  user: {
    $nin: db.users.distinct('_id')
  }
});

