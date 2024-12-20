const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const PendingShare = require('../models/PendingShare');
const SharedList = require('../models/SharedList');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('Missing required Google OAuth environment variables');
    process.exit(1);
  }

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: 'http://localhost:5000/api/auth/google/callback',
      scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });
        const email = profile.emails[0].value.toLowerCase();
        
        if (!user) {
          // Create new user
          user = await User.create({
            googleId: profile.id,
            email: email,
            name: profile.displayName,
            picture: profile.photos[0].value
          });

          // Check for pending shares
          const pendingShares = await PendingShare.find({ email });
          
          // Convert pending shares to actual shares
          if (pendingShares.length > 0) {
            await Promise.all(pendingShares.map(async (pending) => {
              await SharedList.create({
                owner: pending.owner,
                sharedWith: user._id
              });
              await pending.deleteOne();
            }));
          }
        }
        
        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

module.exports = passport; 