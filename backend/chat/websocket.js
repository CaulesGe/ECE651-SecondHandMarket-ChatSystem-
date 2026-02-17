// Socket.IO server for real-time chat delivery.
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { authenticateSocket } from "./auth.js";
import { sendMessage } from "./services/message.js";

// Track connected sockets per user for routing.
const userSockets = new Map();
const prisma = new PrismaClient();

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
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  sockets.forEach((socket) => {
    socket.emit(event, payload);
  });
};

// Initialize Socket.IO for the chat service.
export const initChatSocket = (httpServer) => {
  // Configure Socket.IO with CORS for local dev.
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

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
        if (typeof callback === "function") {
          callback(ackPayload);
        }

        // Fan out to all participants so sender's other tabs and recipients stay in sync.
        const participants = await prisma.conversationParticipant.findMany({
          where: { conversationId: payload.conversationId },
          select: { userId: true }
        });
        const targetUserIds = new Set(participants.map((p) => p.userId));
        // Keep backward compatibility if recipientId is provided by older clients.
        if (payload.recipientId) {
          targetUserIds.add(payload.recipientId);
        }
        targetUserIds.forEach((targetUserId) => {
          emitToUser(targetUserId, "message", { message });
        });
      } catch (error) {
        if (typeof callback === "function") {
          callback({ error: error.message || "Failed to send message" });
        }
      }
    });

    // Optional client acknowledgement handler.
    socket.on("send_ack", () => {
      // Reserved for future delivery tracking.
    });

    // Clean up on disconnect.
    socket.on("disconnect", () => {
      removeUserSocket(userId, socket);
    });
  });

  return io;
};
