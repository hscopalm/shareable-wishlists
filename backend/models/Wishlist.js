const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  event_date: {
    type: Date
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  sharedWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  items: [{
    title: {
      type: String,
      required: true
    },
    description: String,
    link: String,
    imageUrl: String,
    notes: String,
    price: Number,
    priority: {
      type: Number,
      min: 1,
      max: 5
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    status: {
      claimedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      claimedAt: Date
    }
  }]
});

// Virtual property for archive date calculation
// Archive criteria: 3 months after creation OR 1 month after event date, whichever is LATER
wishlistSchema.virtual('archiveDate').get(function() {
  const threeMonthsAfterCreation = new Date(this.createdAt);
  threeMonthsAfterCreation.setMonth(threeMonthsAfterCreation.getMonth() + 3);

  if (!this.event_date) {
    return threeMonthsAfterCreation;
  }

  const oneMonthAfterEvent = new Date(this.event_date);
  oneMonthAfterEvent.setMonth(oneMonthAfterEvent.getMonth() + 1);

  // Return whichever is later
  return threeMonthsAfterCreation > oneMonthAfterEvent
    ? threeMonthsAfterCreation
    : oneMonthAfterEvent;
});

// Virtual property to check if list is archived
wishlistSchema.virtual('isArchived').get(function() {
  return new Date() > this.archiveDate;
});

// Configure schema to include virtuals in JSON output
wishlistSchema.set('toJSON', { virtuals: true });
wishlistSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Wishlist', wishlistSchema); 