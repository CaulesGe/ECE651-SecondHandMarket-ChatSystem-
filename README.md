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
├── frontend/                # UI layer (HTML/CSS/JS)
│   ├── index.html          # Home page with search, categories, recommendations
│   ├── product.html        # Product detail page
│   ├── login.html
│   ├── register.html
│   ├── admin.html
│   ├── payment.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── app.js          # Main app logic
│       ├── product.js      # Product detail page
│       ├── auth.js         # Login/register
│       ├── admin.js        # Admin dashboard
│       └── payment.js      # Checkout
├── backend/                 # API layer (Node + Express + Prisma)
│   ├── server.js
│   ├── package.json
│   └── prisma/
│       └── schema.prisma
├── database/                # Data layer (SQLite file)
│   └── secondhand.db
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

#### 2) Start the frontend
```bash
cd frontend
python3 -m http.server 5500
```
Then open `http://localhost:5500/index.html` in your browser.

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
- **Frontend layer**: Pure HTML/CSS/JS with modern UI, localStorage for cart and session
- **Backend layer**: Express API with Prisma ORM
- **Database layer**: SQLite managed by Prisma, auto-seeded with 40+ products

## Tech Stack
- Frontend: HTML5, CSS3, JavaScript (ES6+)
- Backend: Node.js, Express
- Database: SQLite + Prisma ORM
- Styling: Custom CSS with Inter font, responsive design
