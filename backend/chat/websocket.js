// Socket.IO server for real-time chat delivery.
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { PrismaClient } from "@prisma/client";
import { authenticateSocket } from "./auth.js";
import { sendMessage, withdrawMessage } from "./services/message.js";
import { getRedisClient, isRedisAvailable } from "../utils/redis.js";

// Track connected sockets per user for routing.
const userSockets = new Map();
const userTypingConversation = new Map();
let socketServer = null;
const prisma = new PrismaClient();
const PRESENCE_TTL_SECONDS = 45; // time for the presence to be considered expired
const PRESENCE_HEARTBEAT_MS = 15000; // time for the presence heartbeat to be considered expired
const TYPING_TTL_SECONDS = 6; // time for the typing to be considered expired

// get the presence key for the user
const getPresenceKey = (userId) => `chat:presence:${userId}`;
// get the typing key for the conversation and user
const getUserTypingKeyByConversation = (conversationId, userId) => `chat:typing:${conversationId}:${userId}`;
const getUserTypingKey = (userId) => `chat:typing:${userId}`;
const getUserRoom = (userId) => `user:${userId}`;
const getRedisIfAvailable = () => {
  if (!isRedisAvailable()) return null;
  return getRedisClient() || null;
};
const getLocalPresenceByUserIds = (userIds) => userIds.reduce((acc, userId) => {
  acc[userId] = Boolean(userSockets.get(userId)?.size);
  return acc;
}, {});
const reply = (callback, payload) => {
  if (typeof callback === "function") callback(payload);
};

// Add a socket to the in-memory user map.
const addUserSocket = (userId, socket) => {
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socket);
};

// Remove a socket from the in-memory user map.
const removeUserSocket = (userId, socket) => {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) {
    userSockets.delete(userId);
  }
};

// Emit an event to all sockets belonging to a user.
const emitToUser = (userId, event, payload) => {
  if (socketServer) {
    // Room emits are adapter-aware, so this reaches sockets across pods.
    socketServer.to(getUserRoom(userId)).emit(event, payload);
    return;
  }
  // Fallback path before Socket.IO server is initialized.
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  sockets.forEach((socket) => socket.emit(event, payload));
};

const getConversationParticipantUserIds = async (conversationId) => {
  if (!conversationId) return [];
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true }
  });
  return participants.map((participant) => participant.userId);
};

const isConversationParticipant = async (conversationId, userId) => {
  if (!conversationId || !userId) return false;
  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId },
    select: { id: true }
  });
  return Boolean(participant);
};

const publishPresenceHeartbeat = async (userId) => {
  const redisClient = getRedisIfAvailable();
  if (!redisClient || !userId) return;
  try {
    await redisClient.set(getPresenceKey(userId), "1", { EX: PRESENCE_TTL_SECONDS });
  } catch (error) {
    console.warn("[chat-socket] failed to update presence heartbeat:", error?.message || error);
  }
};

// get the presence by the user ids
const getPresenceByUserIds = async (userIds) => {
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
  if (uniqueUserIds.length === 0) return {};

  const redisClient = getRedisIfAvailable();
  if (!redisClient) return getLocalPresenceByUserIds(uniqueUserIds);

  try {
    const keys = uniqueUserIds.map((userId) => getPresenceKey(userId));
    // get the presence by the user ids from the Redis
    const values = await redisClient.mGet(keys);
    // get the presence by the user ids from the Redis
    return uniqueUserIds.reduce((acc, userId, index) => {
      acc[userId] = Boolean(values?.[index]);
      return acc;
    }, {});
  } catch (error) {
    console.warn("[chat-socket] failed to read presence state:", error?.message || error);
    return getLocalPresenceByUserIds(uniqueUserIds);
  }
};

const emitPresenceChangedToPeers = async (userId, isOnline) => {
  // find all conversation peers for this user and push status updates
  const memberships = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true }
  });
  const conversationIds = [...new Set(memberships.map((item) => item.conversationId))];
  if (conversationIds.length === 0) return;

  const peers = await prisma.conversationParticipant.findMany({
    where: {
      conversationId: { in: conversationIds },
      userId: { not: userId }
    },
    select: { userId: true }
  });
  const peerUserIds = [...new Set(peers.map((item) => item.userId))];
  peerUserIds.forEach((peerUserId) => {
    emitToUser(peerUserId, "presence_changed", { userId, isOnline });
  });
};

// list the typing users for the conversation
const listTypingUsers = async (conversationId) => {
  if (!conversationId) return [];
  const redisClient = getRedisIfAvailable();
  if (!redisClient) return [];

  const prefix = `chat:typing:${conversationId}:`;
  let cursor = "0";
  const userIds = new Set();
  try {
    do {
      // scan the Redis for the typing users for the conversation
      const scanResult = await redisClient.scan(cursor, {
        MATCH: `${prefix}*`,
        COUNT: 100
      });
      cursor = scanResult.cursor;
      // get the user ids from the keys
      (scanResult.keys || []).forEach((key) => {
        const userId = key.slice(prefix.length);
        if (userId) userIds.add(userId);
      });
    } while (cursor !== "0");
  } catch (error) {
    console.warn("[chat-socket] failed to list typing users:", error?.message || error);
  }
  return Array.from(userIds);
};

// get the active typing conversation for the user
const getActiveTypingConversationId = async (userId) => {
  if (!userId) return null;
  const redisClient = getRedisIfAvailable();
  if (!redisClient) return userTypingConversation.get(userId) || null;
  try {
    return (await redisClient.get(getUserTypingKey(userId))) || null;
  } catch (error) {
    console.warn("[chat-socket] failed to read active typing conversation:", error?.message || error);
    return userTypingConversation.get(userId) || null;
  }
};

// set the typing state for the user based on the conversation
const setRedisTypingState = async ({ conversationId, userId, isTyping }) => {
  const redisClient = getRedisIfAvailable();
  if (!redisClient || !conversationId || !userId) return;
  const typingKey = getUserTypingKeyByConversation(conversationId, userId);
  // set the typing state for the conversation and user
  try {
    if (isTyping) {
      await redisClient.set(typingKey, "1", { EX: TYPING_TTL_SECONDS });
    } else {
      await redisClient.del(typingKey);
    }
  } catch (error) {
    console.warn("[chat-socket] failed to update typing state:", error?.message || error);
  }
};


// emit the typing changed event to the conversation peers
const emitTypingChangedToConversationPeers = async ({ conversationId, userId, isTyping }) => {
  if (!conversationId || !userId) return;
  const participantUserIds = await getConversationParticipantUserIds(conversationId);
  // emit the typing changed event to the conversation peers
  participantUserIds
    .filter((participantUserId) => participantUserId !== userId)
    .forEach((participantUserId) => {
      emitToUser(participantUserId, "typing_changed", {
        conversationId,
        userId,
        isTyping,
        expiresInSeconds: TYPING_TTL_SECONDS
      });
    });
};

const clearTypingForConversationAndNotifyPeers = async (conversationId, userId) => {
  if (!conversationId || !userId) return;
  await setRedisTypingState({ conversationId, userId, isTyping: false });
  await emitTypingChangedToConversationPeers({ conversationId, userId, isTyping: false });
};

const setUserTypingConversation = async (userId, conversationId) => {
  if (!userId) return; 
  if (conversationId) {
    userTypingConversation.set(userId, conversationId);
  } else {
    // when the user is not typing, we need to clear the active typing conversation
    userTypingConversation.delete(userId);
  }

  const redisClient = getRedisIfAvailable();
  if (!redisClient) return;
  try {
    if (conversationId) {
      await redisClient.set(getUserTypingKey(userId), conversationId, { EX: TYPING_TTL_SECONDS });
    } else {
      await redisClient.del(getUserTypingKey(userId));
    }
  } catch (error) {
    console.warn("[chat-socket] failed to update active typing conversation:", error?.message || error);
  }
};


// clear the typing state for the user and notify the peers
const clearTypingForUserAndNotifyPeers = async (userId) => {
  const activeConversationId = await getActiveTypingConversationId(userId);
  if (!activeConversationId) return;
  // clear the typing state for the conversation and notify the peers
  await clearTypingForConversationAndNotifyPeers(activeConversationId, userId);
  // clear the active typing conversation for the user
  await setUserTypingConversation(userId, null);
};

// Initialize Socket.IO for the chat service.
export const initChatSocket = (httpServer) => {
  // Configure Socket.IO with CORS for local dev.
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });
  socketServer = io;

  // Authenticate all incoming socket connections.
  io.use(authenticateSocket);

  // Handle socket connections.
  io.on("connection", (socket) => {
    const userId = socket.user?.id;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    // Track socket for the authenticated user.
    addUserSocket(userId, socket);
    // join the user to the room in the Redis
    socket.join(getUserRoom(userId));
    // publish the presence heartbeat
    publishPresenceHeartbeat(userId).catch(() => {});
    emitPresenceChangedToPeers(userId, true).catch(() => {});
    // set the presence heartbeat for each interval
    const presenceHeartbeatInterval = setInterval(() => {
      publishPresenceHeartbeat(userId).catch(() => {});
    }, PRESENCE_HEARTBEAT_MS);
    // handle the presence subscribe event
    
    // returns the presence and typing state for the conversation
    socket.on("presence_subscribe", async (payload = {}, callback) => {
      try {
        const conversationId = payload?.conversationId;
        if (!conversationId) throw new Error("conversationId is required");
        const allowed = await isConversationParticipant(conversationId, userId);
        if (!allowed) throw new Error("Forbidden");

        const participantUserIds = await getConversationParticipantUserIds(conversationId);
        const presenceByUserId = await getPresenceByUserIds(participantUserIds);
        const typingUserIds = await listTypingUsers(conversationId);
        const response = {
          conversationId,
          presenceByUserId,
          typingUserIds
        };
        reply(callback, response);
      } catch (error) {
        reply(callback, { error: error.message || "Failed to load presence" });
      }
    });

    socket.on("typing", async (payload = {}, callback) => {
      try {
        const conversationId = payload?.conversationId;
        const isTyping = Boolean(payload?.isTyping);
        if (!conversationId) throw new Error("conversationId is required");
        const allowed = await isConversationParticipant(conversationId, userId);
        if (!allowed) throw new Error("Forbidden");

        if (isTyping) {
          // clear the active typing state for other conversation
          const activeConversationId = await getActiveTypingConversationId(userId);
          if (activeConversationId && activeConversationId !== conversationId) {
            await clearTypingForConversationAndNotifyPeers(activeConversationId, userId);
          }
          // set the typing state for the conversation and user
          await setRedisTypingState({ conversationId, userId, isTyping: true });
          await setUserTypingConversation(userId, conversationId);
          await emitTypingChangedToConversationPeers({ conversationId, userId, isTyping: true });
        } else {
          await clearTypingForConversationAndNotifyPeers(conversationId, userId);
          const activeConversationId = await getActiveTypingConversationId(userId);
          if (activeConversationId === conversationId) {
            await setUserTypingConversation(userId, null);
          }
        }
        reply(callback, { ok: true });
      } catch (error) {
        reply(callback, { error: error.message || "Failed to update typing state" });
      }
    });

    // Handle send_message events from clients.
    socket.on("send_message", async (payload = {}, callback) => {
      try {
        // Persist message before delivery.
        const message = await sendMessage({
          conversationId: payload.conversationId,
          senderId: userId,
          type: payload.type,
          content: payload.content,
          mediaObjectKey: payload.mediaObjectKey,
          clientMessageId: payload.clientMessageId
        });

        // Acknowledge receipt with server-generated ID.
        const ackPayload = {
          clientMessageId: payload.clientMessageId,
          messageId: message.id
        };
        socket.emit("send_ack", ackPayload);
        // return the ack payload to the client
        reply(callback, ackPayload);
        // clear the typing state for the conversation and user
        await setRedisTypingState({
          conversationId: payload.conversationId,
          userId,
          isTyping: false
        });
        const activeConversationId = await getActiveTypingConversationId(userId);
        if (activeConversationId === payload.conversationId) {
          await setUserTypingConversation(userId, null);
        }

        // Fan out to all participants so sender's other tabs and recipients stay in sync.
        const participantUserIds = await getConversationParticipantUserIds(payload.conversationId);
        const targetUserIds = new Set(participantUserIds);
        // Keep backward compatibility if recipientId is provided by older clients.
        if (payload.recipientId) {
          targetUserIds.add(payload.recipientId);
        }
        // send the message to the participants
        targetUserIds.forEach((targetUserId) => {
          emitToUser(targetUserId, "message", { message });
        });

        // Typing state updates are conversation-scoped and should only go to that conversation's participants.
        await emitTypingChangedToConversationPeers({
          conversationId: payload.conversationId,
          userId,
          isTyping: false
        });
      } catch (error) {
        reply(callback, { error: error.message || "Failed to send message" });
      }
    });

    // Handle withdraw_message events from sender (2-minute window enforcement is in service).
    socket.on("withdraw_message", async (payload = {}, callback) => {
      try {
        const message = await withdrawMessage({
          messageId: payload.messageId,
          userId
        });

        const targetUserIds = new Set(await getConversationParticipantUserIds(message.conversationId));
        targetUserIds.forEach((targetUserId) => {
          emitToUser(targetUserId, "message", { message });
        });

        reply(callback, { messageId: message.id });
      } catch (error) {
        reply(callback, { error: error.message || "Failed to withdraw message" });
      }
    });

    // Optional client acknowledgement handler.
    socket.on("send_ack", () => {
      // Reserved for future delivery tracking.
    });

    // Clean up on disconnect.
    socket.on("disconnect", () => {
      clearInterval(presenceHeartbeatInterval);
      removeUserSocket(userId, socket);
      if (!userSockets.get(userId)?.size) {
        clearTypingForUserAndNotifyPeers(userId).catch(() => {});
        emitPresenceChangedToPeers(userId, false).catch(() => {});
      }
    });
  });

  return io;
};

// Attach Redis adapter for cross-instance fanout.
export const tryAttachRedisAdapter = async (io) => {
  if (!io) return false;
  if (!isRedisAvailable()) {
    console.log("[chat-socket] redis adapter skipped (redis unavailable)");
    return false;
  }

  const redisClient = getRedisClient();
  if (!redisClient) {
    console.log("[chat-socket] redis adapter skipped (redis client missing)");
    return false;
  }

  try {
    // each replica of the backend subscribes the Redis and publishes to it
    // this is used to ensure that the messages are delivered to all replicas 
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log("[chat-socket] redis adapter enabled");
    return true;
  } catch (error) {
    console.warn("[chat-socket] failed to enable redis adapter:", error?.message || error);
    return false;
  }
};
