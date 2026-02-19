// Chat service entry point (HTTP routes + WebSocket integration).
// Note: This module wires together chat routes and Socket.IO setup.
// The referenced route/socket modules will be added in subsequent steps.

// Import chat HTTP routes (to be implemented in a later step).
import { createChatRouter } from "./routes.js";
// Import chat WebSocket setup (to be implemented in a later step).
import { initChatSocket, tryAttachRedisAdapter } from "./websocket.js";

// Mount the chat service into the main Express app and HTTP server.
export const mountChatService = (app, httpServer) => {
  // Attach REST endpoints under /api/chat to avoid conflict with frontend /chat route.
  const chatRouter = createChatRouter();
  app.use("/api/chat", chatRouter);

  // Initialize Socket.IO for real-time chat delivery.
  const io = initChatSocket(httpServer);
  return {
    io,
    tryAttachRedisAdapter: () => tryAttachRedisAdapter(io)
  };
};
