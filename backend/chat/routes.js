import express from "express";
import { authenticateHttp } from "./auth.js";
import {s3} from "../utils/s3.js";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import {
  createConversation,
  getUserConversations,
  hideConversationForUser,
  markConversationRead
} from "./services/conversation.js";
import { sendMessage, getMessages, withdrawMessage } from "./services/message.js";
import { deliverMessageRealtime } from "./websocket.js";

const prisma = new PrismaClient();
const CHAT_MEDIA_MAX_SIZE_BYTES = 100 * 1024 * 1024;
const CHAT_MEDIA_UPLOAD_EXPIRES_IN_SECONDS = 300;
const CHAT_MEDIA_DOWNLOAD_EXPIRES_IN_SECONDS = 300;
const ALLOWED_MEDIA_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime"
]);
const DEFAULT_EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov"
};

const normalizeExtension = (rawExtension, mimeType) => {
  if (!rawExtension) return DEFAULT_EXTENSION_BY_MIME[mimeType] || "bin";
  const sanitized = String(rawExtension).toLowerCase().replace(/^\./, "");
  if (!/^[a-z0-9]+$/.test(sanitized)) {
    throw new Error("Invalid file extension");
  }
  return sanitized;
};

const getChatMediaBucket = () => process.env.AWS_S3_BUCKET || process.env.AWS_BUCKET_NAME;
const parseConversationIdFromObjectKey = (key) => {
  const match = String(key).match(/^chat\/conversations\/([^/]+)\/users\/[^/]+\/[^/]+$/);
  return match?.[1] || null;
};

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

  // POST /chat/conversations/:id/hide - hide a conversation for the current user only.
  router.post("/conversations/:id/hide", async (req, res) => {
    try {
      const result = await hideConversationForUser({
        conversationId: req.params.id,
        userId: req.user.id
      });
      return res.json(result);
    } catch (error) {
      return res.status(400).json({ message: error.message || "Failed to hide conversation" });
    }
  });

  // POST /chat/media/presign-upload - return signed PUT URL for chat media upload.
  router.post("/media/presign-upload", async (req, res) => {
    try {
      const { conversationId, mimeType, size, extension } = req.body || {};
      if (!conversationId || !mimeType || size === undefined || size === null) {
        return res.status(400).json({ message: "conversationId, mimeType, and size are required" });
      }

      if (!ALLOWED_MEDIA_MIME_TYPES.has(mimeType)) {
        return res.status(400).json({ message: "Unsupported media MIME type" });
      }

      const numericSize = Number(size);
      if (!Number.isFinite(numericSize) || numericSize <= 0) {
        return res.status(400).json({ message: "Invalid media size" });
      }
      if (numericSize > CHAT_MEDIA_MAX_SIZE_BYTES) {
        return res.status(400).json({ message: "Media size exceeds 100MB limit" });
      }

      const participant = await prisma.conversationParticipant.findFirst({
        where: { conversationId, userId: req.user.id },
        select: { id: true }
      });
      if (!participant) {
        return res.status(403).json({ message: "Forbidden: not a conversation participant" });
      }

      const bucket = getChatMediaBucket();
      if (!bucket || !process.env.AWS_REGION) {
        return res.status(500).json({ message: "S3 upload is not configured" });
      }

      const ext = normalizeExtension(extension, mimeType);
      const objectKey = `chat/conversations/${conversationId}/users/${req.user.id}/${uuidv4()}.${ext}`;
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: mimeType
      });

      // client uploads media to S3 with the signed URL
      const uploadUrl = await getSignedUrl(s3, command, {
        expiresIn: CHAT_MEDIA_UPLOAD_EXPIRES_IN_SECONDS
      });

      return res.json({
        uploadUrl,
        objectKey,
        expiresIn: CHAT_MEDIA_UPLOAD_EXPIRES_IN_SECONDS
      });
    } catch (error) {
      return res.status(400).json({ message: error.message || "Failed to generate upload URL" });
    }
  });

  // GET /chat/media/sign-download?key=... - return short-lived signed GET URL.
  router.get("/media/sign-download", async (req, res) => {
    try {
      const key = String(req.query?.key || "").trim();
      if (!key) {
        return res.status(400).json({ message: "key query parameter is required" });
      }

      const conversationId = parseConversationIdFromObjectKey(key);
      if (!conversationId) {
        return res.status(400).json({ message: "Invalid media object key format" });
      }

      // check if the user is a participant of the conversation
      const participant = await prisma.conversationParticipant.findFirst({
        where: { conversationId, userId: req.user.id },
        select: { id: true }
      });
      if (!participant) {
        return res.status(403).json({ message: "Forbidden: not a conversation participant" });
      }
      
      const bucket = getChatMediaBucket();
      if (!bucket || !process.env.AWS_REGION) {
        return res.status(500).json({ message: "S3 download signing is not configured" });
      }

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      });
      const downloadUrl = await getSignedUrl(s3, command, {
        expiresIn: CHAT_MEDIA_DOWNLOAD_EXPIRES_IN_SECONDS
      });

      return res.json({
        downloadUrl,
        expiresIn: CHAT_MEDIA_DOWNLOAD_EXPIRES_IN_SECONDS
      });
    } catch (error) {
      return res.status(400).json({ message: error.message || "Failed to generate download URL" });
    }
  });


  // POST /chat/messages - send a message (text/image/video).
  router.post("/messages", async (req, res) => {
    try {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, "mediaUrl")) {
        return res.status(400).json({ message: "mediaUrl is deprecated. Use mediaObjectKey." });
      }

      const {
        conversationId,
        type,
        content,
        mediaObjectKey,
        clientMessageId
      } = req.body || {};

      const message = await sendMessage({
        conversationId,
        senderId: req.user.id,
        type,
        content,
        mediaObjectKey,
        clientMessageId
      });

      await deliverMessageRealtime({
        conversationId,
        message
      });

      return res.status(201).json({ message });
    } catch (error) {
      return res.status(400).json({ message: error.message || "Failed to send message" });
    }
  });


  // GET /chat/messages - sync messages using sequence-number cursors.
  router.get("/messages", async (req, res) => {
    try {
      const {
        conversationId,
        lastReceivedMessageSequenceNumber,
        oldestLoadedMessageSequenceNumber,
        limit
      } = req.query || {};
      const items = await getMessages({
        userId: req.user.id,
        conversationId,
        lastReceivedMessageSequenceNumber,
        oldestLoadedMessageSequenceNumber,
        limit: limit ? Number(limit) : undefined
      });
      return res.json({ items });
    } catch (error) {
      return res.status(400).json({ message: error.message || "Failed to load messages" });
    }
  });

  // POST /chat/messages/:id/withdraw - withdraw own message within 2 minutes.
  router.post("/messages/:id/withdraw", async (req, res) => {
    try {
      const updatedMessage = await withdrawMessage({
        messageId: req.params.id,
        userId: req.user.id
      });
      return res.json({ message: updatedMessage });
    } catch (error) {
      return res.status(400).json({ message: error.message || "Failed to withdraw message" });
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
