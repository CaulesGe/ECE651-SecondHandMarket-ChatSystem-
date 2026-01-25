import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

const app = express();
const PORT = 3000;
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const seedIfEmpty = async () => {
  const userCount = await prisma.user.count();
  const goodsCount = await prisma.goods.count();

  if (userCount === 0) {
    await prisma.user.createMany({
      data: [
        {
          id: "u_admin",
          name: "Admin",
          email: "admin@secondhand.com",
          password: "admin123",
          role: "admin",
          createdAt: new Date("2026-01-01T09:00:00.000Z")
        },
        {
          id: "u_1001",
          name: "Jordan Lee",
          email: "jordan@example.com",
          password: "password123",
          role: "user",
          createdAt: new Date("2026-01-10T10:45:00.000Z")
        }
      ]
    });
  }

  if (goodsCount === 0) {
    await prisma.goods.createMany({
      data: [
        {
          id: "g_1001",
          title: "Vintage Walnut Desk",
          description:
            "Solid walnut desk with brass handles. Minor scratches, sturdy build.",
          price: 180,
          condition: "Good",
          category: "Furniture",
          images: JSON.stringify(["https://picsum.photos/seed/desk/600/400"]),
          sellerName: "Jordan Lee",
          location: "Waterloo, ON",
          listedAt: new Date("2026-01-12T14:12:00.000Z")
        },
        {
          id: "g_1002",
          title: "Gaming Chair - Raven Series",
          description:
            "Ergonomic chair with adjustable lumbar support. Clean, like-new.",
          price: 120,
          condition: "Like New",
          category: "Furniture",
          images: JSON.stringify(["https://picsum.photos/seed/chair/600/400"]),
          sellerName: "Avery Stone",
          location: "Kitchener, ON",
          listedAt: new Date("2026-01-15T09:30:00.000Z")
        },
        {
          id: "g_1003",
          title: "Mirrorless Camera Kit",
          description: "Includes 24-70mm lens, battery, and bag. Lightly used.",
          price: 540,
          condition: "Good",
          category: "Electronics",
          images: JSON.stringify(["https://picsum.photos/seed/camera/600/400"]),
          sellerName: "Sam Rivera",
          location: "Cambridge, ON",
          listedAt: new Date("2026-01-18T11:00:00.000Z")
        },
        {
          id: "g_1004",
          title: "Road Bike - 54cm",
          description:
            "Aluminum frame, recently tuned, includes lights and lock.",
          price: 320,
          condition: "Fair",
          category: "Sports",
          images: JSON.stringify(["https://picsum.photos/seed/bike/600/400"]),
          sellerName: "Maya Patel",
          location: "Waterloo, ON",
          listedAt: new Date("2026-01-19T16:20:00.000Z")
        },
        {
          id: "g_1005",
          title: "Kitchen Starter Bundle",
          description: "Pots, pans, and utensils. Clean and ready to use.",
          price: 75,
          condition: "Good",
          category: "Home",
          images: JSON.stringify(["https://picsum.photos/seed/kitchen/600/400"]),
          sellerName: "Noah Kim",
          location: "Waterloo, ON",
          listedAt: new Date("2026-01-20T08:45:00.000Z")
        }
      ]
    });
  }
};

const requireRole = (allowedRoles = []) => (req, res, next) => {
  const role = req.header("x-user-role");
  if (!role || !allowedRoles.includes(role)) {
    return res.status(403).json({ message: "Access denied." });
  }
  return next();
};

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required." });
  }
  const user = await prisma.user.findFirst({
    where: { email, password },
    select: { id: true, name: true, email: true, role: true }
  });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials." });
  }
  return res.json({
    user
  });
});

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required." });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  const exists = Boolean(existing);
  if (exists) {
    return res.status(409).json({ message: "Email already registered." });
  }
  const newUser = {
    id: `u_${Date.now()}`,
    name,
    email,
    password,
    role: "user",
    createdAt: new Date().toISOString()
  };
  await prisma.user.create({
    data: {
      ...newUser,
      createdAt: new Date(newUser.createdAt)
    }
  });
  return res.status(201).json({
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role
    }
  });
});

app.get("/api/goods", async (_req, res) => {
  const goods = await prisma.goods.findMany({
    orderBy: { listedAt: "desc" }
  });
  const items = goods.map((item) => ({
    ...item,
    images: item.images ? JSON.parse(item.images) : []
  }));
  res.json({ items });
});

app.post(
  "/api/goods",
  requireRole(["admin", "user"]),
  async (req, res) => {
    const {
      title,
      description,
      price,
      condition,
      category,
      images,
      location
    } = req.body || {};

    if (!title || !price || !condition || !category) {
      return res.status(400).json({ message: "Missing required fields." });
    }
    const sellerName = req.header("x-user-name") || "Community Seller";
    const newItem = {
      id: `g_${Date.now()}`,
      title,
      description: description || "",
      price: Number(price),
      condition,
      category,
      images: Array.isArray(images) && images.length > 0 ? images : [],
      sellerName,
      location: location || "Waterloo, ON",
      listedAt: new Date().toISOString()
    };
    await prisma.goods.create({
      data: {
        ...newItem,
        images: JSON.stringify(newItem.images),
        listedAt: new Date(newItem.listedAt)
      }
    });
    return res.status(201).json({ item: newItem });
  }
);

app.get("/api/users", requireRole(["admin"]), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true }
  });
  res.json({ items: users });
});

app.get("/api/transactions", requireRole(["admin"]), async (_req, res) => {
  const transactions = await prisma.transaction.findMany({
    select: { id: true, userId: true, total: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  });
  res.json({ items: transactions });
});

app.post(
  "/api/transactions/checkout",
  requireRole(["admin", "user"]),
  async (req, res) => {
    const { userId, items, payment } = req.body || {};
    if (!userId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Invalid checkout payload." });
    }

    const goods = await prisma.goods.findMany();
    const enrichedItems = items
      .map((item) => {
        const found = goods.find((g) => g.id === item.id);
        if (!found) {
          return null;
        }
        return {
          id: found.id,
          title: found.title,
          price: found.price,
          quantity: Number(item.quantity || 1)
        };
      })
      .filter(Boolean);

    const total = enrichedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const cardNumber = payment?.cardNumber || "";
    const last4 = cardNumber ? cardNumber.slice(-4) : "0000";

    const newTransaction = {
      id: `t_${Date.now()}`,
      userId,
      items: enrichedItems,
      total,
      payment: {
        method: "card",
        last4
      },
      status: "pending",
      createdAt: new Date().toISOString()
    };

    await prisma.transaction.create({
      data: {
        id: newTransaction.id,
        userId: newTransaction.userId,
        total: newTransaction.total,
        status: newTransaction.status,
        createdAt: new Date(newTransaction.createdAt),
        last4: newTransaction.payment.last4,
        items: {
          create: enrichedItems.map((item) => ({
            goodsId: item.id,
            title: item.title,
            price: item.price,
            quantity: item.quantity
          }))
        }
      }
    });

    return res.status(201).json({ transaction: newTransaction });
  }
);

const start = async () => {
  await prisma.$connect();
  await seedIfEmpty();
  app.listen(PORT, () => {
    console.log(`API server running at http://localhost:${PORT}`);
  });
};

start();
