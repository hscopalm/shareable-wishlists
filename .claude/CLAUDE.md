# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gift Guru is a smart gift management platform that helps users create and share wishlists with friends and family. The application solves the coordination problem of who is buying what gifts without spoiling surprises.

**Live URL**: https://www.giftguru.cc

## Development Commands

### Local Development (Docker Compose)
```bash
# Build and run all services (frontend, backend, MongoDB)
docker-compose up --build

# Seed the database with test users and wishlists (in a separate terminal)
cd backend && npm run seed

# Frontend runs on: http://localhost (port 80)
# Backend API runs on: http://localhost:5000
# MongoDB runs on: localhost:27017
```

**Development Auth Bypass**: Set `DEV_AUTO_LOGIN=true` in `.env.development` to skip Google OAuth and auto-login as a seed user. This allows local development without Google OAuth credentials.

### Frontend Development
```bash
cd frontend
npm install          # Install dependencies
npm start           # Start development server (port 3000)
npm run build       # Create production build
npm test            # Run tests
```

### Backend Development
```bash
cd backend
npm install          # Install dependencies
npm start           # Start server (production mode)
npm run dev         # Start server with nodemon (development mode)
npm run seed        # Seed database with test data (requires MongoDB running)
```

### Deployment

**Important**: Infrastructure must be deployed before the application. Follow this order:

1. **First, deploy infrastructure (Terraform)**:
```bash
cd terraform
terraform init      # Initialize Terraform (first time only)
terraform plan      # Review infrastructure changes
terraform apply     # Apply infrastructure changes (confirm when prompted)
```

2. **Then, deploy the application**:
```bash
# Deploy both frontend and backend
./deploy.sh

# Deploy only frontend (S3/CloudFront)
./deploy.sh Frontend

# Deploy only backend (ECS)
./deploy.sh Backend
```

### Infrastructure (Terraform)
```bash
cd terraform
terraform init      # Initialize Terraform
terraform plan      # Preview changes
terraform apply     # Apply infrastructure changes
```

## Architecture

### Technology Stack
- **Frontend**: React 18 with Material-UI v5, React Router v6
- **Backend**: Node.js with Express, Passport (Google OAuth 2.0)
- **Database**: MongoDB with Mongoose ODM
- **Infrastructure**: AWS ECS (Fargate), CloudFront, S3, Application Load Balancer, Terraform IaC
- **Containerization**: Docker, Docker Compose

### Deployment Architecture (Production)
- CloudFront serves static frontend files from S3 bucket
- CloudFront proxies `/api/*` requests to ALB → ECS Fargate backend
- Backend connects to MongoDB Atlas
- Session storage in MongoDB using connect-mongo
- Google OAuth for authentication with callback routing through CloudFront

### Local Development Architecture (Docker Compose)
- Frontend served via Nginx container on port 80
- Backend Express container on port 5000
- MongoDB container on port 27017

### Project Structure
```
├── frontend/           # React SPA
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── contexts/      # React Context providers (Auth, List)
│   │   ├── pages/         # Route pages (Login, Lists, Wishlist, SharedLists)
│   │   ├── services/      # API client (axios)
│   │   └── theme.js       # Material-UI theme configuration
│   └── Dockerfile
├── backend/            # Express API server
│   ├── config/            # Passport configuration
│   ├── models/            # Mongoose schemas (User, Wishlist, ActivityLog)
│   ├── routes/            # API routes (auth, wishlist, sharing, lists, admin)
│   ├── utils/             # Email service utilities
│   ├── server.js          # Main server file
│   └── Dockerfile
├── terraform/          # Infrastructure as Code
└── mongo/              # Database scripts and seeds
```

## Data Models

### User Model
- Core fields: email (unique), name, picture, googleId (from OAuth)
- Supports `isPending` state for users invited before they sign up
- Users created via Google OAuth or email invitation

### Wishlist Model
- Container for gift lists with embedded items array
- Fields: name, description, event_date, user (owner), sharedWith array
- Items embedded with: title, description, link, imageUrl, notes, price, priority (1-5)
- Item claiming system: status.claimedBy (User ref) and status.claimedAt

### ActivityLog Model
- Tracks user interactions: views, shares, claims
- Fields: action, causer (User ref), wishlist (Wishlist ref), page, details (flexible object)
- Used for analytics and user activity tracking

## Key Implementation Details

### Authentication Flow
1. Frontend redirects to `/api/auth/google` for OAuth initiation
2. Google OAuth callback at `/api/auth/google/callback` handled by Passport
3. User session stored in MongoDB via express-session + connect-mongo
4. Session cookie with domain-specific settings (secure in production)
5. `requireAuth` middleware protects API routes

### API Routing
- All API routes prefixed with `/api`
- Routes:
  - `/api/auth/*` - Authentication (login, logout, current user)
  - `/api/lists/*` - List CRUD operations
  - `/api/wishlist/*` - Item CRUD operations (requires auth)
  - `/api/share/*` - Sharing functionality (share, unshare, claim items)
  - `/api/admin/*` - Administrative operations (requires auth)

### Frontend State Management
- **AuthContext**: User authentication state, login/logout methods
- **ListContext**: Currently selected wishlist, list management
- React Context API used instead of Redux for simplicity
- Protected routes redirect unauthenticated users to login

### API Base URL
Frontend uses empty base URL (`API_BASE_URL = ''`) because CloudFront handles routing - static assets served from S3, `/api/*` forwarded to backend.

### Session Management
- Sessions stored in MongoDB for persistence across container restarts
- Session TTL: 24 hours
- Cookie settings adapt based on NODE_ENV (secure flag, domain, sameSite)
- Important: Session middleware must initialize AFTER MongoDB connection

### Email Service
- Located in `backend/utils/emailService.js`
- Uses nodemailer for sending share notifications
- **Optional**: If `GOOGLE_SA_USERNAME` or `GOOGLE_APP_PASSWORD` are not set, email is disabled gracefully (logs instead of sending)

## Environment Variables

### Backend (.env.development or environment)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID (not required if DEV_AUTO_LOGIN=true)
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret (not required if DEV_AUTO_LOGIN=true)
- `SESSION_SECRET` - Express session secret
- `MONGODB_URI` - MongoDB connection string
- `FRONTEND_URL` - Frontend URL (for OAuth callback)
- `NODE_ENV` - Environment (development/production)
- `COOKIE_DOMAIN` - Cookie domain setting (only used in production)
- `PORT` - Backend port (default: 5000)
- `DEV_AUTO_LOGIN` - Set to "true" to bypass Google OAuth in development
- `DEV_USER_EMAIL` - Email of user to auto-login as in dev mode (default: hscopalm@gmail.com)
- `GOOGLE_SA_USERNAME` - Email service username (optional - email disabled if not set)
- `GOOGLE_APP_PASSWORD` - Email service app password (optional - email disabled if not set)

### Frontend
- API calls use relative paths (empty `API_BASE_URL`) to work with CloudFront/ALB routing
- OAuth initiated through same-origin `/api/auth/google`

## Common Development Patterns

### Adding a New API Endpoint
1. Create route handler in appropriate file under `backend/routes/`
2. Use `requireAuth` middleware if authentication needed
3. Import and use models from `backend/models/`
4. Add route to `server.js` (after session/passport initialization)
5. Create corresponding API function in `frontend/src/services/api.js`

### Adding a New Page
1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/App.js`
3. Wrap with `<ProtectedRoute>` if authentication required
4. Update Navbar links if needed

### Working with Mongoose Models
- All models use async/await with try-catch for error handling
- Use `.populate()` for referencing related documents (User refs in Wishlist)
- Embedded items in Wishlist use array operations (no separate Item collection)

## Important Gotchas

1. **Server Startup Order**: MongoDB connection must complete BEFORE session middleware initialization. The `startServer()` async function ensures proper order.

2. **Session Cookie Configuration**: Cookie settings (secure, domain, sameSite) must match environment. Cookie domain is only set in production to allow any host in development.

3. **OAuth Callback URL**: Must match exactly in Google Cloud Console and `FRONTEND_URL` env var. CloudFront routing requires callback through frontend domain.

4. **Health Check Endpoint**: `/health` endpoint checks MongoDB connection for ALB health checks. Don't add authentication to this endpoint.

5. **CORS Configuration**: Origin must match frontend URL exactly. Credentials must be enabled for session cookies.

6. **Embedded Items**: Items are embedded in Wishlist documents, not separate. Update/delete operations target the Wishlist document with item ID.

7. **Development Auth Bypass**: When `DEV_AUTO_LOGIN=true` and `NODE_ENV=development`, Google OAuth is completely disabled. The `/api/auth/google` route auto-logs in as the dev user instead. This is safe because it requires BOTH environment variables to be set.

## MongoDB Administration

- Database scripts located in `mongo/` directory
- Seeds available for test data in `mongo/seeds/`
- Scripts for managing orphaned records and user data

### Seeding the Database
```bash
# With Docker Compose running (MongoDB on localhost:27017)
cd backend && npm run seed
```

The seed script (`backend/scripts/seed.js`):
- Reads seed files from `mongo/seeds/`
- Parses MongoDB Extended JSON format automatically
- Upserts users by email (won't duplicate)
- Clears and recreates wishlists (fresh data each time)

**Seed Data Format**: Seeds use MongoDB Extended JSON format:
- ObjectIds: `{"$oid": "6763b6892d9d2bba36992ecd"}`
- Dates: `{"$date": "2024-12-19T06:00:41.698Z"}`

## Deployment Notes

### AWS Infrastructure
- Managed via Terraform in `terraform/` directory
- ECS Fargate for container orchestration (backend only)
- CloudFront for CDN and routing (frontend from S3, API to ALB)
- Application Load Balancer handles backend traffic from CloudFront
- Security groups restrict access to necessary ports only
- Production secrets managed via AWS Parameter Store (not .env files)

### Container Build
- Both frontend and backend have separate Dockerfiles
- Frontend uses multi-stage build: React build → Nginx serving
- Backend uses Node 18 Alpine for smaller image size
- docker-compose.yml for local development includes MongoDB

### CI/CD
- Use `./deploy.ps1` for manual deployments
- Deployment builds images and pushes to AWS ECR (backend) / S3 (frontend)
- Terraform manages infrastructure state
- MongoDB Atlas requires IP whitelisting for security
