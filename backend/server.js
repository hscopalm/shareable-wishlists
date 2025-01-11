require('dotenv').config({ path: '../.env' });

// Add this after dotenv config
console.log('Environment variables loaded:', {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not set',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not set',
  MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Not set'
});

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const passport = require('./config/passport');
const http = require('http');

const app = express();
const server = http.createServer(app);

// Debug middleware to log session and auth status
app.use((req, res, next) => {
  console.log('Session ID:', req.sessionID);
  console.log('Is Authenticated:', req.isAuthenticated?.());
  next();
});

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL || 'http://localhost' : 'http://localhost',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Session configuration - this must come BEFORE passport middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  cookie: {
    // Only use secure cookies when using HTTPS
    secure: false, // Set to true in production when using HTTPS
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'lax',
    domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : 'localhost'
  },
  proxy: true // Trust the reverse proxy
}));

// Initialize passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Successfully connected to MongoDB.'))
.catch((error) => console.error('Error connecting to MongoDB:', error));

mongoose.connection.on('connected', async () => {
  try {
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
  } catch (error) {
    console.error('Error during startup checks:', error);
  }
});

// Import routes
const authRoutes = require('./routes/auth');
const wishlistRoutes = require('./routes/wishlist');
const sharingRoutes = require('./routes/sharing');
const adminRoutes = require('./routes/admin');
const listRoutes = require('./routes/lists');

// Auth middleware
const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Not authenticated' });
};

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/wishlist', requireAuth, wishlistRoutes);
app.use('/api', requireAuth, sharingRoutes);
app.use('/api/admin', requireAuth, adminRoutes);
app.use('/api/lists', requireAuth, listRoutes);

// Debug route to verify server is running
app.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 