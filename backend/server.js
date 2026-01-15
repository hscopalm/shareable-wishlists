require('dotenv').config({ path: '../.env.development' });

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
const MongoStore = require('connect-mongo');
const passport = require('./config/passport');
const http = require('http');

const app = express();
const server = http.createServer(app);

// Trust proxy - required for CloudFront/ALB setup
app.set('trust proxy', 1);

// Basic middleware that doesn't depend on session
const allowedOrigin = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production'
  ? 'https://www.giftguru.cc'
  : 'http://localhost:3000');

app.use(cors({
  origin: allowedOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Custom-Header']
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
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Successfully connected to MongoDB.');

    // List collections after connection
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));

    // Initialize session after MongoDB is connected
    const isProduction = process.env.NODE_ENV === 'production';

    // Fix X-Forwarded-Proto for CloudFront requests
    // When CloudFront connects to ALB over HTTP, ALB sets X-Forwarded-Proto: http
    // But we know CloudFront requests are HTTPS, so override based on our secret header
    if (isProduction) {
      app.use((req, res, next) => {
        if (req.get('X-Custom-Header') === process.env.CLOUDFRONT_SECRET) {
          req.headers['x-forwarded-proto'] = 'https';
        }
        next();
      });
    }

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
        secure: isProduction,
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        domain: process.env.COOKIE_DOMAIN || undefined
      },
      proxy: true
    }));

    // Initialize passport after session
    app.use(passport.initialize());
    app.use(passport.session());

    // CloudFront validation middleware - temporarily disabled for debugging
    // TODO: Re-enable after confirming CloudFront works
    /*
    if (process.env.NODE_ENV === 'production') {
      app.use((req, res, next) => {
        if (req.path === '/health') {
          return next();
        }
        const customHeader = req.get('X-Custom-Header');
        if (!customHeader || customHeader !== process.env.CLOUDFRONT_SECRET) {
          console.warn('Blocked request without valid CloudFront header');
          return res.status(403).json({ message: 'Forbidden' });
        }
        next();
      });
    }
    */

    // Debug middleware - after session and passport
    app.use((req, res, next) => {
      if (req.path === '/health') {
        return next();
      }
      console.log('Session ID:', req.sessionID);
      console.log('Is Authenticated:', req.isAuthenticated?.());
      next();
    });

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