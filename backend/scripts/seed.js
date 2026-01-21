const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env.development') });

const User = require('../models/User');
const Wishlist = require('../models/Wishlist');

// Parse MongoDB Extended JSON format recursively
function parseExtendedJSON(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => parseExtendedJSON(item));
  }

  if (typeof value === 'object') {
    // Handle MongoDB Extended JSON types
    if (value.$oid) {
      return new mongoose.Types.ObjectId(value.$oid);
    }
    if (value.$date) {
      return new Date(value.$date);
    }

    // Recursively parse object properties
    const parsed = {};
    for (const [key, val] of Object.entries(value)) {
      parsed[key] = parseExtendedJSON(val);
    }
    return parsed;
  }

  return value;
}

async function seed() {
  try {
    // Use localhost when running outside Docker, mongodb service name inside Docker
    const mongoUri = process.env.MONGODB_URI?.replace('mongodb://mongodb:', 'mongodb://localhost:')
      || 'mongodb://localhost:27017/wishlist';

    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Read seed files
    const seedsPath = path.join(__dirname, '../../mongo/seeds');

    const usersFile = path.join(seedsPath, 'wishlist.users.json');
    const wishlistsFile = path.join(seedsPath, 'wishlist.wishlists.json');

    // Seed users
    if (fs.existsSync(usersFile)) {
      const usersData = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
      const users = parseExtendedJSON(usersData);

      console.log(`Seeding ${users.length} users...`);
      for (const user of users) {
        await User.findOneAndUpdate(
          { email: user.email },
          user,
          { upsert: true, new: true }
        );
      }
      console.log('Users seeded successfully');
    }

    // Seed wishlists
    if (fs.existsSync(wishlistsFile)) {
      const wishlistsData = JSON.parse(fs.readFileSync(wishlistsFile, 'utf-8'));
      const wishlists = parseExtendedJSON(wishlistsData);

      // Clear existing wishlists and insert fresh
      console.log('Clearing existing wishlists...');
      await Wishlist.deleteMany({});

      console.log(`Seeding ${wishlists.length} wishlists...`);
      for (const wishlist of wishlists) {
        // Remove _id if it's null/undefined so MongoDB generates one
        if (!wishlist._id) {
          delete wishlist._id;
        }
        await Wishlist.create(wishlist);
      }
      console.log('Wishlists seeded successfully');
    }

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seed();
