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
├── backend/                 # API layer (Node + Express)
│   ├── server.js
│   └── package.json
└── database/                # Data layer (JSON files for demo)
    ├── users.json
    ├── goods.json
    └── transactions.json
```

## Roles & Access Rules
- **Guest**: Can browse the goods list but cannot add to cart or checkout.
- **User**: Can browse, add items to cart, publish listings, and checkout.
- **Admin**: Can access the admin panel to view all users, goods, and
  transactions.

## Authentication
Authentication is handled through the backend API with a simple email/password
lookup in `database/users.json`. After login or registration, the frontend
saves the session in `localStorage`.

Default admin account:
- Email: `admin@secondhand.com`
- Password: `admin123`

## Database Structure (JSON Demo)

### `users.json`
```
[
  {
    "id": "u_1001",
    "name": "Jordan Lee",
    "email": "jordan@example.com",
    "password": "password123",
    "role": "user",
    "createdAt": "2026-01-10T10:45:00.000Z"
  }
]
```

### `goods.json`
```
[
  {
    "id": "g_1001",
    "title": "Vintage Walnut Desk",
    "description": "Solid walnut desk with brass handles.",
    "price": 180,
    "condition": "Good",
    "category": "Furniture",
    "images": ["https://picsum.photos/seed/desk/600/400"],
    "sellerName": "Jordan Lee",
    "location": "Waterloo, ON",
    "listedAt": "2026-01-12T14:12:00.000Z"
  }
]
```

### `transactions.json`
```
[
  {
    "id": "t_1700000000000",
    "userId": "u_1001",
    "items": [
      { "id": "g_1001", "title": "Vintage Walnut Desk", "price": 180, "quantity": 1 }
    ],
    "total": 180,
    "payment": { "method": "card", "last4": "4242" },
    "status": "pending",
    "createdAt": "2026-01-12T14:50:00.000Z"
  }
]
```

## How to Run (Local Setup)

### 1) Start the backend API
```
cd backend
npm install
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

## Design & Layers
- **Frontend layer**: Pure HTML/CSS/JS providing UI views, user interaction,
  cart management, and client-side session storage.
- **Backend layer**: Express API exposing authentication, goods listing,
  checkout, and admin endpoints.
- **Database layer**: JSON files that simulate persistent storage for users,
  goods, and transactions. Each backend request reads/writes these files to
  mimic a basic data layer.

## Suggested Team Workflow
- Keep UI changes inside `frontend/`.
- Keep API logic inside `backend/`.
- If new fields are needed, update both the JSON schema in `database/` and the
  UI forms that create or display those fields.