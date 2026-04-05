import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../server.js";
import { markMessageDeliveryDelivered } from "../chat/services/message.js";
import {
  replayPendingDeliveriesForRecipientNow,
  retryPendingMessageDeliveryNow
} from "../chat/websocket.js";
import { prepareTestDb } from "./helpers/prepareTestDb.js";

const prisma = new PrismaClient();

const authHeaders = (user) => ({
  "x-user-id": user.id,
  "x-user-role": user.role || "user",
  "x-user-name": user.name || "",
  "x-user-email": user.email || ""
});

async function resetDb() {
  await prisma.conversationReadState.deleteMany();
  await prisma.messageDelivery.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.transactionItem.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.draft.deleteMany();
  await prisma.goods.deleteMany();
  await prisma.user.deleteMany();
}

async function createUser({
  id,
  name = "Chat User",
  email,
  role = "user"
}) {
  return prisma.user.create({
    data: {
      id,
      name,
      email,
      password: "password123",
      role,
      createdAt: new Date(),
      emailVerified: true
    }
  });
}

describe("Chat integration", () => {
  beforeAll(async () => {
    prepareTestDb();
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("rejects chat endpoints when unauthenticated", async () => {
    const res = await request(app)
      .get("/api/chat/conversations")
      .expect(401);

    expect(res.body.message).toBe("Unauthorized");
  });

  test("POST /api/chat/conversations creates conversation and is idempotent for same participants/context", async () => {
    const alice = await createUser({
      id: "u_chat_1",
      name: "Alice",
      email: "alice_chat@example.com"
    });
    const bob = await createUser({
      id: "u_chat_2",
      name: "Bob",
      email: "bob_chat@example.com"
    });

    const create1 = await request(app)
      .post("/api/chat/conversations")
      .set(authHeaders(alice))
      .send({
        otherUserId: bob.id,
        contextOrderId: "ord_1",
        contextItemId: "item_1"
      })
      .expect(201);

    expect(create1.body).toHaveProperty("conversation");
    expect(create1.body.conversation.participants).toHaveLength(2);
    const firstConversationId = create1.body.conversation.id;

    const create2 = await request(app)
      .post("/api/chat/conversations")
      .set(authHeaders(alice))
      .send({
        otherUserId: bob.id,
        contextOrderId: "ord_1",
        contextItemId: "item_1"
      })
      .expect(201);

    expect(create2.body.conversation.id).toBe(firstConversationId);

    const conversationCount = await prisma.conversation.count();
    expect(conversationCount).toBe(1);
  });

  test("hiding a conversation only removes it for the current user and createConversation reopens it", async () => {
    const alice = await createUser({
      id: "u_chat_hide_1",
      name: "Alice",
      email: "alice_hide@example.com"
    });
    const bob = await createUser({
      id: "u_chat_hide_2",
      name: "Bob",
      email: "bob_hide@example.com"
    });

    const created = await request(app)
      .post("/api/chat/conversations")
      .set(authHeaders(alice))
      .send({ otherUserId: bob.id })
      .expect(201);
    const conversationId = created.body.conversation.id;

    await request(app)
      .post(`/api/chat/conversations/${conversationId}/hide`)
      .set(authHeaders(alice))
      .expect(200);

    const hiddenMembership = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: alice.id
        }
      }
    });
    expect(hiddenMembership?.hiddenAt).not.toBeNull();

    const aliceListAfterHide = await request(app)
      .get("/api/chat/conversations")
      .set(authHeaders(alice))
      .expect(200);
    expect(aliceListAfterHide.body.items).toHaveLength(0);

    const bobListAfterHide = await request(app)
      .get("/api/chat/conversations")
      .set(authHeaders(bob))
      .expect(200);
    expect(bobListAfterHide.body.items).toHaveLength(1);
    expect(bobListAfterHide.body.items[0].id).toBe(conversationId);

    const reopened = await request(app)
      .post("/api/chat/conversations")
      .set(authHeaders(alice))
      .send({ otherUserId: bob.id })
      .expect(201);
    expect(reopened.body.conversation.id).toBe(conversationId);

    const aliceListAfterReopen = await request(app)
      .get("/api/chat/conversations")
      .set(authHeaders(alice))
      .expect(200);
    expect(aliceListAfterReopen.body.items).toHaveLength(1);
    expect(aliceListAfterReopen.body.items[0].id).toBe(conversationId);

    const reopenedMembership = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: alice.id
        }
      }
    });
    expect(reopenedMembership?.hiddenAt).toBeNull();
  });

  test("new messages automatically unhide a hidden conversation for the recipient", async () => {
    const alice = await createUser({
      id: "u_chat_hide_msg_1",
      name: "Alice",
      email: "alice_hide_msg@example.com"
    });
    const bob = await createUser({
      id: "u_chat_hide_msg_2",
      name: "Bob",
      email: "bob_hide_msg@example.com"
    });

    const created = await request(app)
      .post("/api/chat/conversations")
      .set(authHeaders(alice))
      .send({ otherUserId: bob.id })
      .expect(201);
    const conversationId = created.body.conversation.id;

    await request(app)
      .post(`/api/chat/conversations/${conversationId}/hide`)
      .set(authHeaders(bob))
      .expect(200);

    const hiddenList = await request(app)
      .get("/api/chat/conversations")
      .set(authHeaders(bob))
      .expect(200);
    expect(hiddenList.body.items).toHaveLength(0);

    const sent = await request(app)
      .post("/api/chat/messages")
      .set(authHeaders(alice))
      .send({
        conversationId,
        type: "text",
        content: "wake hidden thread",
        clientMessageId: "cm_hidden_wakeup_1"
      })
      .expect(201);

    const bobListAfterMessage = await request(app)
      .get("/api/chat/conversations")
      .set(authHeaders(bob))
      .expect(200);
    expect(bobListAfterMessage.body.items).toHaveLength(1);
    expect(bobListAfterMessage.body.items[0].id).toBe(conversationId);
    expect(bobListAfterMessage.body.items[0].lastMessage?.id).toBe(sent.body.message.id);

    const recipientMembership = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: bob.id
        }
      }
    });
    expect(recipientMembership?.hiddenAt).toBeNull();
  });

  test("POST /api/chat/messages sends text and GET /api/chat/messages returns replay-ordered items", async () => {
    const alice = await createUser({
      id: "u_chat_3",
      name: "Alice",
      email: "alice_send@example.com"
    });
    const bob = await createUser({
      id: "u_chat_4",
      name: "Bob",
      email: "bob_send@example.com"
    });

    const convoRes = await request(app)
      .post("/api/chat/conversations")
      .set(authHeaders(alice))
      .send({ otherUserId: bob.id })
      .expect(201);
    const conversationId = convoRes.body.conversation.id;

    const sent1 = await request(app)
      .post("/api/chat/messages")
      .set(authHeaders(alice))
      .send({
        conversationId,
        type: "text",
        content: "hello bob",
        clientMessageId: "cm_1"
      })
      .expect(201);

    expect(sent1.body.message.content).toBe("hello bob");
    expect(sent1.body.message.senderId).toBe(alice.id);
    const deliveryRows = await prisma.messageDelivery.findMany({
      where: { messageId: sent1.body.message.id },
      orderBy: { recipientId: "asc" }
    });
    expect(deliveryRows).toHaveLength(1);
    expect(deliveryRows[0].recipientId).toBe(bob.id);
    expect(deliveryRows[0].status).toBe("pending");
    expect(deliveryRows[0].deliveredAt).toBeNull();

    const sent2 = await request(app)
      .post("/api/chat/messages")
      .set(authHeaders(bob))
      .send({
        conversationId,
        type: "text",
        content: "hello alice",
        clientMessageId: "cm_2"
      })
      .expect(201);

    const list = await request(app)
      .get("/api/chat/messages")
      .set(authHeaders(alice))
      .query({ conversationId, limit: 100 })
      .expect(200);

    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items).toHaveLength(2);
    expect(list.body.items[0].content).toBe("hello bob");
    expect(list.body.items[1].content).toBe("hello alice");

    const afterCursor = await request(app)
      .get("/api/chat/messages")
      .set(authHeaders(alice))
      .query({
        conversationId,
        lastReceivedMessageSequenceNumber: sent1.body.message.sequenceNumber,
        limit: 100
      })
      .expect(200);
    expect(afterCursor.body.items).toHaveLength(1);
    expect(afterCursor.body.items[0].id).toBe(sent2.body.message.id);

    const beforeCursor = await request(app)
      .get("/api/chat/messages")
      .set(authHeaders(alice))
      .query({
        conversationId,
        oldestLoadedMessageSequenceNumber: sent2.body.message.sequenceNumber,
        limit: 100
      })
      .expect(200);
    expect(beforeCursor.body.items).toHaveLength(1);
    expect(beforeCursor.body.items[0].id).toBe(sent1.body.message.id);
  });

  test("concurrent sends allocate unique sequence numbers and replay in sequence order", async () => {
    const alice = await createUser({
      id: "u_chat_concurrent_1",
      name: "Alice",
      email: "alice_concurrent@example.com"
    });
    const bob = await createUser({
      id: "u_chat_concurrent_2",
      name: "Bob",
      email: "bob_concurrent@example.com"
    });

    const convoRes = await request(app)
      .post("/api/chat/conversations")
      .set(authHeaders(alice))
      .send({ otherUserId: bob.id })
      .expect(201);
    const conversationId = convoRes.body.conversation.id;

    const [sendFromAlice, sendFromBob] = await Promise.all([
      request(app)
        .post("/api/chat/messages")
        .set(authHeaders(alice))
        .send({
          conversationId,
          type: "text",
          content: "alice parallel message",
          clientMessageId: "cm_parallel_alice"
        })
        .expect(201),
      request(app)
        .post("/api/chat/messages")
        .set(authHeaders(bob))
        .send({
          conversationId,
          type: "text",
          content: "bob parallel message",
          clientMessageId: "cm_parallel_bob"
        })
        .expect(201)
    ]);

    const assignedSequenceNumbers = [
      sendFromAlice.body.message.sequenceNumber,
      sendFromBob.body.message.sequenceNumber
    ];
    expect(assignedSequenceNumbers.every((value) => Number.isInteger(value))).toBe(true);
    expect(new Set(assignedSequenceNumbers).size).toBe(2);
    expect([...assignedSequenceNumbers].sort((a, b) => a - b)).toEqual([1, 2]);

    const storedMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { sequenceNumber: "asc" },
      select: {
        id: true,
        senderId: true,
        sequenceNumber: true
      }
    });
    expect(storedMessages).toHaveLength(2);
    expect(storedMessages.map((message) => message.sequenceNumber)).toEqual([1, 2]);

    const replay = await request(app)
      .get("/api/chat/messages")
      .set(authHeaders(alice))
      .query({ conversationId, limit: 100 })
      .expect(200);

    expect(replay.body.items).toHaveLength(2);
    expect(replay.body.items.map((message) => message.sequenceNumber)).toEqual([1, 2]);
    expect(replay.body.items.map((message) => message.id)).toEqual(
      storedMessages.map((message) => message.id)
    );
  });

  test("POST /api/chat/messages rejects non-participant sender", async () => {
    const alice = await createUser({
      id: "u_chat_5",
      name: "Alice",
      email: "alice_no_participant@example.com"
    });
    const bob = await createUser({
      id: "u_chat_6",
      name: "Bob",
      email: "bob_no_participant@example.com"
    });
    const eve = await createUser({
      id: "u_chat_7",
      name: "Eve",
      email: "eve_no_participant@example.com"
    });

    const convoRes = await request(app)
      .post("/api/chat/conversations")
      .set(authHeaders(alice))
      .send({ otherUserId: bob.id })
      .expect(201);
    const conversationId = convoRes.body.conversation.id;

    const denied = await request(app)
      .post("/api/chat/messages")
      .set(authHeaders(eve))
      .send({
        conversationId,
        type: "text",
        content: "hijack",
        clientMessageId: "cm_intruder"
      })
      .expect(400);

    expect(denied.body.message).toBe("Sender is not a participant of this conversation");
  });

  test("message delivery ack marks the recipient delivery row as delivered", async () => {
    const alice = await createUser({
      id: "u_chat_delivery_1",
      name: "Alice",
      email: "alice_delivery@example.com"
    });
    const bob = await createUser({
      id: "u_chat_delivery_2",
      name: "Bob",
      email: "bob_delivery@example.com"
    });

    const convoRes = await request(app)
      .post("/api/chat/conversations")
      .set(authHeaders(alice))
      .send({ otherUserId: bob.id })
      .expect(201);
    const conversationId = convoRes.body.conversation.id;

    const sent = await request(app)
      .post("/api/chat/messages")
      .set(authHeaders(alice))
      .send({
        conversationId,
        type: "text",
        content: "track delivery",
        clientMessageId: "cm_delivery_1"
      })
      .expect(201);

    const beforeAck = await prisma.messageDelivery.findUnique({
      where: {
        messageId_recipientId: {
          messageId: sent.body.message.id,
          recipientId: bob.id
        }
      }
    });
    expect(beforeAck?.status).toBe("pending");
    expect(beforeAck?.deliveredAt).toBeNull();

    const updated = await markMessageDeliveryDelivered({
      conversationId,
      messageId: sent.body.message.id,
      recipientId: bob.id
    });
    expect(updated.status).toBe("delivered");
    expect(updated.deliveredAt).not.toBeNull();

    const afterAck = await prisma.messageDelivery.findUnique({
      where: {
        messageId_recipientId: {
          messageId: sent.body.message.id,
          recipientId: bob.id
        }
      }
    });
    expect(afterAck?.status).toBe("delivered");
    expect(afterAck?.deliveredAt).not.toBeNull();
  });

  test("activity replay helper only re-emits to recipients whose deliveries are still pending", async () => {
    const alice = await createUser({
      id: "u_chat_retry_1",
      name: "Alice",
      email: "alice_retry@example.com"
    });
    const bob = await createUser({
      id: "u_chat_retry_2",
      name: "Bob",
      email: "bob_retry@example.com"
    });

    const convoRes = await request(app)
      .post("/api/chat/conversations")
      .set(authHeaders(alice))
      .send({ otherUserId: bob.id })
      .expect(201);
    const conversationId = convoRes.body.conversation.id;

    const sent = await request(app)
      .post("/api/chat/messages")
      .set(authHeaders(alice))
      .send({
        conversationId,
        type: "text",
        content: "retry me",
        clientMessageId: "cm_retry_delivery_1"
      })
      .expect(201);

    const emitted = [];
    const firstReplayCount = await replayPendingDeliveriesForRecipientNow({
      recipientId: bob.id,
      emitFn: (userId, event, payload) => {
        emitted.push({ userId, event, payload });
      }
    });
    expect(firstReplayCount).toBe(1);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].userId).toBe(bob.id);
    expect(emitted[0].event).toBe("message");
    expect(emitted[0].payload.delivery.messageId).toBe(sent.body.message.id);
    expect(emitted[0].payload.delivery.conversationId).toBe(conversationId);

    await markMessageDeliveryDelivered({
      conversationId,
      messageId: sent.body.message.id,
      recipientId: bob.id
    });

    const afterDeliveredReplayCount = await replayPendingDeliveriesForRecipientNow({
      recipientId: bob.id,
      emitFn: (userId, event, payload) => {
        emitted.push({ userId, event, payload });
      }
    });
    expect(afterDeliveredReplayCount).toBe(0);
    expect(emitted).toHaveLength(1);
  });

  test("activity replay helper coalesces immediate repeated triggers for the same recipient", async () => {
    const alice = await createUser({
      id: "u_chat_replay_coalesce_1",
      name: "Alice",
      email: "alice_replay_coalesce@example.com"
    });
    const bob = await createUser({
      id: "u_chat_replay_coalesce_2",
      name: "Bob",
      email: "bob_replay_coalesce@example.com"
    });

    const convoRes = await request(app)
      .post("/api/chat/conversations")
      .set(authHeaders(alice))
      .send({ otherUserId: bob.id })
      .expect(201);
    const conversationId = convoRes.body.conversation.id;

    const sent = await request(app)
      .post("/api/chat/messages")
      .set(authHeaders(alice))
      .send({
        conversationId,
        type: "text",
        content: "coalesce replay",
        clientMessageId: "cm_replay_coalesce_1"
      })
      .expect(201);

    const emitted = [];
    const firstReplayCount = await replayPendingDeliveriesForRecipientNow({
      recipientId: bob.id,
      emitFn: (userId, event, payload) => {
        emitted.push({ userId, event, payload });
      }
    });
    const secondReplayCount = await replayPendingDeliveriesForRecipientNow({
      recipientId: bob.id,
      emitFn: (userId, event, payload) => {
        emitted.push({ userId, event, payload });
      }
    });

    expect(firstReplayCount).toBe(1);
    expect(secondReplayCount).toBe(0);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].payload.delivery.messageId).toBe(sent.body.message.id);
  });

  test("reconnect-style replay re-emits all pending messages for a recipient across conversations", async () => {
    const alice = await createUser({
      id: "u_chat_reconnect_1",
      name: "Alice",
      email: "alice_reconnect@example.com"
    });
    const bob = await createUser({
      id: "u_chat_reconnect_2",
      name: "Bob",
      email: "bob_reconnect@example.com"
    });
    const carol = await createUser({
      id: "u_chat_reconnect_3",
      name: "Carol",
      email: "carol_reconnect@example.com"
    });

    const convoWithAlice = await request(app)
      .post("/api/chat/conversations")
      .set(authHeaders(alice))
      .send({ otherUserId: bob.id })
      .expect(201);
    const convoWithCarol = await request(app)
      .post("/api/chat/conversations")
      .set(authHeaders(carol))
      .send({ otherUserId: bob.id })
      .expect(201);

    const firstMessage = await request(app)
      .post("/api/chat/messages")
      .set(authHeaders(alice))
      .send({
        conversationId: convoWithAlice.body.conversation.id,
        type: "text",
        content: "pending from alice",
        clientMessageId: "cm_reconnect_1"
      })
      .expect(201);
    const secondMessage = await request(app)
      .post("/api/chat/messages")
      .set(authHeaders(carol))
      .send({
        conversationId: convoWithCarol.body.conversation.id,
        type: "text",
        content: "pending from carol",
        clientMessageId: "cm_reconnect_2"
      })
      .expect(201);

    const emitted = [];
    const replayCount = await replayPendingDeliveriesForRecipientNow({
      recipientId: bob.id,
      emitFn: (userId, event, payload) => {
        emitted.push({ userId, event, payload });
      }
    });

    expect(replayCount).toBe(2);
    expect(emitted).toHaveLength(2);
    expect(emitted.map((entry) => entry.userId)).toEqual([bob.id, bob.id]);
    expect(emitted.map((entry) => entry.event)).toEqual(["message", "message"]);
    expect(new Set(emitted.map((entry) => entry.payload.delivery.messageId))).toEqual(
      new Set([firstMessage.body.message.id, secondMessage.body.message.id])
    );
    expect(new Set(emitted.map((entry) => entry.payload.delivery.conversationId))).toEqual(
      new Set([convoWithAlice.body.conversation.id, convoWithCarol.body.conversation.id])
    );
  });

  test("activity replay helper can scope pending replay to one active conversation", async () => {
    const alice = await createUser({
      id: "u_chat_presence_replay_1",
      name: "Alice",
      email: "alice_presence_replay@example.com"
    });
    const bob = await createUser({
      id: "u_chat_presence_replay_2",
      name: "Bob",
      email: "bob_presence_replay@example.com"
    });
    const carol = await createUser({
      id: "u_chat_presence_replay_3",
      name: "Carol",
      email: "carol_presence_replay@example.com"
    });

    const convoWithAlice = await request(app)
      .post("/api/chat/conversations")
      .set(authHeaders(alice))
      .send({ otherUserId: bob.id })
      .expect(201);
    const convoWithCarol = await request(app)
      .post("/api/chat/conversations")
      .set(authHeaders(carol))
      .send({ otherUserId: bob.id })
      .expect(201);

    const firstMessage = await request(app)
      .post("/api/chat/messages")
      .set(authHeaders(alice))
      .send({
        conversationId: convoWithAlice.body.conversation.id,
        type: "text",
        content: "active conversation replay target",
        clientMessageId: "cm_presence_replay_1"
      })
      .expect(201);
    await request(app)
      .post("/api/chat/messages")
      .set(authHeaders(carol))
      .send({
        conversationId: convoWithCarol.body.conversation.id,
        type: "text",
        content: "other conversation should stay pending",
        clientMessageId: "cm_presence_replay_2"
      })
      .expect(201);

    const emitted = [];
    const replayCount = await replayPendingDeliveriesForRecipientNow({
      recipientId: bob.id,
      conversationId: convoWithAlice.body.conversation.id,
      emitFn: (userId, event, payload) => {
        emitted.push({ userId, event, payload });
      }
    });

    expect(replayCount).toBe(1);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].userId).toBe(bob.id);
    expect(emitted[0].event).toBe("message");
    expect(emitted[0].payload.delivery.messageId).toBe(firstMessage.body.message.id);
    expect(emitted[0].payload.delivery.conversationId).toBe(convoWithAlice.body.conversation.id);
  });

  test("single retry helper only re-emits recipients whose message deliveries are still pending", async () => {
    const alice = await createUser({
      id: "u_chat_retry_msg_1",
      name: "Alice",
      email: "alice_retry_msg@example.com"
    });
    const bob = await createUser({
      id: "u_chat_retry_msg_2",
      name: "Bob",
      email: "bob_retry_msg@example.com"
    });

    const convoRes = await request(app)
      .post("/api/chat/conversations")
      .set(authHeaders(alice))
      .send({ otherUserId: bob.id })
      .expect(201);
    const conversationId = convoRes.body.conversation.id;

    const sent = await request(app)
      .post("/api/chat/messages")
      .set(authHeaders(alice))
      .send({
        conversationId,
        type: "text",
        content: "retry once",
        clientMessageId: "cm_retry_message_once_1"
      })
      .expect(201);

    const emitted = [];
    const firstRetryCount = await retryPendingMessageDeliveryNow({
      message: sent.body.message,
      emitFn: (userId, event, payload) => {
        emitted.push({ userId, event, payload });
      }
    });
    expect(firstRetryCount).toBe(1);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].userId).toBe(bob.id);
    expect(emitted[0].event).toBe("message");
    expect(emitted[0].payload.delivery.messageId).toBe(sent.body.message.id);

    await markMessageDeliveryDelivered({
      conversationId,
      messageId: sent.body.message.id,
      recipientId: bob.id
    });

    const afterDeliveredRetryCount = await retryPendingMessageDeliveryNow({
      message: sent.body.message,
      emitFn: (userId, event, payload) => {
        emitted.push({ userId, event, payload });
      }
    });
    expect(afterDeliveredRetryCount).toBe(0);
    expect(emitted).toHaveLength(1);
  });

  test("GET /api/chat/conversations includes unreadCount and mark-read resets it", async () => {
    const alice = await createUser({
      id: "u_chat_8",
      name: "Alice",
      email: "alice_unread@example.com"
    });
    const bob = await createUser({
      id: "u_chat_9",
      name: "Bob",
      email: "bob_unread@example.com"
    });

    const convoRes = await request(app)
      .post("/api/chat/conversations")
      .set(authHeaders(alice))
      .send({ otherUserId: bob.id })
      .expect(201);
    const conversationId = convoRes.body.conversation.id;

    const sentByBob = await request(app)
      .post("/api/chat/messages")
      .set(authHeaders(bob))
      .send({
        conversationId,
        type: "text",
        content: "new for alice",
        clientMessageId: "cm_unread_1"
      })
      .expect(201);

    const convoListBefore = await request(app)
      .get("/api/chat/conversations")
      .set(authHeaders(alice))
      .expect(200);

    expect(convoListBefore.body.items).toHaveLength(1);
    expect(convoListBefore.body.items[0].unreadCount).toBe(1);
    expect(convoListBefore.body.items[0].lastMessage.id).toBe(sentByBob.body.message.id);

    await request(app)
      .post(`/api/chat/conversations/${conversationId}/read`)
      .set(authHeaders(alice))
      .send({ lastReadMessageId: sentByBob.body.message.id })
      .expect(200);

    const convoListAfter = await request(app)
      .get("/api/chat/conversations")
      .set(authHeaders(alice))
      .expect(200);

    expect(convoListAfter.body.items[0].unreadCount).toBe(0);
  });

  test("POST /api/chat/messages/:id/withdraw allows sender within window and rejects after expiry", async () => {
    const alice = await createUser({
      id: "u_chat_10",
      name: "Alice",
      email: "alice_withdraw@example.com"
    });
    const bob = await createUser({
      id: "u_chat_11",
      name: "Bob",
      email: "bob_withdraw@example.com"
    });

    const convoRes = await request(app)
      .post("/api/chat/conversations")
      .set(authHeaders(alice))
      .send({ otherUserId: bob.id })
      .expect(201);
    const conversationId = convoRes.body.conversation.id;

    const fresh = await request(app)
      .post("/api/chat/messages")
      .set(authHeaders(alice))
      .send({
        conversationId,
        type: "text",
        content: "withdraw me",
        clientMessageId: "cm_withdraw_1"
      })
      .expect(201);

    const withdrawOk = await request(app)
      .post(`/api/chat/messages/${fresh.body.message.id}/withdraw`)
      .set(authHeaders(alice))
      .expect(200);

    expect(withdrawOk.body.message.isWithdrawn).toBe(true);
    expect(withdrawOk.body.message.content).toBeNull();
    expect(withdrawOk.body.message.mediaObjectKey).toBeNull();

    const old = await request(app)
      .post("/api/chat/messages")
      .set(authHeaders(alice))
      .send({
        conversationId,
        type: "text",
        content: "too old",
        clientMessageId: "cm_withdraw_2"
      })
      .expect(201);

    await prisma.message.update({
      where: { id: old.body.message.id },
      data: {
        createdAt: new Date(Date.now() - 3 * 60 * 1000)
      }
    });

    const withdrawExpired = await request(app)
      .post(`/api/chat/messages/${old.body.message.id}/withdraw`)
      .set(authHeaders(alice))
      .expect(400);

    expect(withdrawExpired.body.message).toBe("Withdrawal window expired (2 minutes)");
  });
});
