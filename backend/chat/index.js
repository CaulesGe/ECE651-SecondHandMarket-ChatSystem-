// Chat service entry point (HTTP routes + WebSocket integration).
// Note: This module wires together chat routes and Socket.IO setup.
// The referenced route/socket modules will be added in subsequent steps.

// Import chat HTTP routes (to be implemented in a later step).
import { createChatRouter } from "./routes.js";
// Import chat WebSocket setup (to be implemented in a later step).
import { initChatSocket } from "./websocket.js";

// Mount the chat service into the main Express app and HTTP server.
export const mountChatService = (app, httpServer) => {
  // Attach REST endpoints under /chat.
  const chatRouter = createChatRouter();
  app.use("/chat", chatRouter);

  // Initialize Socket.IO for real-time chat delivery.
  initChatSocket(httpServer);
};
