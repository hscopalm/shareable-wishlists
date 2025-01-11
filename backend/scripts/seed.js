require('dotenv').config(); // Load the .env file

const mongoose = require('mongoose');
const User = require('../models/User');
const users = require('../models/seeds/wishlist.users.json');
const Wishlist = require('../models/Wishlist');
const wishlists = require('../models/seeds/wishlist.wishlists.json');

// Use localhost if MONGODB_URI is not set (running locally)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wishlist';

async function seedUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    
    // Clear existing users (optional)
    await User.deleteMany({});
    
    // Insert the users
    const result = await User.insertMany(users);
    
    // Create email to ObjectId mapping
    const emailToIdMap = result.reduce((map, user) => {
      map[user.email] = user._id.toString();
      return map;
    }, {});
    
    console.log(`Successfully seeded ${result.length} users`);
    console.log('Email to ObjectId mapping:', JSON.stringify(emailToIdMap, null, 2));
    
    return emailToIdMap;
    
  } catch (error) {
    console.error('Error seeding users:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
  }
}

async function seedWishlists() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    
    // Clear existing wishlists
    await Wishlist.deleteMany({});
    
    // Insert the wishlists
    const result = await Wishlist.insertMany(wishlists);

    
    console.log(`Successfully seeded ${result.length} wishlists`);
    
  } catch (error) {
    console.error('Error seeding wishlists:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
  }
}

// Update main function to seed both users and wishlists
async function seedDatabase() {
  await seedUsers();
  await seedWishlists();
}

// Run the seed function
seedDatabase();
