import { getRedisClient, isRedisAvailable } from "../utils/redis.js";

const toPositiveInt = (rawValue, fallback) => {
  const parsed = Number.parseInt(String(rawValue ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const CHAT_CONVERSATIONS_CACHE_TTL_SECONDS = toPositiveInt(
  process.env.CHAT_CACHE_CONVERSATIONS_TTL_SECONDS,
  15
);
export const CHAT_MESSAGES_CACHE_TTL_SECONDS = toPositiveInt(
  process.env.CHAT_CACHE_MESSAGES_TTL_SECONDS,
  10
);

export const buildConversationCacheKey = (userId) => `chat:conv:user:${userId}`;

export const buildMessagesCacheKey = ({
  conversationId,
  afterMessageId = "none",
  beforeMessageId = "none",
  limit = 100
}) => `chat:msgs:conv:${conversationId}:after:${afterMessageId || "none"}:before:${beforeMessageId || "none"}:limit:${limit}`;

// get the cached json from the Redis
export const getCachedJson = async (key) => {
  if (!isRedisAvailable()) return null;
  const client = getRedisClient();
  if (!client) return null;
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn("[chat-cache] read failed:", error?.message || error);
    return null;
  }
};

export const setCachedJson = async (key, value, ttlSeconds) => {
  if (!isRedisAvailable()) return false;
  const client = getRedisClient();
  if (!client) return false;
  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return true;
  } catch (error) {
    console.warn("[chat-cache] write failed:", error?.message || error);
    return false;
  }
};

export const deleteCacheKey = async (key) => {
  if (!isRedisAvailable()) return 0;
  const client = getRedisClient();
  if (!client) return 0;
  try {
    return await client.del(key);
  } catch (error) {
    console.warn("[chat-cache] delete key failed:", error?.message || error);
    return 0;
  }
};

// delete the cached items by prefix 
// this is used to delete the cached messages for the conversation with many messages keys in the Redis.

export const deleteCacheByPrefix = async (prefix) => {
  if (!isRedisAvailable()) return 0;
  const client = getRedisClient();
  if (!client) return 0;

  // cursor means the position in the Redis scan. it is used to iterate over the keys in the Redis.
  let cursor = "0";
  let deleted = 0;
  try {
    do {
      // scan the Redis for keys that match the prefix. it is used to iterate over the keys in the Redis.
      const scanResult = await client.scan(cursor, {
        MATCH: `${prefix}*`,
        COUNT: 100
      });
      cursor = scanResult.cursor;
      const keys = scanResult.keys || [];
      if (keys.length > 0) {
        deleted += await client.del(keys);
      }
    } while (cursor !== "0");
    return deleted;
  } catch (error) {
    console.warn("[chat-cache] delete prefix failed:", error?.message || error);
    return deleted;
  }
};

export const invalidateConversationCachesForUsers = async (userIds = []) => {
  // delete the cached conversations for the users
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
  if (uniqueUserIds.length === 0) return 0;
  const deletions = await Promise.all(
    uniqueUserIds.map((userId) => deleteCacheKey(buildConversationCacheKey(userId)))
  );
  // return the total number of deletions
  return deletions.reduce((sum, count) => sum + Number(count || 0), 0);
};

// delete the cached messages for the conversation
export const invalidateMessageCachesForConversation = async (conversationId) => {
  if (!conversationId) return 0;
  // delete the cached messages for the conversation
  return deleteCacheByPrefix(`chat:msgs:conv:${conversationId}:`);
};
