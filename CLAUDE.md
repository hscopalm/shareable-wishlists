# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gift Guru is a wishlist management platform where users create gift lists and share them with family/friends. Recipients can claim items without spoiling the surprise for the list owner.

## Development Commands

### Local Development
```bash
# Start all services (frontend on :80, backend on :5000, MongoDB on :27017)
docker-compose up

# Frontend only (requires backend running)
cd frontend && npm start

# Backend only (requires MongoDB)
cd backend && npm run dev
```

### Build
```bash
cd frontend && npm run build
cd backend && docker build -t wishlist-backend .
```

### Deployment (PowerShell)
```powershell
# Deploy both frontend and backend
./deploy.ps1

# Deploy only frontend (S3/CloudFront)
./deploy.ps1 -Target Frontend

# Deploy only backend (ECS)
./deploy.ps1 -Target Backend
```

### Terraform
```bash
cd terraform
terraform init
terraform plan
terraform apply
```

## Architecture

### Frontend (React SPA)
- `frontend/src/App.js` - Router setup with protected routes
- `frontend/src/contexts/AuthContext.js` - Google OAuth authentication state
- `frontend/src/contexts/ListContext.js` - Wishlist state management
- `frontend/src/services/api.js` - Axios API client (all endpoints under `/api`)
- `frontend/src/pages/` - Main views: ListsPage, WishlistPage, SharedListsPage, LoginPage

### Backend (Express)
- `backend/server.js` - Server entry point, middleware chain, route mounting
- `backend/routes/` - API endpoints:
  - `auth.js` - Google OAuth flow
  - `lists.js` - CRUD for wishlists
  - `wishlist.js` - CRUD for items within lists
  - `sharing.js` - Share lists, claim items
  - `admin.js` - Admin utilities
- `backend/models/` - Mongoose schemas:
  - `User.js` - User with googleId, supports pending users
  - `Wishlist.js` - List with embedded items array and sharedWith array
  - `ActivityLog.js` - Activity tracking
- `backend/config/passport.js` - Passport Google OAuth strategy

### Infrastructure (Terraform)
- CloudFront distributes static frontend from S3 and proxies `/api/*` to ALB
- ECS Fargate runs backend container
- MongoDB Atlas for database (external)
- AWS Parameter Store for production secrets

## Key Patterns

### Authentication Flow
1. Frontend calls `/api/auth/google` which redirects to Google
2. Callback handled by Passport, creates session in MongoDB
3. Frontend checks `/api/auth/current-user` on load
4. All `/api/*` routes except auth require authentication via `requireAuth` middleware

### API Base URL
Frontend uses empty base URL (`API_BASE_URL = ''`) because CloudFront handles routing - static assets served from S3, `/api/*` forwarded to backend.

### Environment Variables
Local development uses `.env.development` file at project root. Production uses AWS Parameter Store. Required variables: `MONGODB_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`.
