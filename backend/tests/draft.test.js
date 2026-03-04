import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../server.js";
import { prepareTestDb } from "./helpers/prepareTestDb.js";

const prisma = new PrismaClient();

async function resetDb() {
  await prisma.transactionItem.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.draft.deleteMany();
  await prisma.goods.deleteMany();
  await prisma.user.deleteMany();
}

async function createUser({
  id,
  name = "Draft User",
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

describe("Draft listing integration", () => {
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

  test("POST /api/drafts creates a draft and returns parsed image list", async () => {
    await createUser({ id: "u_draft_1", email: "draft1@example.com" });

    const res = await request(app)
      .post("/api/drafts")
      .set("x-user-role", "user")
      .set("x-user-id", "u_draft_1")
      .send({
        title: "Road Bike",
        description: "Lightweight bike",
        price: 650,
        condition: "Good",
        category: "Sports",
        images: ["/api/uploads/goods/bike.jpg"],
        location: "Waterloo, ON"
      })
      .expect(201);

    expect(res.body).toHaveProperty("draft");
    expect(res.body.draft.title).toBe("Road Bike");
    expect(res.body.draft.images).toEqual(["/api/uploads/goods/bike.jpg"]);

    const storedDraft = await prisma.draft.findUnique({
      where: { id: res.body.draft.id }
    });
    expect(storedDraft).toBeTruthy();
    expect(storedDraft.images).toBe(JSON.stringify(["/api/uploads/goods/bike.jpg"]));
  });

  test("POST /api/drafts updates an existing draft for the same user", async () => {
    await createUser({ id: "u_draft_2", email: "draft2@example.com" });

    const existingDraft = await prisma.draft.create({
      data: {
        id: "d_existing_1",
        userId: "u_draft_2",
        title: "Old title",
        description: "Old desc",
        price: 10,
        condition: "Fair",
        category: "Books",
        images: JSON.stringify(["/api/uploads/goods/old.jpg"]),
        location: "Toronto, ON"
      }
    });

    const res = await request(app)
      .post("/api/drafts")
      .set("x-user-role", "user")
      .set("x-user-id", "u_draft_2")
      .send({
        id: existingDraft.id,
        title: "Updated title",
        description: "Updated desc",
        price: 88,
        condition: "Like New",
        category: "Electronics",
        images: ["/api/uploads/goods/new.jpg"],
        location: "Kitchener, ON"
      })
      .expect(200);

    expect(res.body.draft.id).toBe(existingDraft.id);
    expect(res.body.draft.title).toBe("Updated title");
    expect(res.body.draft.images).toEqual(["/api/uploads/goods/new.jpg"]);

    const dbDraft = await prisma.draft.findUnique({ where: { id: existingDraft.id } });
    expect(dbDraft.title).toBe("Updated title");
    expect(dbDraft.price).toBe(88);
    expect(dbDraft.category).toBe("Electronics");
  });

  test("GET /api/drafts returns only current user's drafts and latest updated first", async () => {
    await createUser({ id: "u_draft_3", email: "draft3@example.com" });
    await createUser({ id: "u_draft_4", email: "draft4@example.com" });

    const first = await prisma.draft.create({
      data: {
        id: "d_u3_1",
        userId: "u_draft_3",
        title: "First",
        category: "Books",
        images: JSON.stringify([])
      }
    });
    const second = await prisma.draft.create({
      data: {
        id: "d_u3_2",
        userId: "u_draft_3",
        title: "Second",
        category: "Books",
        images: JSON.stringify([])
      }
    });
    await prisma.draft.create({
      data: {
        id: "d_u4_1",
        userId: "u_draft_4",
        title: "Other user draft",
        category: "Books",
        images: JSON.stringify([])
      }
    });

    // Update the first draft to ensure it appears first by updatedAt desc.
    await request(app)
      .post("/api/drafts")
      .set("x-user-role", "user")
      .set("x-user-id", "u_draft_3")
      .send({
        id: first.id,
        title: "First updated",
        category: "Books",
        images: []
      })
      .expect(200);

    const res = await request(app)
      .get("/api/drafts")
      .set("x-user-role", "user")
      .set("x-user-id", "u_draft_3")
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.map((item) => item.id)).toEqual([first.id, second.id]);
    expect(res.body.items.map((item) => item.id)).not.toContain("d_u4_1");
  });

  test("POST /api/drafts validates missing user id and empty payload", async () => {
    await request(app)
      .post("/api/drafts")
      .set("x-user-role", "user")
      .send({ title: "No user id" })
      .expect(400);

    await createUser({ id: "u_draft_5", email: "draft5@example.com" });

    const emptyRes = await request(app)
      .post("/api/drafts")
      .set("x-user-role", "user")
      .set("x-user-id", "u_draft_5")
      .send({})
      .expect(400);

    expect(emptyRes.body.message).toBe("Draft is empty. Add some content first.");
  });

  test("DELETE /api/drafts/:id deletes owner draft and rejects non-owner", async () => {
    await createUser({ id: "u_draft_6", email: "draft6@example.com" });
    await createUser({ id: "u_draft_7", email: "draft7@example.com" });

    const draft = await prisma.draft.create({
      data: {
        id: "d_delete_1",
        userId: "u_draft_6",
        title: "Delete me",
        category: "Home",
        images: JSON.stringify([])
      }
    });

    await request(app)
      .delete(`/api/drafts/${draft.id}`)
      .set("x-user-role", "user")
      .set("x-user-id", "u_draft_7")
      .expect(404);

    await request(app)
      .delete(`/api/drafts/${draft.id}`)
      .set("x-user-role", "user")
      .set("x-user-id", "u_draft_6")
      .expect(204);

    const removed = await prisma.draft.findUnique({ where: { id: draft.id } });
    expect(removed).toBeNull();
  });
});
