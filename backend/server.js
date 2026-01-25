import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbDir = path.resolve(__dirname, "..", "database");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const readJson = async (filename) => {
  const data = await fs.readFile(path.join(dbDir, filename), "utf-8");
  return JSON.parse(data);
};

const writeJson = async (filename, payload) => {
  await fs.writeFile(
    path.join(dbDir, filename),
    JSON.stringify(payload, null, 2),
    "utf-8"
  );
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
  const users = await readJson("users.json");
  const user = users.find(
    (item) => item.email === email && item.password === password
  );
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials." });
  }
  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required." });
  }
  const users = await readJson("users.json");
  const exists = users.some((item) => item.email === email);
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
  users.push(newUser);
  await writeJson("users.json", users);
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
  const goods = await readJson("goods.json");
  res.json({ items: goods });
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
    const goods = await readJson("goods.json");
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
    goods.unshift(newItem);
    await writeJson("goods.json", goods);
    return res.status(201).json({ item: newItem });
  }
);

app.get("/api/users", requireRole(["admin"]), async (_req, res) => {
  const users = await readJson("users.json");
  res.json({ items: users });
});

app.get("/api/transactions", requireRole(["admin"]), async (_req, res) => {
  const transactions = await readJson("transactions.json");
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

    const goods = await readJson("goods.json");
    const transactions = await readJson("transactions.json");

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

    transactions.unshift(newTransaction);
    await writeJson("transactions.json", transactions);

    return res.status(201).json({ transaction: newTransaction });
  }
);

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
