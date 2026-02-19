import { createClient } from "redis";

let redisClient = null;
let redisAvailable = false;
let redisInitAttempted = false;

const toBool = (raw, fallback = false) => {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const value = String(raw).trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
};

// Get the Redis URL from the environment variables
const getRedisUrl = () => {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const host = process.env.REDIS_HOST || "127.0.0.1";
  const port = Number(process.env.REDIS_PORT || 6379);
  const protocol = toBool(process.env.REDIS_TLS, false) ? "rediss" : "redis";
  if (process.env.REDIS_USERNAME && process.env.REDIS_PASSWORD) {
    return `${protocol}://${encodeURIComponent(process.env.REDIS_USERNAME)}:${encodeURIComponent(process.env.REDIS_PASSWORD)}@${host}:${port}`;
  }
  if (process.env.REDIS_PASSWORD) {
    return `${protocol}://:${encodeURIComponent(process.env.REDIS_PASSWORD)}@${host}:${port}`;
  }
  return `${protocol}://${host}:${port}`;
};

export const isRedisEnabled = () => toBool(process.env.REDIS_ENABLED, false);

export const initRedis = async () => {
  if (redisInitAttempted) {
    return { client: redisClient, available: redisAvailable, enabled: isRedisEnabled() };
  }
  redisInitAttempted = true;

  if (!isRedisEnabled()) {
    console.log("[redis] disabled (REDIS_ENABLED=false)");
    return { client: null, available: false, enabled: false };
  }
  // Get the Redis URL from the environment variables
  const redisUrl = getRedisUrl();
  const socket = {};
  // Check if TLS is enabled
  if (process.env.REDIS_TLS && toBool(process.env.REDIS_TLS, false)) {
    socket.tls = true;
    socket.rejectUnauthorized = toBool(process.env.REDIS_TLS_REJECT_UNAUTHORIZED, true);
  }
  // Create a Redis client
  const client = createClient({
    url: redisUrl,
    socket
  });

  client.on("error", (error) => {
    // Keep the server running if redis is temporarily down.
    console.warn("[redis] client error:", error?.message || error);
  });
  client.on("reconnecting", () => {
    console.warn("[redis] reconnecting...");
  });
  client.on("ready", () => {
    console.log("[redis] ready");
  });
  client.on("end", () => {
    console.warn("[redis] connection closed");
  });

  try {
    await client.connect();
    await client.ping();
    redisClient = client;
    redisAvailable = true;
    console.log("[redis] connected");
  } catch (error) {
    redisClient = null;
    redisAvailable = false;
    console.warn("[redis] unavailable, continuing without cache/adapter:", error?.message || error);
    try {
      await client.disconnect();
    } catch {
      // Ignore disconnect errors during failed bootstrap.
    }
  }

  return { client: redisClient, available: redisAvailable, enabled: true };
};

export const getRedisClient = () => redisClient;
export const isRedisAvailable = () => redisAvailable;

export const closeRedis = async () => {
  if (!redisClient) return;
  try {
    await redisClient.quit();
  } catch {
    try {
      await redisClient.disconnect();
    } catch {
      // Ignore close errors on shutdown.
    }
  } finally {
    redisClient = null;
    redisAvailable = false;
  }
};
