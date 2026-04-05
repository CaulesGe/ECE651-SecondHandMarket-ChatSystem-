# Chat System Presentation

## 1. Project Objective

- Build a reliable real-time chat system for the marketplace
- Support 1:1 messaging, media, presence, typing, and unread state
- Keep the design correct under disconnects and multi-node deployment

**Stack**

- React
- Express + Socket.IO
- PostgreSQL/Prisma-style data model
- Redis
- AWS S3

---

## 2. What We Achieved

- Persistent chat history
- Real-time message delivery across nodes
- Delivery ACK + pending delivery tracking
- Per-conversation message ordering
- Reconnect sync and deduplication
- Presence and typing indicators
- Media messaging with signed S3 URLs
- Per-user hide/archive and unread counts

```mermaid
flowchart LR
  A[Sender] --> B[Persist message]
  B --> C[Emit realtime event]
  C --> D[Recipient ACK]
  D --> E[Mark delivered]
  C --> F[Retry / replay if needed]
```

---

## 3. System Design

```mermaid
flowchart LR
  subgraph Clients
    U1[User A]
    U2[User B]
  end

  subgraph Backend
    N1[Socket/API Node 1]
    N2[Socket/API Node 2]
  end

  R[(Redis)]
  DB[(Database)]
  S3[(AWS S3)]

  U1 <-->|socket/http| N1
  U2 <-->|socket/http| N2
  N1 <-->|adapter + TTL keys| R
  N2 <-->|adapter + TTL keys| R
  N1 <-->|messages/read state| DB
  N2 <-->|messages/read state| DB
  U1 <-->|media upload/download| S3
  U2 <-->|media upload/download| S3
```

- DB = durable truth
- Redis = cross-node fanout + short-lived state
- S3 = direct media path

---

## 4. Reliable Message Flow

```mermaid
sequenceDiagram
  participant A as Sender
  participant S as Chat Server
  participant DB as Database
  participant B as Receiver

  A->>S: send_message
  S->>DB: save message
  S->>DB: create pending delivery row
  S-->>A: send_ack
  S-->>B: message { message, delivery }
  B->>S: message_delivery_ack
  S->>DB: mark delivered
  alt no ACK
    S-->>B: one short retry
    S-->>B: replay on reconnect / conversation activity
  end
```

- Sender ACK means "saved", not "read"
- Delivery state is tracked per recipient
- Recovery uses retry + activity-based replay

---

## 5. Correctness Features

- Ordering:
  server assigns per-conversation `sequenceNumber`
- Sync:
  socket push + reconnect recovery + local merge/dedup
- Presence:
  socket push first, Redis-backed snapshot recovery
- Typing:
  socket events + Redis TTL + client expiry timer
- Media:
  backend signs, clients upload/download directly with S3

```mermaid
flowchart TD
  M1[Socket push] --> M2[Merge by message id]
  M2 --> M3[Sort by sequence number]
  M3 --> M4[Consistent thread view]
```

---

## 6. Presence Workflow

```mermaid
flowchart TD
  subgraph connect ["Connect"]
    C1[User connects socket] --> C2[Set Redis presence TTL]
    C2 --> C3[Start heartbeat refresh]
    C3 --> C4[Emit presence_changed online to peers]
    C4 --> C5[Push current peer status to new user]
  end

  subgraph disconnect ["Disconnect"]
    D1[User disconnects] --> D2[Remove local socket]
    D2 --> D3{Any sockets left?}
    D3 -- Yes --> D4[Keep user online]
    D3 -- No --> D5[Clear typing state]
    D5 --> D6[Emit presence_changed offline to peers]
  end

  subgraph snapshot ["Snapshot recovery"]
    S1[Conversation open / reconnect / focus] --> S2[Client emits presence_subscribe]
    S2 --> S3[Backend reads peer status from Redis]
    S3 --> S4[Returns presence snapshot + typing users]
  end
```

- Main UI updates come from `presence_changed`
- Redis is used for presence TTL storage and snapshot recovery
- On conversation open / reconnect / focus, backend reads peer status from Redis
- Frontend never talks to Redis directly

---

## 7. Typing Indicator Workflow

```mermaid
flowchart TD
  T1[User starts typing] --> T2[Client emits typing=true]
  T2 --> T3[Backend validates participant]
  T3 --> T4[Set Redis typing TTL]
  T4 --> T5[Emit typing_changed true to conversation peers]

  T6[User keeps typing] --> T7[Client sends throttled refresh]
  T7 --> T4

  T8[Idle / send / switch / disconnect] --> T9[Client or backend clears typing]
  T9 --> T10[Delete typing TTL key]
  T10 --> T11[Emit typing_changed false]

  T12[Conversation open / focus] --> T13[Backend may read typing snapshot from Redis]
  T13 --> T14[Return typing users in presence_subscribe]

  T15[Receiver gets typing_changed] --> T16[Start local expiry timer]
  T16 --> T17[No refresh arrives]
  T17 --> T18[Clear typing indicator locally]
```

- Typing is conversation-scoped
- Redis stores short-lived typing state for snapshot/recovery
- Live typing UI mainly comes from `typing_changed`
- No backend polling loop
- Client timer prevents stale indicators

---

## 8. Demo Highlights

- Send text, image, and video messages
- Show unread counts and mark-read state
- Show online/offline presence
- Show typing indicators
- Recover missed messages after reconnect
- Keep conversations synced across backend nodes

---

## 9. Results Against the Original Risks

| Risk | Result |
| --- | --- |
| Message lost on brief disconnect | Reduced with persistence, ACK, retry, replay |
| Different order across users | Solved with server sequence numbers |
| Multi-node inconsistency | Solved with Socket.IO Redis adapter |
| Stale presence / typing | Reduced with TTL + push events |
| Large media through app server | Avoided with signed S3 path |

---

## 10. Next Improvements

- Move replay coalescing from node-local memory to Redis
- Track delivered/read progress fully by sequence number
- Add per-device recovery checkpoint
- Add metrics for long-pending deliveries

**Takeaway**

- The project is not just "Socket.IO chat"
- It is a reliability-focused chat system with recovery, ordering, and multi-node design
