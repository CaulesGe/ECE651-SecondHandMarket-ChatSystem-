PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS "ConversationReadState";
DROP TABLE IF EXISTS "Message";
DROP TABLE IF EXISTS "ConversationParticipant";
DROP TABLE IF EXISTS "Conversation";
DROP TABLE IF EXISTS "TransactionItem";
DROP TABLE IF EXISTS "Transaction";
DROP TABLE IF EXISTS "Draft";
DROP TABLE IF EXISTS "Goods";
DROP TABLE IF EXISTS "User";

CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "verificationToken" TEXT,
  "verificationExpires" DATETIME,
  CONSTRAINT "User_verificationToken_key" UNIQUE ("verificationToken")
);

CREATE TABLE "Goods" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "price" REAL NOT NULL,
  "condition" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "images" TEXT,
  "sellerId" TEXT,
  "sellerName" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "listedAt" DATETIME NOT NULL
);

CREATE TABLE "Draft" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "price" REAL,
  "condition" TEXT,
  "category" TEXT,
  "images" TEXT,
  "location" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Draft_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX "Draft_userId_updatedAt_idx" ON "Draft"("userId", "updatedAt");

CREATE TABLE "Transaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "total" REAL NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL,
  "last4" TEXT,
  CONSTRAINT "Transaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE TABLE "TransactionItem" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "transactionId" TEXT NOT NULL,
  "goodsId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "price" REAL NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "TransactionItem_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "contextOrderId" TEXT,
  "contextItemId" TEXT
);

CREATE TABLE "ConversationParticipant" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationParticipant_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT "ConversationParticipant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key"
ON "ConversationParticipant"("conversationId", "userId");

CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

CREATE TABLE "Message" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "content" TEXT,
  "mediaObjectKey" TEXT,
  "isWithdrawn" BOOLEAN NOT NULL DEFAULT false,
  "withdrawnAt" DATETIME,
  "clientMessageId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT "Message_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User" ("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Message_conversationId_senderId_clientMessageId_key"
ON "Message"("conversationId", "senderId", "clientMessageId");

CREATE INDEX "Message_conversationId_createdAt_idx"
ON "Message"("conversationId", "createdAt");

CREATE TABLE "ConversationReadState" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastReadMessageId" TEXT,
  "lastReadMessageCreatedAt" DATETIME,
  "readAt" DATETIME,
  CONSTRAINT "ConversationReadState_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT "ConversationReadState_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ConversationReadState_conversationId_userId_key"
ON "ConversationReadState"("conversationId", "userId");
