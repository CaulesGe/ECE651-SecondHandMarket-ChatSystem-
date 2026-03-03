import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../server.js";
import { prepareTestDb } from "./helpers/prepareTestDb.js";

const prisma = new PrismaClient();

async function resetDb() {
  // Include draft because server.js has /api/drafts routes and Draft likely references userId.
  // Keeping deletes ordered from "leaf" -> "root" is safest.
  await prisma.transactionItem.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.draft.deleteMany();
  await prisma.goods.deleteMany();
  await prisma.user.deleteMany();
}

describe("Goods (product detail) integration", () => {
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

  test("GET /api/goods/:id returns product detail with parsed images", async () => {
    await prisma.goods.create({
      data: {
        id: "g_test_1",
        title: "Test Laptop",
        description: "Good condition",
        price: 999,
        condition: "Good",
        category: "Electronics",
        images: JSON.stringify(["https://example.com/a.jpg", "https://example.com/b.png"]),
        sellerName: "Tester",
        sellerId: "u_seller_1",
        location: "Waterloo, ON",
        listedAt: new Date()
      }
    });

    const res = await request(app)
      .get("/api/goods/g_test_1")
      .expect(200);

    expect(res.body).toHaveProperty("item");
    expect(res.body.item.id).toBe("g_test_1");
    expect(res.body.item.title).toBe("Test Laptop");

    // server.js parses item.images from JSON string -> array
    expect(Array.isArray(res.body.item.images)).toBe(true);
    expect(res.body.item.images).toEqual([
      "https://example.com/a.jpg",
      "https://example.com/b.png"
    ]);
  });

  test("GET /api/goods/:id returns 404 when product not found", async () => {
    const res = await request(app)
      .get("/api/goods/does_not_exist")
      .expect(404);

    expect(res.body.message).toBe("Product not found");
  });

  test("GET /api/goods supports search, category filter, and limit", async () => {
    await prisma.goods.createMany({
      data: [
        {
          id: "g_a",
          title: "Sony Headphones",
          description: "Noise cancelling",
          price: 200,
          condition: "Like New",
          category: "Electronics",
          images: JSON.stringify(["x"]),
          sellerName: "Seller A",
          sellerId: "u_admin",
          location: "Toronto, ON",
          listedAt: new Date("2026-01-10T10:00:00.000Z")
        },
        {
          id: "g_b",
          title: "Oak Dining Table",
          description: "Solid oak",
          price: 500,
          condition: "Good",
          category: "Furniture",
          images: JSON.stringify([]),
          sellerName: "Seller B",
          sellerId: "u_admin",
          location: "Waterloo, ON",
          listedAt: new Date("2026-01-11T10:00:00.000Z")
        },
        {
          id: "g_c",
          title: "Sony Camera",
          description: "Mirrorless camera body",
          price: 1200,
          condition: "Good",
          category: "Electronics",
          images: JSON.stringify(["y"]),
          sellerName: "Seller C",
          sellerId: "u_admin",
          location: "Kitchener, ON",
          listedAt: new Date("2026-01-12T10:00:00.000Z")
        }
      ]
    });

    // Search (matches title/description/category via OR)
    const searchRes = await request(app)
      .get("/api/goods")
      .query({ search: "Sony" })
      .expect(200);

    expect(Array.isArray(searchRes.body.items)).toBe(true);
    const ids = searchRes.body.items.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(["g_a", "g_c"]));
    expect(ids).not.toEqual(expect.arrayContaining(["g_b"]));

    // Category filter (category !== "All")
    const catRes = await request(app)
      .get("/api/goods")
      .query({ category: "Furniture" })
      .expect(200);

    expect(catRes.body.items).toHaveLength(1);
    expect(catRes.body.items[0].id).toBe("g_b");

    // Limit
    const limitRes = await request(app)
      .get("/api/goods")
      .query({ limit: 1 })
      .expect(200);

    expect(limitRes.body.items).toHaveLength(1);
  });

  test("GET /api/goods/:id/recommendations excludes current item and prioritizes same category", async () => {
    // Current item (Electronics)
    await prisma.goods.create({
      data: {
        id: "g_cur",
        title: "Current Item",
        description: "",
        price: 10,
        condition: "Good",
        category: "Electronics",
        images: JSON.stringify([]),
        sellerName: "Seller",
        sellerId: "u_admin",
        location: "Waterloo, ON",
        listedAt: new Date("2026-01-20T10:00:00.000Z")
      }
    });

    // Same category items
    await prisma.goods.createMany({
      data: [
        {
          id: "g_e1",
          title: "Electronics 1",
          description: "",
          price: 11,
          condition: "Good",
          category: "Electronics",
          images: JSON.stringify([]),
          sellerName: "Seller",
          sellerId: "u_admin",
          location: "Waterloo, ON",
          listedAt: new Date("2026-01-21T10:00:00.000Z")
        },
        {
          id: "g_e2",
          title: "Electronics 2",
          description: "",
          price: 12,
          condition: "Good",
          category: "Electronics",
          images: JSON.stringify([]),
          sellerName: "Seller",
          sellerId: "u_admin",
          location: "Waterloo, ON",
          listedAt: new Date("2026-01-22T10:00:00.000Z")
        }
      ]
    });

    // Other category items (used as backfill)
    await prisma.goods.createMany({
      data: [
        {
          id: "g_o1",
          title: "Other 1",
          description: "",
          price: 21,
          condition: "Good",
          category: "Furniture",
          images: JSON.stringify([]),
          sellerName: "Seller",
          sellerId: "u_admin",
          location: "Waterloo, ON",
          listedAt: new Date("2026-01-23T10:00:00.000Z")
        },
        {
          id: "g_o2",
          title: "Other 2",
          description: "",
          price: 22,
          condition: "Good",
          category: "Books",
          images: JSON.stringify([]),
          sellerName: "Seller",
          sellerId: "u_admin",
          location: "Waterloo, ON",
          listedAt: new Date("2026-01-24T10:00:00.000Z")
        }
      ]
    });

    const res = await request(app)
      .get("/api/goods/g_cur/recommendations")
      .query({ limit: 3 })
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(3);

    const returnedIds = res.body.items.map((x) => x.id);
    expect(returnedIds).not.toContain("g_cur");

    // Should include same-category items if available
    expect(returnedIds).toEqual(expect.arrayContaining(["g_e1", "g_e2"]));

    // Returned items should have images parsed to arrays
    for (const item of res.body.items) {
      expect(Array.isArray(item.images)).toBe(true);
    }
  });

  test("GET /api/categories returns unique sorted categories", async () => {
    await prisma.goods.createMany({
      data: [
        {
          id: "g1",
          title: "A",
          description: "",
          price: 1,
          condition: "Good",
          category: "Furniture",
          images: JSON.stringify([]),
          sellerName: "S",
          sellerId: "u_admin",
          location: "X",
          listedAt: new Date()
        },
        {
          id: "g2",
          title: "B",
          description: "",
          price: 2,
          condition: "Good",
          category: "Electronics",
          images: JSON.stringify([]),
          sellerName: "S",
          sellerId: "u_admin",
          location: "X",
          listedAt: new Date()
        },
        {
          id: "g3",
          title: "C",
          description: "",
          price: 3,
          condition: "Good",
          category: "Electronics",
          images: JSON.stringify([]),
          sellerName: "S",
          sellerId: "u_admin",
          location: "X",
          listedAt: new Date()
        }
      ]
    });

    const res = await request(app)
      .get("/api/categories")
      .expect(200);

    expect(res.body.categories).toEqual(["Electronics", "Furniture"]);
  });

  test("POST /api/goods creates a listing (requires role header) and returns parsed images", async () => {
    // Missing role -> 403
    await request(app)
      .post("/api/goods")
      .send({
        title: "X",
        price: 10,
        condition: "Good",
        category: "Electronics"
      })
      .expect(403);

    // With role -> 201
    const created = await request(app)
      .post("/api/goods")
      .set("x-user-role", "user")
      .set("x-user-id", "u_test_seller")
      .set("x-user-name", "Test Seller")
      .send({
        title: "New Listing",
        description: "desc",
        price: 123.45,
        condition: "Like New",
        category: "Electronics",
        images: ["/api/uploads/goods/a.jpg"],
        location: "Toronto, ON"
      })
      .expect(201);

    expect(created.body).toHaveProperty("item");
    expect(created.body.item.title).toBe("New Listing");
    expect(created.body.item.sellerName).toBe("Test Seller");
    expect(created.body.item.sellerId).toBe("u_test_seller");
    expect(Array.isArray(created.body.item.images)).toBe(true);
    expect(created.body.item.images).toEqual(["/api/uploads/goods/a.jpg"]);

    // Confirm persisted
    const dbItem = await prisma.goods.findUnique({ where: { id: created.body.item.id } });
    expect(dbItem).toBeTruthy();
    expect(dbItem.title).toBe("New Listing");
  });

  test("POST /api/goods validates required fields", async () => {
    const res = await request(app)
      .post("/api/goods")
      .set("x-user-role", "user")
      .send({ title: "Missing stuff" }) // missing price/condition/category
      .expect(400);

    expect(res.body.message).toBe("Missing required fields.");
  });

  test("POST /api/goods falls back to default seller, location, and empty images", async () => {
    const res = await request(app)
      .post("/api/goods")
      .set("x-user-role", "user")
      .send({
        title: "Desk Lamp",
        price: 35,
        condition: "Good",
        category: "Home"
      })
      .expect(201);

    expect(res.body.item.title).toBe("Desk Lamp");
    expect(res.body.item.sellerName).toBe("Community Seller");
    expect(res.body.item.sellerId).toBeNull();
    expect(res.body.item.location).toBe("Waterloo, ON");
    expect(res.body.item.images).toEqual([]);
  });
});
