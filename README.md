# Gift Guru

A smart gift management platform that helps you create and share wishlists with friends and family.

## Features

- Create multiple gift lists
- Add, edit, and remove items from your lists
- Share lists with others via email
- View lists shared with you
- Track when shared lists are viewed
- Sort items by priority, price, or date added

## Models

- **User**: Authentication and user data
- **List**: Wishlist container
- **WishlistItem**: Individual wishlist items
- **SharedList**: List sharing permissions
- **ListView**: Track when users view shared lists
- **PendingShare**: Temporary storage for email invites

## Tech Stack

- Frontend: React with Material-UI
- Backend: Node.js with Express
- Database: MongoDB with Mongoose
- Authentication: Google OAuth 2.0

## Development

1. Clone the repository
2. Install dependencies in both frontend and backend directories
3. Set up environment variables
4. Run backend server: `npm run dev`
5. Run frontend server: `npm start`

## Environment Variables

Backend:
- `MONGODB_URI`: MongoDB connection string
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `SESSION_SECRET`: Session encryption key
- `ADMIN_EMAILS`: Comma-separated list of admin email addresses
- `EMAIL_FROM`: Sender email for notifications
- `EMAIL_PASSWORD`: Email account password

Frontend:
- `REACT_APP_API_URL`: Backend API URL
- `REACT_APP_GOOGLE_CLIENT_ID`: Google OAuth client ID
