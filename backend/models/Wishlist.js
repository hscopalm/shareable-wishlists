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
  mailingAddress: {
    recipientName: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    _id: false
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
  inviteToken: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  inviteLinkEnabled: {
    type: Boolean,
    default: false
  },
  allowAnonymousClaims: {
    type: Boolean,
    default: false
  },
  items: [{
    // 'gift' (default, existing behavior) or 'cash' (payment-handle item).
    // Cash items live alongside gift items and reuse the claims[] array as a
    // contributor list with no quantity ceiling.
    type: {
      type: String,
      enum: ['gift', 'cash'],
      default: 'gift'
    },
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
    // Optional desired quantity. Absent or <= 1 means single-claim mode (uses
    // the legacy `status` field). > 1 switches the item to multi-claim mode
    // (uses the `claims` array). See backend/utils/itemClaims.js.
    quantity: Number,
    // Cash items only. Cleaned handles (no @ / $ / whitespace). At least one
    // entry required at write time; profile URLs are constructed at read time
    // via backend/utils/paymentLinks.js.
    paymentLinks: {
      venmo: String,
      paypal: String,
      cashapp: String,
      _id: false
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
      claimedAt: Date,
      anonymousClaimerName: String,
      isAnonymousClaim: {
        type: Boolean,
        default: false
      }
    },
    // Populated only when item.quantity > 1. Each entry is one giver's
    // partial claim of the requested quantity.
    claims: [{
      claimedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      claimedAt: {
        type: Date,
        default: Date.now
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
      },
      anonymousClaimerName: String,
      isAnonymousClaim: {
        type: Boolean,
        default: false
      }
    }]
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