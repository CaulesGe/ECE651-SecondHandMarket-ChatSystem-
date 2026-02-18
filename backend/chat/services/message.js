// Message service: validation, persistence, and retrieval.
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

// Instantiate Prisma once for the chat service module.
const prisma = new PrismaClient();
const WITHDRAW_WINDOW_MS = 2 * 60 * 1000;

// Supported message types.
const ALLOWED_TYPES = new Set(["text", "image", "video"]);

// Basic object-key validation for media messages.
const isValidObjectKey = (value) => typeof value === "string" && value.trim().length > 0;

// Validate message payload and return a normalized shape.
export const validateMessage = ({ type, content, mediaObjectKey }) => {
  if (!type || !ALLOWED_TYPES.has(type)) {
    throw new Error("Unsupported message type");
  }

  if (type === "text") {
    if (!content || !content.trim()) {
      throw new Error("Text message content required");
    }
    return { type, content: content.trim(), mediaObjectKey: null };
  }

  if (!mediaObjectKey || !isValidObjectKey(mediaObjectKey)) {
    throw new Error("Valid media object key required");
  }

  return { type, content: content?.trim() || null, mediaObjectKey: mediaObjectKey.trim() };
};

// Persist and return a new message.
export const sendMessage = async ({
  conversationId,
  senderId,
  type,
  content,
  mediaObjectKey,
  clientMessageId
}) => {
  if (!conversationId || !senderId) {
    throw new Error("Missing conversationId or senderId");
  }

  // Ensure the sender is part of the conversation.
  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: senderId }
  });
  if (!participant) {
    throw new Error("Sender is not a participant of this conversation");
  }

  // Normalize and validate payload fields.
  const normalized = validateMessage({ type, content, mediaObjectKey });

  // Use clientMessageId for idempotency; generate one if missing.
  const safeClientMessageId = clientMessageId || uuidv4();

  try {
    // Create message; unique constraint prevents duplicates.
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId,
        type: normalized.type,
        content: normalized.content,
        mediaObjectKey: normalized.mediaObjectKey,
        clientMessageId: safeClientMessageId
      }
    });

    // Touch conversation updatedAt for ordering.
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    return message;
  } catch (error) {
    // If this is a duplicate due to idempotency, return the existing message.
    const existing = await prisma.message.findFirst({
      where: { conversationId, senderId, clientMessageId: safeClientMessageId }
    });
    if (existing) return existing;
    throw error;
  }
};

// Withdraw a sent message if sender requests within the allowed time window.
export const withdrawMessage = async ({ messageId, userId }) => {
  if (!messageId || !userId) {
    throw new Error("Missing messageId or userId");
  }

  const existing = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      createdAt: true,
      isWithdrawn: true
    }
  });

  if (!existing) {
    throw new Error("Message not found");
  }
  if (existing.senderId !== userId) {
    throw new Error("Only the sender can withdraw this message");
  }
  if (existing.isWithdrawn) {
    throw new Error("Message already withdrawn");
  }
  if (Date.now() - new Date(existing.createdAt).getTime() > WITHDRAW_WINDOW_MS) {
    throw new Error("Withdrawal window expired (2 minutes)");
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: {
      isWithdrawn: true,
      withdrawnAt: new Date(),
      content: null,
      mediaObjectKey: null
    }
  });

  await prisma.conversation.update({
    where: { id: existing.conversationId },
    data: { updatedAt: new Date() }
  });

  return updated;
};

// Fetch/sync messages for a conversation, optionally after a cursor.
// - validates participant authorization
// - validates cursor ownership
// - returns replay-ordered messages
export const getMessages = async ({
  userId,
  conversationId,
  afterMessageId,
  limit = 100
}) => {
  if (!userId || !conversationId) {
    throw new Error("Missing userId or conversationId");
  }

  // Ensure the requesting user belongs to the conversation.
  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId }
  });
  if (!participant) {
    throw new Error("User is not a participant of this conversation");
  }

  // Resolve cursor timestamp if a cursor message id is provided.
  let afterCreatedAt = null;
  if (afterMessageId) {
    const cursorMessage = await prisma.message.findUnique({
      where: { id: afterMessageId },
      select: { createdAt: true, conversationId: true }
    });

    // If cursor exists, verify it belongs to the target conversation.
    if (cursorMessage) {
      if (cursorMessage.conversationId !== conversationId) {
        throw new Error("Cursor does not belong to the conversation");
      }
      afterCreatedAt = cursorMessage.createdAt;
    }
  }

  // Build sync filter for messages after cursor.
  const where = { conversationId };
  if (afterCreatedAt) {
    where.createdAt = { gt: afterCreatedAt };
  }

  // Return messages in ascending order for deterministic replay.
  return prisma.message.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: Math.min(Math.max(Number(limit) || 100, 1), 500)
  });
};
