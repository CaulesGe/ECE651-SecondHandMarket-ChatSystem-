# ECE651-G11 - Secondhand Item Selling Web App

## Overview
Secondhand Hub is a marketplace for buying and selling second-hand goods.
Inspired by Amazon's UX patterns, it features:
- **Search bar** with category filters
- **Product detail pages** with full item info
- **Recommendation system** based on browsing history and preferences
- **Recently viewed** tracking
- Role-based access (admin, user, guest)
- Cart workflow with checkout
- 40+ dummy products across 7 categories

## Project Structure
```
ECE651-G11/
├── client/                  # React Frontend (Vite)
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── Header.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── ProductCard.jsx
│   │   │   └── CartPanel.jsx
│   │   ├── context/        # React Context providers
│   │   │   ├── AuthContext.jsx
│   │   │   ├── CartContext.jsx
│   │   │   └── ChatContext.jsx
│   │   ├── pages/          # Page components
│   │   │   ├── HomePage.jsx
│   │   │   ├── ChatPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── ProductPage.jsx
│   │   │   ├── PaymentPage.jsx
│   │   │   ├── AdminPage.jsx
│   │   │   └── ProfilePage.jsx
│   │   ├── utils/
│   │   │   └── api.js      # API helper functions
│   │   ├── App.jsx         # Main app with routing
│   │   ├── main.jsx        # Entry point
│   │   └── index.css       # Global styles
│   ├── package.json
│   └── vite.config.js
├── backend/                 # API layer (Node + Express + Prisma)
│   ├── server.js
│   ├── package.json
│   └── prisma/
│       └── schema.prisma
├── database/                # Data layer (SQLite file)
│   └── secondhand.db
├── Dockerfile               # Docker build configuration
├── docker-compose.yml       # Docker Compose configuration
├── .dockerignore            # Files excluded from Docker build
└── start.sh                 # One-command startup script
```

## Features

### Amazon-Inspired UX
- **Search bar** in navigation with category dropdown
- **Category pills** for quick filtering
- **Product cards** with hover effects and quick-add to cart
- **Product detail page** with image, seller info, and recommendations
- **"Customers Also Viewed"** recommendations
- **"Recently Viewed"** history tracking
- **Hero banner** with marketplace stats
- **Chat/messages page** with a modern two-column layout (thread list + conversation)

### Chat UI (Frontend)
- **Two-column layout**: thread list on the left, active conversation on the right
- **Message composer**: input + send button at the bottom of the conversation panel
- **Auto-scroll**: scrolls to the newest message when switching threads / after sending
- **UUID message IDs**: new messages use UUID v4 (`crypto.randomUUID()` with a `getRandomValues()` fallback)

### Product Categories
- Electronics (MacBooks, headphones, cameras, TVs, etc.)
- Furniture (desks, chairs, sofas, beds)
- Clothing (jackets, shoes, athletic wear)
- Sports (bikes, gym equipment, outdoor gear)
- Books & Media (textbooks, vinyl records, manga)
- Home & Kitchen (vacuums, appliances, cookware)
- Music (guitars, pianos, drums, microphones)

### Roles & Access Rules
- **Guest**: Can browse and search, but cannot add to cart or checkout
- **User**: Full access to browse, cart, checkout, and list items for sale
- **Admin**: Access to admin panel with all users, listings, and transactions

## How to Run

### Quick Start (Recommended)
```bash
bash start.sh
```
This installs dependencies, sets up the database, and starts both servers.
- Backend API: `http://localhost:3000`
- Frontend: `http://localhost:5173`

Redis is scaffolded for upcoming chat scaling work and is **disabled by default** in local dev.  
Enable it by setting:
- `REDIS_ENABLED=true`
- `REDIS_URL=redis://127.0.0.1:6379`

### Docker (Production Build)
Run the entire app in a single Docker container on port 3000:
```bash
bash start.sh --docker
# or
bash start.sh -d
```

### Docker Compose (App + Redis)
For production-like Redis wiring:
```bash
docker compose up --build
```
This starts:
- app: `http://localhost:3000`
- redis: internal service at `redis://redis:6379`

Or run Docker commands manually:
```bash
# Build the image
docker build -t secondhand-hub .

# Run the container
docker run -p 3000:3000 secondhand-hub

# Run with persistent database volume
docker run -p 3000:3000 -v secondhand-data:/app/database secondhand-hub
```
Then open `http://localhost:3000` in your browser.

To stop the container:
```bash
# If running in foreground: Ctrl+C
# If running in background:
docker stop $(docker ps -q --filter ancestor=secondhand-hub)
```

### Manual Setup

#### 1) Start the backend API
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm start
```
The API runs at `http://localhost:3000`.

#### 2) Start the React frontend
```bash
cd client
npm install
npm run dev
```
Then open `http://localhost:5173` in your browser.

### After Changing Database Schema
```bash
cd backend
npx prisma generate
npx prisma db push
```
Then restart the backend.

### View Database (Prisma Studio)
```bash
cd backend
npx prisma studio
```
Opens a web UI at `http://localhost:5555`.

### Build for Production
```bash
cd client
npm run build
```
The built files will be in `client/dist/`.

## Default Accounts

| Role  | Email                  | Password    |
|-------|------------------------|-------------|
| Admin | admin@secondhand.com   | admin123    |
| User  | jordan@example.com     | password123 |

## API Endpoints

| Method | Endpoint                        | Description              |
|--------|---------------------------------|--------------------------|
| GET    | /api/goods                      | List all goods           |
| GET    | /api/goods?search=X&category=Y  | Search and filter        |
| GET    | /api/goods/:id                  | Get single product       |
| GET    | /api/goods/:id/recommendations  | Get similar items        |
| GET    | /api/categories                 | List all categories      |
| POST   | /api/goods                      | Create listing (auth)    |
| POST   | /api/auth/login                 | Login                    |
| POST   | /api/auth/register              | Register                 |
| GET    | /api/users                      | List users (admin)       |
| GET    | /api/transactions               | List transactions (admin)|
| POST   | /api/transactions/checkout      | Checkout (auth)          |

## Design & Layers
- **Frontend layer**: React with Vite, React Router for navigation, Context API for state management
- **Backend layer**: Express API with Prisma ORM
- **Database layer**: SQLite managed by Prisma, auto-seeded with 40+ products

## Tech Stack
- Frontend: React 18, React Router 6, Vite
- Backend: Node.js, Express
- Database: SQLite + Prisma ORM
- Styling: Custom CSS with Inter font, responsive design
- Containerization: Docker (multi-stage build)
