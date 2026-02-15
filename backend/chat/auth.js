// JWT library for token verification.
import jwt from "jsonwebtoken";

// Secret used to verify JWTs (required for JWT auth).
const JWT_SECRET = process.env.JWT_SECRET;

// Parse a Bearer token from an Authorization header value.
const extractBearerToken = (rawAuth) => {
  // Guard against missing header.
  if (!rawAuth) return null;
  // Split "Bearer <token>" into scheme + token.
  const [scheme, token] = rawAuth.split(" ");
  // Validate scheme and token presence.
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  // Return the token string.
  return token;
};

// Verify a JWT token and normalize the user payload.
const getUserFromJwt = (token) => {
  // JWT auth requires both token and secret.
  if (!token || !JWT_SECRET) return null;
  try {
    // Verify token signature and expiry.
    const payload = jwt.verify(token, JWT_SECRET);
    // Map payload fields into a consistent user shape.
    return {
      id: payload.id || payload.userId || payload.sub,
      name: payload.name || payload.username,
      role: payload.role || "user",
      email: payload.email
    };
  } catch {
    // Invalid token.
    return null;
  }
};

// Extract user identity from legacy header-based auth.
const getUserFromHeaders = (headers) => {
  // Read identity fields from headers.
  const userId = headers["x-user-id"];
  const role = headers["x-user-role"];
  const name = headers["x-user-name"];
  const email = headers["x-user-email"];

  // Require at least userId and role to authenticate.
  if (!userId || !role) return null;
  // Return normalized user object.
  return { id: userId, role, name, email };
};

// Extract user identity from Socket.IO auth payload.
const getUserFromSocketAuth = (auth) => {
  const userId = auth?.userId;
  const role = auth?.role;
  const name = auth?.name;
  const email = auth?.email;

  if (!userId || !role) return null;
  return { id: userId, role, name, email };
};

// HTTP middleware to enforce authentication.
export const authenticateHttp = (req, res, next) => {
  // Read Authorization header.
  const authHeader = req.header("authorization");
  // Parse Bearer token if present.
  const token = extractBearerToken(authHeader);
  // Try JWT-based auth first.
  const jwtUser = getUserFromJwt(token);
  if (jwtUser?.id) {
    // Attach user to request and continue.
    req.user = jwtUser;
    return next();
  }

  // Fallback to header-based auth.
  const headerUser = getUserFromHeaders(req.headers);
  if (headerUser?.id) {
    // Attach user to request and continue.
    req.user = headerUser;
    return next();
  }

  // If token provided but server is missing secret, report config error.
  if (token && !JWT_SECRET) {
    return res.status(500).json({ message: "JWT secret not configured." });
  }

  // Otherwise, reject as unauthorized.
  return res.status(401).json({ message: "Unauthorized" });
};

// Socket.IO middleware to enforce authentication.
export const authenticateSocket = (socket, next) => {
  // Accept token from auth payload.
  const authToken = socket.handshake?.auth?.token;
  // Or from Authorization header.
  const headerAuth = socket.handshake?.headers?.authorization;
  // Normalize to a single token value.
  const token = extractBearerToken(headerAuth) || authToken;

  // Try JWT-based auth first.
  const jwtUser = getUserFromJwt(token);
  if (jwtUser?.id) {
    // Attach user to socket and continue.
    socket.user = jwtUser;
    return next();
  }

  // Fallback to header-based auth.
  const headerUser = getUserFromHeaders(socket.handshake?.headers || {});
  if (headerUser?.id) {
    // Attach user to socket and continue.
    socket.user = headerUser;
    return next();
  }

  // Fallback to socket auth payload identity.
  const payloadUser = getUserFromSocketAuth(socket.handshake?.auth || {});
  if (payloadUser?.id) {
    socket.user = payloadUser;
    return next();
  }

  // Reject unauthorized socket connection.
  return next(new Error("Unauthorized"));
};
