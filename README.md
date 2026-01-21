# 🎁 Gift Guru

A smart gift management platform that helps you create and share wishlists with friends and family.

🌐 **Check it out at [giftguru.cc](https://www.giftguru.cc)**

> **Note**: A google account is required to access the app. We don't require any sensitive or restricted scopes - we only use the public profile information to create a user account.

## ❓ What is this? Why?

Have you ever shared a wishlist with family and friends, perhaps as a google doc? And then everyone has to coordinate on who is buying what without spoiling the surprise?


This is a simple solution to that problem.


Born out of a need to make gift giving easier for my family after a particularly stressful gift giving season, this is a simple platform that allows you to create and share wishlists with friends and family.

## ✨ Features

- 📝 Create multiple gift lists
- ✏️ Add, edit, and remove items from your lists
- 📧 Share lists with others via email
- 👀 View lists shared with you
- 🎯 Claim items from shared lists
- 📊 Track when shared lists are viewed
- 🔄 Sort items by priority, price, or date added

## 🏗️ Architecture

```mermaid
graph TD
    %% Styling
    classDef browser fill:#E8DEF8,stroke:#333,stroke-width:2px
    classDef aws fill:#FF9900,stroke:#232F3E,stroke-width:2px,color:#232F3E
    classDef app fill:#85B09A,stroke:#333,stroke-width:2px
    classDef db fill:#68B587,stroke:#333,stroke-width:2px
    classDef external fill:#B4A7D6,stroke:#333,stroke-width:2px

    %% Client Layer
    Client[Web Browser<br/>React SPA]:::browser

    %% AWS Infrastructure
    subgraph AWS["AWS Cloud"]
        ALB[Application Load Balancer]:::aws
        subgraph ECS["ECS Cluster"]
            FE[Frontend Container<br/>React + Nginx]:::app
            subgraph BE["Backend Container"]
                Express[Node.js + Express]:::app
                EmailService[Email Service<br/>Nodemailer]:::app
            end
        end
    end

    %% External Services
    subgraph External["External Services"]
        subgraph Atlas["MongoDB Atlas"]
            MongoDB[(Database<br/>Users, Lists, Logs)]:::db
        end
        Google[Google OAuth<br/>Authentication]:::external
    end

    %% Connections
    Client --> |HTTPS| ALB
    ALB --> |/api| Express
    ALB --> |/* static| FE
    Express --> |Store/Query| MongoDB
    Express --> |Auth| Google
    EmailService --> |SMTP| SMTP[Email Provider]:::external

    %% Link Styling
    linkStyle default stroke:#333,stroke-width:2px;
```

## 🛠️ Tech Stack

- Infrastructure:
  - AWS ECS for container orchestration
  - Application Load Balancer for traffic distribution
  - Terraform for Infrastructure as Code
  - CI/CD with GitHub Actions
- Frontend: 
  - React with Material-UI
  - Nginx for serving static content
  - Containerized with Docker
- Backend: 
  - Node.js with Express
  - Containerized with Docker
- Database: MongoDB with Mongoose
- Authentication: Google OAuth 2.0

## 📚 Models

Our data model takes advantage of MongoDB's document-oriented structure to efficiently organize data with minimal collections:

- **User**
  - Core user data (email, name, picture)
  - Google OAuth integration via `googleId`
  - Support for pending user states

- **Wishlist**
  - Consolidated wishlist container and items
  - Embedded items array with full item details
  - Built-in sharing permissions via `sharedWith` array
  - Integrated item claiming system with user references
  - Properties per item:
    - Basic details (title, description, link)
    - Price and priority tracking
    - Claim status with timestamp

- **ActivityLog**
  - Comprehensive user activity tracking
  - Records all interactions (views, shares, claims)
  - References to related users and wishlists
  - Flexible `details` field for varied action types

This design eliminates the need for separate collections for items, shares, and views, reducing query complexity and improving performance.

## 💻 Development

### Quick Start (Docker Compose)
```bash
# 1. Clone and setup
git clone <repo-url>
cd shareable-wishlists

# 2. Configure environment (copy and edit as needed)
cp env.example .env.development

# 3. Build and run all services
docker-compose up --build

# 4. Seed the database with test data (in a separate terminal)
cd backend && npm run seed

# 5. Access the app at http://localhost
```

### Development Auth Bypass
Set `DEV_AUTO_LOGIN=true` in `.env.development` to bypass Google OAuth and auto-login as a seed user. This allows local development without setting up Google OAuth credentials.

### Available Commands
```bash
# Backend
cd backend
npm run dev         # Start with hot-reload
npm run seed        # Seed database with test data

# Frontend
cd frontend
npm start           # Start dev server (port 3000)
npm run build       # Production build
```

### Deployment (AWS)
1. Build and push images to AWS ECR
2. Run `terraform init` and `terraform apply` in the `terraform/` directory

## 🔒 Security Considerations
- Development environment variables are managed through `.env.development`
- Production secrets are managed through AWS Parameter Store
- OAuth 2.0 for secure authentication
- HTTPS enforced in production
- MongoDB Atlas with IP whitelisting
- AWS security groups limit access to services

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments
- Material-UI for the component library
- MongoDB Atlas for database hosting
- AWS for infrastructure hosting
