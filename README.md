# ECE651-G11 - Secondhand Item Selling Web App

## Overview
Secondhand Hub is a demo marketplace for buying and selling second-hand goods.
It includes a layered architecture (frontend, backend, database), role-based
access (admin, user, guest), authentication, a cart workflow, and a payment
panel for checkout input.

## Project Structure
```
ECE651-G11/
├── frontend/                # UI layer (HTML/CSS/JS)
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── admin.html
│   ├── payment.html
│   ├── css/
│   └── js/
├── backend/                 # API layer (Node + Express + Prisma)
│   ├── server.js
│   └── package.json
│   └── prisma/
│       └── schema.prisma
└── database/                # Data layer (SQLite file)
    └── secondhand.db
```

## Roles & Access Rules
- **Guest**: Can browse the goods list but cannot add to cart or checkout.
- **User**: Can browse, add items to cart, publish listings, and checkout.
- **Admin**: Can access the admin panel to view all users, goods, and
  transactions.

## Authentication
Authentication is handled through the backend API with a simple email/password
lookup in SQLite. After login or registration, the frontend saves the session
in `localStorage`.

Default admin account:
- Email: `admin@secondhand.com`
- Password: `admin123`

## Database Structure (Prisma + SQLite)

The database schema is defined in `backend/prisma/schema.prisma` and stored
in a SQLite file at `database/secondhand.db`.

## How to Run (Local Setup)

### 1) Start the backend API
```
cd backend
npm install
npx prisma generate
npx prisma db push
npm start
```
The API runs at `http://localhost:3000`.

### 2) Start the frontend
From the project root:
```
cd frontend
python -m http.server 5500
```
Then open `http://localhost:5500/index.html` in your browser.

### 3) View the database (Prisma Studio)
Prisma includes a web UI for viewing data:
```
cd backend
npx prisma studio
```
Then open the URL shown in the terminal (usually `http://localhost:5555`).

### 4) View the database (SQLite CLI)
The database file `database/secondhand.db` is created automatically when the
backend starts. To view it from the terminal:
```
sqlite3 database/secondhand.db
```
Then inside the sqlite shell:
```
.tables
SELECT * FROM users;
SELECT * FROM goods;
SELECT * FROM transactions;
```

## Design & Layers
- **Frontend layer**: Pure HTML/CSS/JS providing UI views, user interaction,
  cart management, and client-side session storage.
- **Backend layer**: Express API exposing authentication, goods listing,
  checkout, and admin endpoints.
- **Database layer**: Prisma schema managed by SQLite. Prisma Studio provides
  a web UI for exploring data.

## Suggested Team Workflow
- Keep UI changes inside `frontend/`.
- Keep API logic inside `backend/`.
- If new fields are needed, update both the JSON schema in `database/` and the
  UI forms that create or display those fields.