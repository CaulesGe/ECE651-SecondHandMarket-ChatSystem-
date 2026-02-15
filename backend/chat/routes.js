import express from "express";
import { authenticateHttp } from "./auth.js";
import {
  createConversation,
  getUserConversations,
  markConversationRead
} from "./services/conversation.js";
import { sendMessage, getMessages } from "./services/message.js";

// Create and configure the chat router.
export const createChatRouter = () => {
  const router = express.Router();

  // Ensure all chat endpoints require authentication.
  router.use(authenticateHttp);

  // POST /chat/conversations - create or find conversation for two users.
  router.post("/conversations", async (req, res) => {
    try {
      const { otherUserId, contextOrderId, contextItemId } = req.body || {};
      const conversation = await createConversation({
        userId: req.user.id,
        otherUserId,
        contextOrderId,
        contextItemId
      });
      return res.status(201).json({ conversation });
    } catch (error) {
      return res.status(400).json({ message: error.message || "Failed to create conversation" });
    }
  });

  // GET /chat/conversations - list conversations for authenticated user.
  router.get("/conversations", async (req, res) => {
    try {
      const items = await getUserConversations(req.user.id);
      return res.json({ items });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Failed to load conversations" });
    }
  });

  // POST /chat/messages - send a message (text/image/video).
  router.post("/messages", async (req, res) => {
    try {
      const {
        conversationId,
        type,
        content,
        mediaUrl,
        clientMessageId
      } = req.body || {};

      const message = await sendMessage({
        conversationId,
        senderId: req.user.id,
        type,
        content,
        mediaUrl,
        clientMessageId
      });

      return res.status(201).json({ message });
    } catch (error) {
      return res.status(400).json({ message: error.message || "Failed to send message" });
    }
  });

  // GET /chat/messages - sync messages after a cursor.
  router.get("/messages", async (req, res) => {
    try {
      const { conversationId, afterMessageId, limit } = req.query || {};
      const items = await getMessages({
        userId: req.user.id,
        conversationId,
        afterMessageId,
        limit: limit ? Number(limit) : undefined
      });
      return res.json({ items });
    } catch (error) {
      return res.status(400).json({ message: error.message || "Failed to load messages" });
    }
  });

  // POST /chat/conversations/:id/read - mark conversation as read.
  router.post("/conversations/:id/read", async (req, res) => {
    try {
      const { id } = req.params;
      const { lastReadMessageId } = req.body || {};
      const state = await markConversationRead({
        conversationId: id,
        userId: req.user.id,
        lastReadMessageId
      });
      return res.json({ state });
    } catch (error) {
      return res.status(400).json({ message: error.message || "Failed to mark conversation as read" });
    }
  });

  return router;
};
