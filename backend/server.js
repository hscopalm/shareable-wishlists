require('dotenv').config({ path: '../.env.development' });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./config/passport');
const http = require('http');

const app = express();
const server = http.createServer(app);

// Basic middleware that doesn't depend on session
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : [
    'http://localhost',
    'http://localhost:3000',
    process.env.FRONTEND_URL
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Import routes
const authRoutes = require('./routes/auth');
const wishlistRoutes = require('./routes/wishlist');
const sharingRoutes = require('./routes/sharing');
const adminRoutes = require('./routes/admin');
const listRoutes = require('./routes/lists');

// Health check endpoint for ALB - improved with connection checks
app.get('/health', async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB not connected');
    }
    res.status(200).json({ 
      status: 'healthy',
      mongodb: 'connected'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({ 
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Debug route to verify server is running
app.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Modified server startup sequence
const startServer = async () => {
  try {
    // Connect to MongoDB first
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Successfully connected to MongoDB.');

    // Initialize session after MongoDB is connected
    app.use(session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 24 * 60 * 60,
        autoRemove: 'native'
      }),
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
        // Don't set domain in development to allow any host (localhost, IP, etc.)
        ...(process.env.NODE_ENV === 'production' && { domain: process.env.COOKIE_DOMAIN })
      },
      proxy: true
    }));

    // Initialize passport after session
    app.use(passport.initialize());
    app.use(passport.session());

    // Auth middleware - defined after passport initialization
    const requireAuth = (req, res, next) => {
      if (req.isAuthenticated()) {
        return next();
      }
      res.status(401).json({ message: 'Not authenticated' });
    };

    // Use routes - after all middleware is initialized
    app.use('/api/auth', authRoutes);
    app.use('/api/wishlist', requireAuth, wishlistRoutes);
    app.use('/api', requireAuth, sharingRoutes);
    app.use('/api/admin', requireAuth, adminRoutes);
    app.use('/api/lists', requireAuth, listRoutes);

    // Start listening only after everything is initialized
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer(); 