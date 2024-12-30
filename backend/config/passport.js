const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

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
      callbackURL: '/api/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists by email
        let user = await User.findOne({ 
          email: profile.emails[0].value.toLowerCase() 
        });

        if (user) {
          // If this was a pending user, update their info
          if (user.isPending) {
            user.googleId = profile.id;
            user.name = profile.displayName;
            user.picture = profile.photos[0].value;
            user.isPending = false;
            await user.save();
          }
        } else {
          // Create new user
          user = await User.create({
            googleId: profile.id,
            email: profile.emails[0].value.toLowerCase(),
            name: profile.displayName,
            picture: profile.photos[0].value,
            isPending: false
          });
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

module.exports = passport; 