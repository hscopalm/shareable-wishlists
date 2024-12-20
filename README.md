# Wishlist App

A modern, real-time wishlist application that allows users to create, share, and collaborate on wishlists. Built with React, Material-UI, and Node.js.

## Purpose

The Wishlist App solves common gift-giving coordination problems by providing:
- A central place for users to maintain their wishlists
- Ability to share lists with friends and family
- Status tracking to prevent duplicate purchases
- Privacy controls to keep gift-giving a surprise

### Key Features
- 🔒 Secure Google OAuth authentication
- 📱 Responsive, modern Material-UI design
- 🔄 Real-time status updates for shared lists
- 🎁 Purchase status tracking (Purchased/Tentative)
- 📊 Multiple sorting options (Priority, Date, Price)
- 🔗 External link support for items
- 📸 Image support for visual reference
- 📝 Rich item descriptions with notes

## Architecture

### Frontend
- **React** for the UI framework
- **Material-UI (MUI)** for component design
- **React Router** for navigation
- **Axios** for API communication
- **Context API** for state management

### Backend
- **Node.js** with Express
- **MongoDB** with Mongoose for data persistence
- **Passport.js** for authentication
- **Express Session** for session management

### Data Models
- **User**: Profile and authentication info
- **WishlistItem**: Core item data
- **SharedList**: Sharing relationships
- **ItemStatus**: Purchase status tracking
- **PendingShare**: Handles sharing with future users

## Design Decisions

### Authentication
- Chose Google OAuth for:
  - Secure authentication
  - Simplified user onboarding
  - Reliable email verification
  - Profile photo integration

### UI/UX
- Card-based layout for visual organization
- Hover actions for cleaner interface
- Status chips for clear purchase indication
- Color coding for priority levels
- Responsive design for all devices

### Sharing Mechanism
- Two-way sharing relationship tracking
- Pending shares for non-registered users
- Status privacy (owners can't see who marked items)
- Edit suggestion over deletion for shared items

### State Management
- Local state for UI components
- Context for auth state
- Props for component communication
- Optimistic updates for better UX

## Setup and Installation

### Prerequisites
- Node.js (v14+)
- MongoDB
- Google OAuth credentials

### Environment Variables
```
MONGODB_URI=your_mongodb_uri
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SESSION_SECRET=your_session_secret
```

### Installation Steps

1. Clone the repository
```bash
git clone https://github.com/yourusername/wishlist-app.git
cd wishlist-app
```

2. Install dependencies
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

3. Set up environment variables
```bash
# In backend directory
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development servers
```bash
# Start backend server (from backend directory)
npm run dev

# Start frontend server (from frontend directory)
npm start
```

The app will be available at `http://localhost:3000`

## Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
5. Push to the branch (`git push origin feature/AmazingFeature`)
6. Open a Pull Request

Please ensure your PR:
- Includes a clear description of the changes
- Updates relevant documentation
- Follows the existing code style
- Includes tests if applicable

## License

This project is licensed under the MIT License - see below for details:

```
MIT License

Copyright (c) 2024 Harrison Palmer
```
