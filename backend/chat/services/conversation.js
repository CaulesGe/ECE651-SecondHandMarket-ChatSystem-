// Prisma client for database access.
import { PrismaClient } from "@prisma/client";

// Instantiate Prisma once for the chat service module.
const prisma = new PrismaClient();

// Normalize undefined to null so Prisma filters match optional fields.
const normalizeContext = (value) => (value === undefined ? null : value);

// Build a context filter for (orderId, itemId) scoped conversations.
const buildContextWhere = (contextOrderId, contextItemId) => ({
  contextOrderId: normalizeContext(contextOrderId),
  contextItemId: normalizeContext(contextItemId)
});

// Create or return an existing conversation between two users and optional context.
export const createConversation = async ({
  userId,
  otherUserId,
  contextOrderId,
  contextItemId
}) => {
  // Validate participants and prevent self-conversation.
  if (!userId || !otherUserId || userId === otherUserId) {
    throw new Error("Invalid participants");
  }

  // Ensure the context fields are part of the uniqueness check.
  const contextWhere = buildContextWhere(contextOrderId, contextItemId);

  // Check for an existing conversation between the same participants and context.
  const existing = await prisma.conversation.findFirst({
    where: {
      ...contextWhere,
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: otherUserId } } }
      ]
    },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } }
        }
      }
    }
  });

  // Return existing conversation if found.
  if (existing) return existing;

  // Create a new conversation with both participants.
  return prisma.conversation.create({
    data: {
      ...contextWhere,
      participants: {
        create: [{ userId }, { userId: otherUserId }]
      }
    },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } }
        }
      }
    }
  });
};

// Note: We use the last read message's createdAt (when it was sent), not readAt (when user marked it read),
// to correctly count messages sent between the last read message and when the user actually read it.
// Example: A @10:00, B @10:05, user reads at 10:10 -> using createdAt counts B; using readAt would miss it.

// List conversations for a user with last message and unread count.
export const getUserConversations = async (userId) => {
  // Load conversations with participants and the latest message.
  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } }
        }
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      readStates: {
        where: { userId }
      }
    }
  });

  const enriched = [];
  for (const convo of conversations) {
    // Select the latest message and the user's read state.
    const lastMessage = convo.messages[0] || null;
    const readState = convo.readStates[0] || null;
    
    // Resolve the createdAt time of the last-read message for filtering.
    // Note: We use the message's createdAt (when it was sent), not readAt (when user marked it read),
    // to correctly count messages sent between the last read message and when the user actually read it.
    const lastReadCreatedAt = readState?.lastReadMessageCreatedAt || null;

    // Count unread messages from other users after last read.
    const unreadWhere = {
      conversationId: convo.id,
      senderId: { not: userId }
    };

    if (lastReadCreatedAt) {
      unreadWhere.createdAt = { gt: lastReadCreatedAt };
    }

    // Compute unread count.
    const unreadCount = await prisma.message.count({ where: unreadWhere });

    // Attach lastMessage + unreadCount in the response.
    enriched.push({
      ...convo,
      lastMessage,
      unreadCount
    });
  }

  return enriched;
};

// Mark a conversation as read for a user with the latest message id.
export const markConversationRead = async ({
  conversationId,
  userId,
  lastReadMessageId
}) => {
  // Validate required identifiers.
  if (!conversationId || !userId) {
    throw new Error("Missing conversationId or userId");
  }

  // Resolve the last-read message createdAt for fast unread count calculation.
  let lastReadMessageCreatedAt = null;
  if (lastReadMessageId) {
    const message = await prisma.message.findUnique({
      where: { id: lastReadMessageId },
      select: { createdAt: true }
    });
    lastReadMessageCreatedAt = message?.createdAt || null;
  }

  // Upsert the read state to track last-read message and timestamp.
  // update or create the read state for the conversation and user
  return prisma.conversationReadState.upsert({
    where: {
      conversationId_userId: { conversationId, userId }
    },
    update: {
      lastReadMessageId,
      lastReadMessageCreatedAt,
      readAt: new Date()
    },
    create: {
      conversationId,
      userId,
      lastReadMessageId,
      lastReadMessageCreatedAt,
      readAt: new Date()
    }
  });
};
