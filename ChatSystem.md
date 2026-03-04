# Chat System Workflow (Scalable, Multi-Node)

This document describes the production workflow for chat in this project, with emphasis on multi-node behavior.

It covers:

- when/where backend sockets are created
- why user-based rooms are used instead of conversation rooms
- how message send and fanout work across pods
- how media upload/download works with S3 signed URLs
- how presence and typing are stored and pushed
- what Redis is responsible for vs what Socket.IO handles

---

## 1) Startup and socket lifecycle

## 1.1 Backend startup sequence

For each backend node/pod:

1. HTTP server starts.
2. `initChatSocket(httpServer)` creates a Socket.IO server.
3. `io.use(authenticateSocket)` enables auth on each incoming socket handshake.
4. `tryAttachRedisAdapter(io)` attaches the Redis adapter when Redis is available.

Result: each node has an independent Socket.IO server, and all nodes are bridged by Redis adapter pub/sub when enabled.

## 1.2 When a user room is created

A user room is created lazily by Socket.IO when the first socket joins:

1. Client opens `/chat` and connects socket with auth token.
2. Backend `connection` handler reads authenticated `userId`.
3. Backend runs `socket.join("user:<userId>")`.

You do not pre-create rooms in Redis or DB. Room existence is managed by Socket.IO internally.

## 1.3 Why room key is `user:<userId>` (not `conversation:<id>`)

Room key and authorization are intentionally separate:

- **Authorization / recipient selection** comes from DB conversation participants.
- **Delivery transport** uses user rooms (`user:<id>`).

Backend flow:

1. Query participant user IDs for `conversationId`.
2. Emit to each participant's room `user:<id>`.

Benefits:

- one user with multiple tabs/devices receives event on all sockets
- same mechanism works for direct user events (presence/typing/message)
- no frequent join/leave churn when user opens/closes chat threads

---

## 2) Scalable architecture (2-node example)

```mermaid
flowchart LR
  subgraph Clients
    A[User A Browser]
    B[User B Browser]
  end

  subgraph Node1["Backend Node 1"]
    S1[Socket.IO Server 1]
  end

  subgraph Node2["Backend Node 2"]
    S2[Socket.IO Server 2]
  end

  R[(Redis)]
  DB[(Database)]
  S3[(AWS S3)]

  A <-->|socket| S1
  B <-->|socket| S2
  S1 <-->|adapter pub/sub| R
  S2 <-->|adapter pub/sub| R
  S1 <-->|read/write| DB
  S2 <-->|read/write| DB
  S1 <-->|presence/typing TTL keys| R
  S2 <-->|presence/typing TTL keys| R
  A <-->|sign URL requests| S1
  B <-->|sign URL requests| S2
  A <-->|PUT/GET media| S3
  B <-->|PUT/GET media| S3
```

Key responsibilities:

- **Socket.IO Redis adapter**: cross-node event fanout.
- **Redis key-value**: ephemeral state (presence/typing TTL keys).
- **Database**: durable source of truth for messages/conversations.
- **S3**: media object storage.

---

## 3) Conversation and message delivery

## 3.1 Conversation creation (HTTP)

Client calls `POST /chat/conversations`.

Backend:

1. validates users/context fields
2. creates or finds existing conversation
3. invalidates relevant conversation caches
4. returns `conversationId`

No socket event is required for creation itself; frontend can hydrate list afterward.

## 3.2 Message send (Socket) end-to-end

Client emits:

- `send_message`
- payload: `{ conversationId, type, content | mediaObjectKey, clientMessageId }`

Backend `send_message` handler:

1. validates sender belongs to conversation
2. writes message once to DB (`sendMessage(...)`)
3. sends ack to sender: `send_ack { clientMessageId, messageId }`
4. clears sender typing state
5. loads participant user IDs from DB
6. emits `message` to each `user:<participantId>` room // room contains all sockets for the user

Important: DB write happens once on the node that handled `send_message`. Other nodes only forward packet to local sockets.

### Message fanout sequence (User A on Node1, User B on Node2)

```mermaid
sequenceDiagram
  participant UA as User A Client
  participant N1 as Socket Server Node1
  participant DB as Database
  participant R as Redis Adapter Bus
  participant N2 as Socket Server Node2
  participant UB as User B Client

  UA->>N1: emit("send_message", payload)
  N1->>DB: insert message (single write)
  DB-->>N1: saved row
  N1-->>UA: emit("send_ack")
  N1->>R: adapter publishes room packets
  R->>N2: adapter forwards packet
  N2-->>UB: emit("message", {message})
```

---

## 4) Redis pub/sub in this system

You are not manually publishing receiver IDs with raw Redis commands.

There is no custom logic like:

- `PUBLISH receiverId payload`

Instead:

1. backend calls `io.to("user:<id>").emit(...)`
2. Socket.IO adapter serializes packet and publishes on its internal Redis channels
3. other nodes' adapters subscribed to those channels receive packet
4. receiving node emits to local sockets in target room

So Redis pub/sub is a transport mechanism owned by the Socket.IO adapter.

Important clarification:

- Redis is **not** used as a manual "socket room registry" in this app.
- Room membership still lives inside Socket.IO (`socket.join("user:<id>")`).
- Redis adapter only bridges room emits across nodes.

Cluster behavior example:

- Node A local room map might have `user:1 -> {socketA1}`
- Node B local room map might have `user:1 -> {socketB7}`
- these room maps are **not merged** into one global socket list
- when Node A emits to `user:1`, adapter publishes a room-targeted packet via Redis
- every node receives packet and checks its **own local** `user:1` room
- nodes with matching local sockets deliver; nodes without matches ignore

## 4.1 Redis usage by feature (what Redis is for)

- **Socket fanout across nodes**: Socket.IO adapter pub/sub transport for `io.to("user:<id>").emit(...)`.
- **Presence**: Redis TTL key `chat:presence:<userId>` stores short-lived online heartbeat state.
- **Typing**: Redis TTL keys store short-lived typing state:
  - `chat:typing:<conversationId>:<userId>`
  - `chat:typing:<userId> -> <conversationId>` (active conversation pointer)
- **Conversations/messages API cache**: Redis stores JSON cache entries with TTL for list/history endpoints.

### 4.2 Who reads/writes Redis (and who does not)

- Frontend never connects to Redis directly.
- Backend service/socket layers are the only Redis readers/writers.
- Frontend gets Redis-backed results indirectly through:
  - REST responses (conversation/message cache hits)
  - socket snapshot callback (`presence_subscribe`)
  - socket push events (`presence_changed`, `typing_changed`)

### 4.3 Redis role matrix by feature

| Feature | Redis used for | Who writes Redis | Who reads Redis | If Redis is unavailable |
|---|---|---|---|---|
| Socket message/presence/typing fanout across pods | Socket.IO adapter pub/sub transport | Socket.IO adapter internals | Socket.IO adapter internals | Same-node emits still work; cross-node delivery degrades |
| Presence | TTL heartbeat key `chat:presence:<userId>` | backend socket heartbeat on connect/interval | backend on `presence_subscribe` snapshot | Falls back to local in-memory socket presence only |
| Typing | TTL keys for active typers and active conversation pointer | backend on `typing` start/stop, send, disconnect | backend on `presence_subscribe` snapshot | Live push still works; snapshot quality degrades |
| Conversations/messages API cache | JSON cache with TTL and invalidation | backend conversation/message services | backend conversation/message services | Falls back to DB reads/writes |

Without Redis:

- same-node socket delivery still works
- cross-node fanout degrades
- typing/presence snapshot quality degrades (event push may still work on same node)

---

## 5) Media upload/download (S3 direct path)

Binary media does not pass through backend app memory. Backend performs auth + signing only.

## 5.1 Upload workflow

1. Client calls `POST /chat/media/presign-upload` with:
   - `conversationId`
   - `mimeType`
   - `size`
   - optional file extension
2. Backend validates:
   - authenticated user is conversation participant
   - MIME type allowed
   - size within limit
3. Backend generates object key:
   - `chat/conversations/<conversationId>/users/<userId>/<uuid>.<ext>`
4. Backend signs `PutObject` and returns:
   - `uploadUrl`
   - `objectKey`
   - expiry seconds
5. Client uploads file directly to S3 using `PUT uploadUrl`.
6. Client sends chat message with `mediaObjectKey = objectKey`.

## 5.2 Download workflow

1. Message row includes `mediaObjectKey`.
2. Client requests `GET /chat/media/sign-download?key=<mediaObjectKey>`.
3. Backend parses conversation ID from key path and re-checks participant authorization.
4. Backend signs `GetObject` and returns short-lived `downloadUrl`.
5. Client fetches media directly from S3 with `downloadUrl`.

### Media sequence

```mermaid
sequenceDiagram
  participant C as Client
  participant API as Backend API
  participant S3 as AWS S3

  C->>API: POST /chat/media/presign-upload
  API-->>C: { uploadUrl, objectKey }
  C->>S3: PUT file with uploadUrl
  C->>API: emit send_message { mediaObjectKey }
  API-->>C: emit message with mediaObjectKey
  C->>API: GET /chat/media/sign-download?key=...
  API-->>C: { downloadUrl }
  C->>S3: GET media with downloadUrl
```

---

## 6) Presence workflow (Redis TTL + socket push)

Presence key:

- `chat:presence:<userId> = "1"` with TTL

On socket connect:

1. set presence key with TTL
2. start heartbeat interval to refresh key
3. notify peers with `presence_changed { userId, isOnline: true }`

On disconnect:

1. remove socket from in-memory map
2. if user has no remaining sockets, emit `isOnline: false` to peers
3. clear typing state for safety

Presence snapshot:

- client emits `presence_subscribe { conversationId }`
- backend validates participant
- backend returns:
  - `presenceByUserId`
  - `typingUserIds`

When frontend calls `presence_subscribe` (through `requestConversationPresence`):

- when selected conversation changes
- when socket transitions to connected/reconnected
- when browser window regains focus

There is no periodic 15s polling loop now.

---

## 7) Typing workflow (Redis TTL + event push + client-side expiry)

Typing keys:

- per-conversation key: `chat:typing:<conversationId>:<userId>` (TTL)
- active-conversation pointer: `chat:typing:<userId> -> <conversationId>` (TTL)

## 7.1 Start typing

Client emits `typing { conversationId, isTyping: true }`.

Client-side refresh behavior:

- on entering typing state, client emits `typing=true` immediately
- while user continues typing, client sends throttled refresh emits (about every 2.5s) to keep Redis typing TTL alive
- on idle/send/switch/disconnect, client emits `typing=false`

Backend:

1. validates sender is a participant
2. checks if user was typing in another conversation
3. if yes, clears old conversation typing and emits `typing_changed false` to old peers
4. sets new Redis typing keys with TTL
5. emits typing_changed { conversationId, userId, isTyping, expiresInSeconds } to participants in this conversation only.

## 7.2 Stop typing

Triggered by:

- explicit `typing { isTyping: false }`
- successful `send_message`
- disconnect cleanup

Backend:

1. deletes per-conversation typing key
2. clears active conversation key when matching
3. emits `typing_changed { isTyping: false }` to conversation peers

## 7.3 Expiry behavior (important nuance)

There is no backend polling loop that checks every 2 seconds and emits `notTyping`.

Instead:

1. backend emits `typing_changed` with `expiresInSeconds`
2. frontend starts a local timer for `(conversationId, userId)`
3. if no refresh event arrives before timer expiry, frontend clears typing indicator locally

So:

- Redis TTL protects shared state correctness across pods
- client refresh emits keep typing TTL alive while user is actively typing
- frontend timer protects UI from stale typing indicators without backend polling

Important:

- frontend never reads Redis directly
- backend reads/writes Redis typing keys
- frontend only receives socket events + snapshot results from backend
- backend does not poll Redis every few seconds to push typing updates; updates are event-driven

## 7.4 Typing behavior when Redis is unavailable

Typing still works in degraded mode:

1. sender emits `typing`
2. backend emits `typing_changed` to peers
3. receiver UI uses `expiresInSeconds` to auto-clear stale typing locally

In no-Redis mode, if user B opens a conversation after user A already emitted `typing=true`,
B can miss that current typing state until a fresh `typing_changed` event is sent.

---

## 8) Cross-node example (A on Node1, B on Node2)

Assume both users are in conversation `c1`.

1. A starts typing on Node1:
   - Node1 writes typing TTL keys in Redis
   - Node1 emits `typing_changed true` to B's user room
   - adapter propagates to Node2; Node2 delivers to B's socket
2. A sends message on Node1:
   - Node1 writes DB once
   - Node1 emits `message` to participant user rooms
   - adapter propagates to Node2 for B delivery
   - Node1 emits `typing_changed false`
3. B receives both events in Node2:
   - typing indicator clears
   - message appears in chat UI

This is how sockets on different nodes stay consistent without duplicate DB writes.

---

## 9) Reliability and fallback behavior

- If Redis adapter is down, cross-node fanout is degraded; same-node delivery still works.
- If Redis key-value is unavailable, presence/typing degrade to partial in-memory + event-only behavior:
  - live push events can still update UI
  - snapshot recovery (`typingUserIds`) is weaker
  - users joining mid-typing may miss existing typing state
- Message durability remains because message writes are committed to DB.
- Reconnect path in frontend re-syncs conversations/messages to recover missed live events.

Quick mental model:

- Socket.IO push = immediate UI updates
- Redis TTL keys = shared short-lived truth and snapshot recovery
- frontend timers = stale-indicator safety net
- DB = durable source of truth

---

## 10) Event contract (frontend <-> backend)

Client -> Server:

- `send_message`
- `typing`
- `presence_subscribe`
- `withdraw_message`

Server -> Client:

- `message`
- `send_ack`
- `typing_changed`
- `presence_changed`

Recommended frontend handling:

- treat socket events as immediate UI updates
- run REST/message sync on reconnect for eventual consistency

---

## 11) FAQ (from implementation review)

Q: Is Redis only storing socket rooms?
A: No. Socket rooms are managed by Socket.IO (`socket.join("user:<id>")`). Redis is used for:
- Socket.IO adapter pub/sub across nodes
- Presence TTL keys
- Typing TTL keys
- API cache (conversations/messages)

Q: If user sockets are on different nodes, does Redis build one shared room with all sockets?
A: No. Each node keeps only local room membership. Redis adapter broadcasts room-targeted emits, and each node checks/delivers to its own local sockets in that room.

Q: Does adapter publish userId and then each node checks local sockets?
A: Conceptually yes. The adapter publishes a room-targeted packet (for `user:<id>`) and each node's Socket.IO layer matches that room locally and emits to matching sockets.

Q: Why store typing/presence keys at all? Why not only push socket events?
A: Push-only works in ideal/single-node cases, but keys add:
- snapshot recovery after reconnect/tab focus/chat switch
- shared state across pods
- TTL-based cleanup for missed stop/disconnect events

Q: Does frontend read Redis directly when typing TTL expires?
A: No. Frontend never connects to Redis. It uses socket events and local timers. Backend reads Redis for snapshots.

Q: Who actually reads the cache/keys?
A: Backend only.
- API services read/write conversation/message caches.
- Socket handlers read/write presence/typing keys.

Q: Does backend poll Redis every few seconds and keep pushing typing updates?
A: Backend does not poll Redis. Updates are event-driven (`typing`, `send_message`, `disconnect`). The client may send throttled `typing=true` refresh emits while actively typing to keep TTL valid.

Q: Without Redis, does typing still work?
A: Yes, degraded mode:
- live `typing_changed` push still works (especially same-node)
- receiver still uses `expiresInSeconds` timer to auto-clear stale UI
- but snapshot reconstruction is weaker

Q: Without Redis, if B opens conversation while A is already typing, will B miss it?
A: Possibly yes. If B missed the earlier `typing=true` push, no Redis snapshot source exists to reconstruct it; B sees typing again on next fresh typing event.
