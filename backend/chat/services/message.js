// Message service: validation, persistence, and retrieval.
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import {
  buildMessagesCacheKey,
  CHAT_MESSAGES_CACHE_TTL_SECONDS,
  getCachedJson,
  setCachedJson,
  invalidateConversationCachesForUsers,
  invalidateMessageCachesForConversation
} from "../cache.js";

// Instantiate Prisma once for the chat service module.
const prisma = new PrismaClient();
const WITHDRAW_WINDOW_MS = 2 * 60 * 1000;
const CACHE_INVALIDATION_MAX_WAIT_MS = 300;

// Supported message types.
const ALLOWED_TYPES = new Set(["text", "image", "video"]);

// Basic object-key validation for media messages.
const isValidObjectKey = (value) => typeof value === "string" && value.trim().length > 0;

// create the pending deliveries for the message  
// uses tx because it is part of the transaction
// tx is the transaction object. If transaction fails, all changes are rolled back.
const createPendingDeliveries = async (tx, { conversationId, messageId, senderId }) => {
  if (!conversationId || !messageId || !senderId) return;

  const recipients = await tx.conversationParticipant.findMany({
    where: {
      conversationId,
      userId: { not: senderId }
    },
    select: { userId: true }
  });
  if (!recipients.length) return;

  await tx.messageDelivery.createMany({
    data: recipients.map(({ userId }) => ({
      messageId,
      recipientId: userId,
      status: "pending"
    }))
  });
};

const unhideConversationParticipants = async (tx, conversationId) => {
  if (!conversationId) return;

  await tx.conversationParticipant.updateMany({
    where: {
      conversationId,
      hiddenAt: { not: null }
    },
    data: { hiddenAt: null }
  });
};

// Allocate the next per-conversation sequence number inside the same transaction
// that creates the message so ordering stays atomic.
const allocateNextSequenceNumber = async (tx, conversationId) => {
  const conversation = await tx.conversation.update({
    where: { id: conversationId },
    data: {
      updatedAt: new Date(),
      nextMessageSequence: { increment: 1 }
    },
    select: {
      nextMessageSequence: true
    }
  });

  return conversation.nextMessageSequence - 1;
};

// invalidate the cached conversations and messages for the conversation because a new message was sent or a message was withdrawn
const invalidateConversationAndMessageCaches = async (conversationId) => {
  if (!conversationId) return;
  // get the participants of the conversation
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true }
  });
  const participantUserIds = participants.map((participant) => participant.userId);
  await Promise.all([
    invalidateConversationCachesForUsers(participantUserIds),
    invalidateMessageCachesForConversation(conversationId)
  ]);
};

const invalidateCachesBestEffort = (conversationId) => {
  if (!conversationId) return;
  
  Promise.race([
    invalidateConversationAndMessageCaches(conversationId),
    new Promise((resolve) => setTimeout(resolve, CACHE_INVALIDATION_MAX_WAIT_MS))
  ]).catch((error) => {
    console.warn("[chat-message] cache invalidation skipped:", error?.message || error);
  });
};

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
    // use transaction to create the message and the pending deliveries for atomicity
    const { message } = await prisma.$transaction(async (tx) => {
      const sequenceNumber = await allocateNextSequenceNumber(tx, conversationId);
      await unhideConversationParticipants(tx, conversationId);

      // Create message; unique constraint prevents duplicates.
      const createdMessage = await tx.message.create({
        data: {
          conversationId,
          senderId,
          sequenceNumber,
          type: normalized.type,
          content: normalized.content,
          mediaObjectKey: normalized.mediaObjectKey,
          clientMessageId: safeClientMessageId
        }
      });
      // create the pending deliveries for the message
      await createPendingDeliveries(tx, {
        conversationId,
        messageId: createdMessage.id,
        senderId
      });

      return { message: createdMessage };
    });
    // Keep message send latency bounded even if Redis/cache is unstable.
    invalidateCachesBestEffort(conversationId);

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

export const markMessageDeliveryDelivered = async ({
  conversationId,
  messageId,
  recipientId
}) => {
  if (!conversationId || !messageId || !recipientId) {
    throw new Error("Missing conversationId, messageId, or recipientId");
  }
  // check if the delivery record exists
  const existingDelivery = await prisma.messageDelivery.findUnique({
    where: {
      messageId_recipientId: {
        messageId,
        recipientId
      }
    },
    include: {
      message: {
        select: {
          conversationId: true
        }
      }
    }
  });
  if (!existingDelivery) {
    throw new Error("Delivery record not found");
  }
  if (existingDelivery.message?.conversationId !== conversationId) {
    throw new Error("Message does not belong to the conversation");
  }
  if (existingDelivery.status === "delivered") {
    return existingDelivery;
  }

  return prisma.messageDelivery.update({
    where: {
      messageId_recipientId: {
        messageId,
        recipientId
      }
    },
    data: {
      status: "delivered",
      deliveredAt: new Date()
    }
  });
};

export const listPendingMessageDeliveryRecipientIds = async ({ messageId }) => {
  if (!messageId) return [];

  const deliveries = await prisma.messageDelivery.findMany({
    where: {
      messageId,
      status: "pending"
    },
    select: {
      recipientId: true
    }
  });
  return deliveries.map((delivery) => delivery.recipientId);
};

export const listPendingMessagesForRecipient = async ({
  recipientId,
  conversationId = null
}) => {
  if (!recipientId) return [];

  const deliveries = await prisma.messageDelivery.findMany({
    where: {
      recipientId,
      status: "pending",
      ...(conversationId
        ? { message: { conversationId } }
        : {})
    },
    include: {
      message: true
    },
    orderBy: {
      message: {
        createdAt: "asc"
      }
    }
  });
  return deliveries
    .map((delivery) => delivery.message)
    .filter(Boolean);
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
  // Keep withdraw latency bounded even if Redis/cache is unstable.
  invalidateCachesBestEffort(existing.conversationId);

  return updated;
};

// Fetch/sync messages for a conversation, optionally after a cursor.
// - validates participant authorization
// - validates cursor ownership
// - returns replay-ordered messages
export const getMessages = async ({
  userId,
  conversationId,
  lastReceivedMessageSequenceNumber,
  oldestLoadedMessageSequenceNumber,
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

  if (
    lastReceivedMessageSequenceNumber !== undefined
    && lastReceivedMessageSequenceNumber !== null
    && lastReceivedMessageSequenceNumber !== ""
    && oldestLoadedMessageSequenceNumber !== undefined
    && oldestLoadedMessageSequenceNumber !== null
    && oldestLoadedMessageSequenceNumber !== ""
  ) {
    throw new Error(
      "Use either lastReceivedMessageSequenceNumber or oldestLoadedMessageSequenceNumber, not both"
    );
  }

  const parseOptionalSequenceNumber = (value, fieldName) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error(`${fieldName} must be a non-negative integer`);
    }

    return parsed;
  };

  const normalizedLastReceivedMessageSequenceNumber = parseOptionalSequenceNumber(
    lastReceivedMessageSequenceNumber,
    "lastReceivedMessageSequenceNumber"
  );
  const normalizedOldestLoadedMessageSequenceNumber = parseOptionalSequenceNumber(
    oldestLoadedMessageSequenceNumber,
    "oldestLoadedMessageSequenceNumber"
  );

  const normalizedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const cacheKey = buildMessagesCacheKey({
    conversationId,
    lastReceivedMessageSequenceNumber: normalizedLastReceivedMessageSequenceNumber,
    oldestLoadedMessageSequenceNumber: normalizedOldestLoadedMessageSequenceNumber,
    limit: normalizedLimit
  });
  const cached = await getCachedJson(cacheKey);
  if (cached) return cached;

  // Build sync filter for messages after/before cursor.
  const where = { conversationId };
  if (
    normalizedLastReceivedMessageSequenceNumber !== null
    && normalizedLastReceivedMessageSequenceNumber !== undefined
  ) {
    where.sequenceNumber = { gt: normalizedLastReceivedMessageSequenceNumber };
  } else if (
    normalizedOldestLoadedMessageSequenceNumber !== null
    && normalizedOldestLoadedMessageSequenceNumber !== undefined
  ) {
    where.sequenceNumber = { lt: normalizedOldestLoadedMessageSequenceNumber };
  }

  let items = [];
  if (
    normalizedLastReceivedMessageSequenceNumber !== null
    && normalizedLastReceivedMessageSequenceNumber !== undefined
  ) {
    // Incremental sync for new messages.
    items = await prisma.message.findMany({
      where,
      orderBy: { sequenceNumber: "asc" },
      take: normalizedLimit
    });
  } else {
    // Initial load and "load older" both fetch from newest side then reverse for UI replay order.
    items = await prisma.message.findMany({
      where,
      orderBy: { sequenceNumber: "desc" },
      take: normalizedLimit
    });
    items.reverse();
  }
  // set the cached messages for the conversation in the Redis
  await setCachedJson(cacheKey, items, CHAT_MESSAGES_CACHE_TTL_SECONDS);
  return items;
};
