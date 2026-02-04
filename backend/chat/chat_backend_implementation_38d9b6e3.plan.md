---
name: Chat Backend Implementation
overview: Implement a complete chat backend service in backend/chat/ with WebSocket support, HTTP APIs, and database persistence. The service will support both JWT and header-based authentication, use Socket.IO for real-time messaging, and integrate as a separate module mounted in the main server.
todos:
  - id: schema
    content: Update Prisma schema with Conversation, ConversationParticipant, Message, and ConversationReadState models
    status: pending
  - id: dependencies
    content: Add socket.io, jsonwebtoken, and uuid to backend/package.json
    status: pending
  - id: auth-middleware
    content: Create backend/chat/auth.js with JWT and header-based authentication support
    status: pending
    dependencies:
      - dependencies
  - id: conversation-service
    content: Implement backend/chat/services/conversation.js with create, list, and read state logic
    status: pending
    dependencies:
      - schema
  - id: message-service
    content: Implement backend/chat/services/message.js with send, get, and validation logic
    status: pending
    dependencies:
      - schema
  - id: sync-service
    content: Implement backend/chat/services/sync.js for message synchronization
    status: pending
    dependencies:
      - schema
  - id: http-routes
    content: Create backend/chat/routes.js with all REST API endpoints
    status: pending
    dependencies:
      - auth-middleware
      - conversation-service
      - message-service
      - sync-service
  - id: websocket-server
    content: Implement backend/chat/websocket.js with Socket.IO server and event handlers
    status: pending
    dependencies:
      - auth-middleware
      - message-service
  - id: chat-module
    content: Create backend/chat/index.js to export mountChatService function
    status: pending
    dependencies:
      - http-routes
      - websocket-server
  - id: server-integration
    content: Update backend/server.js to create HTTP server and mount chat service
    status: pending
    dependencies:
      - chat-module
  - id: frontend-api
    content: Add chat API methods to client/src/utils/api.js
    status: pending
    dependencies:
      - http-routes
  - id: chat-context
    content: Enhance client/src/context/ChatContext.jsx with WebSocket connection and real-time handling
    status: pending
    dependencies:
      - frontend-api
      - websocket-server
  - id: chat-page-integration
    content: Update client/src/pages/ChatPage.jsx to use real API and WebSocket instead of mock data
    status: pending
    dependencies:
      - chat-context
  - id: migration
    content: Run Prisma generate and db push to apply schema changes
    status: pending
    dependencies:
      - schema
---

# Chat Backend Service Implementation Plan

## Overview

Create a modular chat backend service in `backend/chat/` that provides real-time messaging, conversation management, and message persistence. The service will integrate with the existing Express server and support both JWT and header-based authentication.

## Architecture

```
backend/
├── chat/
│   ├── index.js              # Main chat service entry point
│   ├── routes.js             # HTTP API routes
│   ├── websocket.js          # Socket.IO server setup
│   ├── auth.js               # Authentication middleware (JWT + headers)
│   ├── services/
│   │   ├── conversation.js   # Conversation business logic
│   │   ├── message.js        # Message business logic
│   │   └── sync.js           # Message sync logic
│   └── utils/
│       └── validation.js     # Input validation helpers
├── prisma/
│   └── schema.prisma         # Updated with chat models
└── server.js                 # Mount chat service
```

## Implementation Steps

### 1. Database Schema Updates

**File: `backend/prisma/schema.prisma`**

Add chat-related models:

- `Conversation`: Stores conversation metadata (id, createdAt, updatedAt, optional context fields)
- `ConversationParticipant`: Many-to-many relationship (conversationId, userId, joinedAt)
- `Message`: Stores messages (id, conversationId, senderId, type, content, mediaUrl, clientMessageId, createdAt)
- `ConversationReadState`: Tracks last read message per user (conversationId, userId, lastReadMessageId, readAt)

Key constraints:

- Unique constraint on `(conversationId, senderId, clientMessageId)` for idempotency
- Indexes on `(conversationId, createdAt)` for efficient message queries
- Foreign key relationships to User model

### 2. Dependencies Installation

**File: `backend/package.json`**

Add dependencies:

- `socket.io` - WebSocket library
- `jsonwebtoken` - JWT support (optional, for future)
- `uuid` - Generate message IDs server-side

### 3. Authentication Middleware

**File: `backend/chat/auth.js`**

Create middleware that supports:

- JWT token from `Authorization: Bearer <token>` header (preferred)
- Fallback to existing header-based auth (`x-user-role`, `x-user-id`, `x-user-name`)
- Extract user info and attach to `req.user` and socket `socket.user`
- Reject unauthenticated requests

### 4. Chat Service Module

**File: `backend/chat/index.js`**

Main entry point that:

- Initializes Socket.IO server
- Sets up HTTP routes
- Exports `mountChatService(app, httpServer)` function
- Handles WebSocket authentication on connection

### 5. HTTP API Routes

**File: `backend/chat/routes.js`**

Implement REST endpoints:

- `POST /chat/conversations` - Create conversation (with duplicate prevention)
- `GET /chat/conversations` - List user's conversations with last message and unread count
- `POST /chat/messages` - Send message (text/image/video via URL)
- `GET /chat/messages?conversationId=X&afterMessageId=Y` - Sync messages
- `POST /chat/conversations/:id/read` - Mark conversation as read

All routes use authentication middleware.

### 6. WebSocket Server

**File: `backend/chat/websocket.js`**

Socket.IO setup:

- Authenticate connections using auth middleware
- Store user-to-socket mapping for message routing
- Handle events:
  - `send_message` - Receive message from client, persist, acknowledge, deliver
  - `send_ack` - Client acknowledges receipt (optional)
- Emit events:
  - `message` - Deliver message to recipient if online
  - `send_ack` - Acknowledge message receipt with server-generated ID
- Handle disconnection cleanup

### 7. Business Logic Services

**File: `backend/chat/services/conversation.js`**

- `createConversation(userId1, userId2, context?)` - Create or find existing conversation
- `getUserConversations(userId)` - List with last message and unread counts
- `markAsRead(conversationId, userId, messageId)` - Update read state

**File: `backend/chat/services/message.js`**

- `sendMessage(conversationId, senderId, type, content, mediaUrl?, clientMessageId?)` - Persist and return message
- `getMessages(conversationId, afterMessageId?, limit?)` - Fetch messages for sync
- `validateMessage(type, content, mediaUrl)` - Input validation

**File: `backend/chat/services/sync.js`**

- `getMissedMessages(userId, conversationId, afterMessageId)` - Return messages after cursor

### 8. Server Integration

**File: `backend/server.js`**

Modifications:

- Import `http` module to create HTTP server
- Create HTTP server from Express app: `const httpServer = http.createServer(app)`
- Import and mount chat service: `mountChatService(app, httpServer)`
- Update `app.listen()` to use `httpServer.listen()` instead

### 9. Frontend Integration

**File: `client/src/utils/api.js`**

Add chat API methods:

- `createConversation(otherUserId, context?)`
- `getConversations()`
- `sendMessage(conversationId, type, content, mediaUrl?, clientMessageId?)`
- `getMessages(conversationId, afterMessageId?)`
- `markAsRead(conversationId, messageId)`

**File: `client/src/context/ChatContext.jsx`**

Enhance to:

- Connect to Socket.IO server
- Handle real-time message events
- Manage conversation state
- Implement reconnection logic with sync

**File: `client/src/pages/ChatPage.jsx`**

Update to:

- Fetch conversations from API instead of mock data
- Connect to WebSocket for real-time updates
- Send messages via WebSocket
- Sync missed messages on reconnect

### 10. Error Handling & Validation

- Validate message types (text, image, video)
- Validate media URLs (format, size limits)
- Handle duplicate message sends (idempotency)
- Return appropriate HTTP status codes
- Log errors for observability

### 11. Database Migration

After schema updates:

- Run `npx prisma generate`
- Run `npx prisma db push`

## Data Flow

```
Client → HTTP POST /chat/messages
  ↓
Auth Middleware (JWT or headers)
  ↓
Message Service (validate, persist)
  ↓
WebSocket Server (check if recipient online)
  ↓
If online: Emit 'message' event
If offline: Message delivered on next sync
```

## Key Features

1. **Idempotency**: `clientMessageId` prevents duplicate messages on retries
2. **Reliability**: Messages persisted before delivery attempt
3. **Sync**: Clients can request messages after a known cursor
4. **Read State**: Track last read message per user per conversation
5. **Real-time**: Socket.IO delivers messages instantly to online users

## Testing Considerations

- Test conversation creation with duplicate prevention
- Test message sending and persistence
- Test WebSocket delivery to online users
- Test sync API for missed messages
- Test idempotency with duplicate clientMessageId
- Test authentication (JWT and headers)

## Future Enhancements (Out of Scope)

- Group chats
- Message search
- Push notifications
- Redis-based routing for horizontal scaling
- Media moderation