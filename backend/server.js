import express from "express";
import cors from "cors";
import path from "path";
import http from "http";
import fs from "fs";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { mountChatService } from "./chat/index.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import multer from "multer";
import { isEmailConfigured, sendVerificationEmail } from "./email.js";
import { closeRedis, initRedis } from "./utils/redis.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const prisma = new PrismaClient();
const httpServer = http.createServer(app);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const goodsUploadsDir = path.join(__dirname, "uploads", "goods");
const allowedImageExts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

fs.mkdirSync(goodsUploadsDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/api/uploads", express.static(path.join(__dirname, "uploads")));

const goodsImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, goodsUploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = allowedImageExts.has(ext) ? ext : ".jpg";
      cb(null, `${Date.now()}-${crypto.randomUUID()}${safeExt}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedImageMimeTypes.has(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, WEBP, and GIF images are allowed."));
    }
    return cb(null, true);
  }
});

// Serve static files from the client build directory in production
const clientDistPath = path.join(__dirname, "../client/dist");
if (process.env.NODE_ENV === "production") {
  app.use(express.static(clientDistPath));
}

function getClientUrl() {
  if (process.env.CLIENT_URL) return process.env.CLIENT_URL;
  return process.env.NODE_ENV === "production"
    ? "http://localhost:3000"
    : "http://localhost:5173";
}

function makeToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("Email is not configured: missing SMTP_HOST/SMTP_USER/SMTP_PASS");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 587 -> STARTTLS, secure false
    auth: { user, pass }
  });
}

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const transporter = createTransporter();
  const from = process.env.MAIL_FROM || "Secondhand Hub <no-reply@secondhand.com>";
  const subject = "Reset your password for Secondhand Hub";
  await transporter.sendMail({
    from,
    to,
    subject: subject,
    text: 
      `Hi ${name || "there"},
      We received a request to reset your password for Secondhand Hub.
      Use this link to set a new password: 
      ${resetUrl}.
      If you did not request this, you can ignore this email.`
    ,
    html: 
      `<div style="font-family: Arial, sans-serif; line-height: 1.5;">
    <h2>Reset your password for Secondhand Hub</h2>
    <p>Hi ${name || "there"},</p>
    <p>Please reset your password for Secondhand Hub by clicking the button below:</p>
    <p>
      <a href="${resetUrl}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">
        Reset Password
      </a>
    </p>
    <p style="color:#666;font-size:12px;">
      If you didn't make this request, you can ignore this email.
    </p>
  </div>`
  });
}

app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const genericMessage = "If that email exists, a password reset link has been sent.";

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  // Do not reveal whether the account exists.
  // Also do not overwrite verification token flow for unverified users.
  if (!user || !user.emailVerified) {
    return res.json({ message: genericMessage });
  }

  const token = makeToken();
  const expires = new Date(Date.now() + 1000 * 60 * 15);
  const resetUrl = `${getClientUrl()}/reset-password?token=${token}`;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationToken: token,
      verificationExpires: expires
    }
  });

  if (!isEmailConfigured()) {
    console.log("[FORGOT PASSWORD]", normalizedEmail, "resetUrl=", resetUrl);
    return res.json({ message: genericMessage });
  }

  try {
    await sendPasswordResetEmail({
      to: normalizedEmail,
      name: user.name,
      resetUrl
    });
  } catch (e) {
    console.error("[FORGOT PASSWORD] email send failed:", e?.message || e);
  }

  return res.json({ message: genericMessage });
});

app.get("/api/auth/reset-password/validate", async (req, res) => {
  const token = String(req.query.token || "").trim();

  if (!token) {
    return res.status(400).json({ valid: false, message: "Missing token." });
  }

  const user = await prisma.user.findFirst({
    where: {
      verificationToken: token,
      emailVerified: true
    }
  });

  if (!user) {
    return res.status(400).json({ valid: false, message: "Invalid token." });
  }

  if (!user.verificationExpires || user.verificationExpires < new Date()) {
    return res.status(400).json({ valid: false, message: "Token expired." });
  }

  return res.json({ valid: true });
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { token, password, confirmPassword } = req.body || {};

  if (!token || !password || !confirmPassword) {
    return res.status(400).json({
      message: "Token, password, and confirmPassword are required."
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      message: "Password must be at least 6 characters."
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      message: "Passwords do not match."
    });
  }

  const user = await prisma.user.findFirst({
    where: {
      verificationToken: String(token),
      emailVerified: true
    }
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid token." });
  }

  if (!user.verificationExpires || user.verificationExpires < new Date()) {
    return res.status(400).json({ message: "Token expired." });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password,
      verificationToken: null,
      verificationExpires: null
    }
  });

  return res.json({ message: "Password reset successfully." });
});

// Expanded dummy data with many more products
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
          emailVerified: true,
          createdAt: new Date("2026-01-01T09:00:00.000Z")
        },
        {
          id: "u_1001",
          name: "Jordan Lee",
          email: "jordan@example.com",
          password: "password123",
          role: "user",
          emailVerified: true,
          createdAt: new Date("2026-01-10T10:45:00.000Z")
        }
      ]
    });
  }

  if (goodsCount === 0) {
    const dummyGoods = [
      // Electronics
      { id: "g_1001", title: "MacBook Pro 14\" M2", description: "2023 model, 16GB RAM, 512GB SSD. Excellent condition with original charger and box. Battery health at 95%.", price: 1450, condition: "Like New", category: "Electronics", images: JSON.stringify(["https://picsum.photos/seed/macbook/600/400"]), sellerName: "Alex Chen", location: "Toronto, ON", listedAt: new Date("2026-01-20T10:00:00.000Z") },
      { id: "g_1002", title: "Sony WH-1000XM5 Headphones", description: "Premium noise-cancelling headphones. Includes carrying case and cables. Used for 3 months.", price: 280, condition: "Like New", category: "Electronics", images: JSON.stringify(["https://picsum.photos/seed/headphones/600/400"]), sellerName: "Emma Wilson", location: "Waterloo, ON", listedAt: new Date("2026-01-19T14:30:00.000Z") },
      { id: "g_1003", title: "iPad Air 5th Gen", description: "64GB WiFi model, Space Gray. Comes with Apple Pencil 2nd gen and Smart Folio case.", price: 520, condition: "Good", category: "Electronics", images: JSON.stringify(["https://picsum.photos/seed/ipad/600/400"]), sellerName: "Michael Brown", location: "Kitchener, ON", listedAt: new Date("2026-01-18T09:15:00.000Z") },
      { id: "g_1004", title: "Samsung 4K Smart TV 55\"", description: "Crystal UHD display, built-in streaming apps. Wall mount included. Minor scratch on frame.", price: 380, condition: "Good", category: "Electronics", images: JSON.stringify(["https://picsum.photos/seed/tv/600/400"]), sellerName: "Sarah Davis", location: "Cambridge, ON", listedAt: new Date("2026-01-17T16:45:00.000Z") },
      { id: "g_1005", title: "Nintendo Switch OLED", description: "White model with dock and Joy-Cons. Includes 3 games: Zelda, Mario Kart, Animal Crossing.", price: 320, condition: "Like New", category: "Electronics", images: JSON.stringify(["https://picsum.photos/seed/switch/600/400"]), sellerName: "David Kim", location: "Waterloo, ON", listedAt: new Date("2026-01-16T11:20:00.000Z") },
      { id: "g_1006", title: "Canon EOS R6 Camera Body", description: "Professional mirrorless camera. Shutter count under 5000. Includes extra battery.", price: 1650, condition: "Good", category: "Electronics", images: JSON.stringify(["https://picsum.photos/seed/canon/600/400"]), sellerName: "Lisa Park", location: "Toronto, ON", listedAt: new Date("2026-01-15T13:00:00.000Z") },
      { id: "g_1007", title: "Apple Watch Series 8", description: "45mm GPS, Midnight aluminum case. Includes 3 extra bands and charger.", price: 340, condition: "Like New", category: "Electronics", images: JSON.stringify(["https://picsum.photos/seed/watch/600/400"]), sellerName: "James Miller", location: "Waterloo, ON", listedAt: new Date("2026-01-14T08:30:00.000Z") },
      { id: "g_1008", title: "Bose SoundLink Revolve+", description: "Portable Bluetooth speaker with 360° sound. Great bass, long battery life.", price: 180, condition: "Good", category: "Electronics", images: JSON.stringify(["https://picsum.photos/seed/bose/600/400"]), sellerName: "Anna Lee", location: "Guelph, ON", listedAt: new Date("2026-01-13T15:45:00.000Z") },

      // Furniture
      { id: "g_2001", title: "IKEA MALM Queen Bed Frame", description: "White oak veneer, includes slats. Disassembled for easy transport. Minor wear.", price: 180, condition: "Good", category: "Furniture", images: JSON.stringify(["https://picsum.photos/seed/bed/600/400"]), sellerName: "Chris Taylor", location: "Waterloo, ON", listedAt: new Date("2026-01-20T12:00:00.000Z") },
      { id: "g_2002", title: "Herman Miller Aeron Chair", description: "Size B, fully loaded with lumbar support. Remastered edition. Some mesh wear.", price: 650, condition: "Good", category: "Furniture", images: JSON.stringify(["https://picsum.photos/seed/aeron/600/400"]), sellerName: "Rachel Green", location: "Toronto, ON", listedAt: new Date("2026-01-19T10:30:00.000Z") },
      { id: "g_2003", title: "West Elm Mid-Century Sofa", description: "3-seater in dove gray. Solid wood legs. Pet-free, smoke-free home.", price: 890, condition: "Like New", category: "Furniture", images: JSON.stringify(["https://picsum.photos/seed/sofa/600/400"]), sellerName: "Tom Anderson", location: "Kitchener, ON", listedAt: new Date("2026-01-18T14:00:00.000Z") },
      { id: "g_2004", title: "Standing Desk - Electric", description: "60x30 inch bamboo top. Height adjustable 28-48 inches. Memory presets.", price: 350, condition: "Like New", category: "Furniture", images: JSON.stringify(["https://picsum.photos/seed/standingdesk/600/400"]), sellerName: "Jennifer White", location: "Waterloo, ON", listedAt: new Date("2026-01-17T09:00:00.000Z") },
      { id: "g_2005", title: "Vintage Leather Armchair", description: "Genuine brown leather, classic design. Some patina adds character.", price: 420, condition: "Fair", category: "Furniture", images: JSON.stringify(["https://picsum.photos/seed/armchair/600/400"]), sellerName: "Robert Brown", location: "Cambridge, ON", listedAt: new Date("2026-01-16T16:30:00.000Z") },
      { id: "g_2006", title: "IKEA KALLAX Shelf Unit", description: "4x4 white shelving unit. Includes 8 fabric inserts. Great for records or books.", price: 120, condition: "Good", category: "Furniture", images: JSON.stringify(["https://picsum.photos/seed/kallax/600/400"]), sellerName: "Emily Johnson", location: "Waterloo, ON", listedAt: new Date("2026-01-15T11:15:00.000Z") },
      { id: "g_2007", title: "Solid Oak Dining Table", description: "Seats 6, expandable to 8. Includes 4 matching chairs. Minor surface scratches.", price: 580, condition: "Good", category: "Furniture", images: JSON.stringify(["https://picsum.photos/seed/dining/600/400"]), sellerName: "Daniel Lee", location: "Toronto, ON", listedAt: new Date("2026-01-14T13:45:00.000Z") },

      // Clothing
      { id: "g_3001", title: "Canada Goose Expedition Parka", description: "Men's Large, black. Worn one season. Authentic with tags.", price: 680, condition: "Like New", category: "Clothing", images: JSON.stringify(["https://picsum.photos/seed/parka/600/400"]), sellerName: "Kevin Zhang", location: "Toronto, ON", listedAt: new Date("2026-01-20T08:00:00.000Z") },
      { id: "g_3002", title: "Lululemon Align Leggings Bundle", description: "5 pairs, size 6. Various colors. Minimal pilling.", price: 180, condition: "Good", category: "Clothing", images: JSON.stringify(["https://picsum.photos/seed/leggings/600/400"]), sellerName: "Megan Smith", location: "Waterloo, ON", listedAt: new Date("2026-01-19T15:00:00.000Z") },
      { id: "g_3003", title: "Nike Air Jordan 1 Retro High", description: "Chicago colorway, Size 10. DS with original box and receipt.", price: 380, condition: "Like New", category: "Clothing", images: JSON.stringify(["https://picsum.photos/seed/jordan/600/400"]), sellerName: "Brandon Lee", location: "Mississauga, ON", listedAt: new Date("2026-01-18T12:30:00.000Z") },
      { id: "g_3004", title: "Patagonia Nano Puff Jacket", description: "Women's Medium, black. Lightweight and packable. Great for layering.", price: 140, condition: "Good", category: "Clothing", images: JSON.stringify(["https://picsum.photos/seed/patagonia/600/400"]), sellerName: "Olivia Martin", location: "Kitchener, ON", listedAt: new Date("2026-01-17T10:45:00.000Z") },
      { id: "g_3005", title: "Vintage Levi's 501 Jeans", description: "1990s made in USA, W32 L32. Classic faded wash.", price: 95, condition: "Good", category: "Clothing", images: JSON.stringify(["https://picsum.photos/seed/levis/600/400"]), sellerName: "Sophie Wilson", location: "Toronto, ON", listedAt: new Date("2026-01-16T14:20:00.000Z") },
      { id: "g_3006", title: "Arc'teryx Beta AR Jacket", description: "Men's Medium, black. Gore-Tex Pro. Used for one ski season.", price: 420, condition: "Like New", category: "Clothing", images: JSON.stringify(["https://picsum.photos/seed/arcteryx/600/400"]), sellerName: "Nathan Park", location: "Waterloo, ON", listedAt: new Date("2026-01-15T09:30:00.000Z") },

      // Sports & Outdoors
      { id: "g_4001", title: "Peloton Bike+ with Accessories", description: "Less than 100 rides. Includes mat, weights, heart rate monitor, and shoes (size 42).", price: 1400, condition: "Like New", category: "Sports", images: JSON.stringify(["https://picsum.photos/seed/peloton/600/400"]), sellerName: "Amanda Clark", location: "Toronto, ON", listedAt: new Date("2026-01-20T11:30:00.000Z") },
      { id: "g_4002", title: "Trek Domane SL5 Road Bike", description: "56cm frame, Shimano 105. Carbon frame, about 2000km. Recently serviced.", price: 2200, condition: "Good", category: "Sports", images: JSON.stringify(["https://picsum.photos/seed/trek/600/400"]), sellerName: "Ryan Thompson", location: "Waterloo, ON", listedAt: new Date("2026-01-19T16:00:00.000Z") },
      { id: "g_4003", title: "Bowflex Adjustable Dumbbells", description: "SelectTech 552 pair. 5-52.5 lbs each. Includes stand.", price: 380, condition: "Good", category: "Sports", images: JSON.stringify(["https://picsum.photos/seed/bowflex/600/400"]), sellerName: "Jessica Adams", location: "Kitchener, ON", listedAt: new Date("2026-01-18T13:15:00.000Z") },
      { id: "g_4004", title: "Burton Custom Snowboard 158", description: "2023 model with Burton Cartel bindings. Used 10 days.", price: 480, condition: "Like New", category: "Sports", images: JSON.stringify(["https://picsum.photos/seed/snowboard/600/400"]), sellerName: "Tyler Moore", location: "Collingwood, ON", listedAt: new Date("2026-01-17T15:45:00.000Z") },
      { id: "g_4005", title: "Yoga Mat & Props Bundle", description: "Manduka Pro mat, 2 blocks, strap, and bolster. Premium set.", price: 120, condition: "Good", category: "Sports", images: JSON.stringify(["https://picsum.photos/seed/yoga/600/400"]), sellerName: "Grace Kim", location: "Waterloo, ON", listedAt: new Date("2026-01-16T10:00:00.000Z") },
      { id: "g_4006", title: "Camping Tent 4-Person", description: "MSR Hubba Hubba 4. Ultralight backpacking tent. Used 5 trips.", price: 340, condition: "Good", category: "Sports", images: JSON.stringify(["https://picsum.photos/seed/tent/600/400"]), sellerName: "Mark Robinson", location: "Guelph, ON", listedAt: new Date("2026-01-15T14:30:00.000Z") },
      { id: "g_4007", title: "Golf Club Set - TaylorMade", description: "Full set with bag: driver, woods, irons, putter. Great for intermediate players.", price: 650, condition: "Good", category: "Sports", images: JSON.stringify(["https://picsum.photos/seed/golf/600/400"]), sellerName: "Paul Harris", location: "Oakville, ON", listedAt: new Date("2026-01-14T12:00:00.000Z") },

      // Books & Media
      { id: "g_5001", title: "Computer Science Textbook Bundle", description: "15 textbooks covering algorithms, data structures, OS, networking. Great for CS students.", price: 180, condition: "Good", category: "Books", images: JSON.stringify(["https://picsum.photos/seed/textbooks/600/400"]), sellerName: "Amy Wang", location: "Waterloo, ON", listedAt: new Date("2026-01-20T09:30:00.000Z") },
      { id: "g_5002", title: "Manga Collection - One Piece Vol 1-50", description: "English edition, excellent condition. All volumes in order.", price: 350, condition: "Like New", category: "Books", images: JSON.stringify(["https://picsum.photos/seed/manga/600/400"]), sellerName: "Ken Tanaka", location: "Toronto, ON", listedAt: new Date("2026-01-19T11:00:00.000Z") },
      { id: "g_5003", title: "Vinyl Record Collection", description: "50+ records: classic rock, jazz, 80s pop. Beatles, Pink Floyd, Miles Davis.", price: 280, condition: "Good", category: "Books", images: JSON.stringify(["https://picsum.photos/seed/vinyl/600/400"]), sellerName: "Steve Martin", location: "Hamilton, ON", listedAt: new Date("2026-01-18T14:45:00.000Z") },
      { id: "g_5004", title: "Harry Potter Complete Box Set", description: "Hardcover illustrated editions. Minor shelf wear on boxes.", price: 120, condition: "Good", category: "Books", images: JSON.stringify(["https://picsum.photos/seed/harrypotter/600/400"]), sellerName: "Laura Thompson", location: "Waterloo, ON", listedAt: new Date("2026-01-17T08:15:00.000Z") },

      // Home & Kitchen
      { id: "g_6001", title: "Dyson V15 Detect Vacuum", description: "Cordless stick vacuum with laser dust detection. All attachments included.", price: 480, condition: "Like New", category: "Home", images: JSON.stringify(["https://picsum.photos/seed/dyson/600/400"]), sellerName: "Nicole Brown", location: "Toronto, ON", listedAt: new Date("2026-01-20T14:00:00.000Z") },
      { id: "g_6002", title: "KitchenAid Stand Mixer", description: "Artisan 5-quart, Empire Red. Includes pasta attachment and meat grinder.", price: 320, condition: "Good", category: "Home", images: JSON.stringify(["https://picsum.photos/seed/kitchenaid/600/400"]), sellerName: "Maria Garcia", location: "Kitchener, ON", listedAt: new Date("2026-01-19T09:45:00.000Z") },
      { id: "g_6003", title: "Nespresso Vertuo Plus Bundle", description: "Coffee machine with milk frother. Includes 100 capsule variety pack.", price: 180, condition: "Like New", category: "Home", images: JSON.stringify(["https://picsum.photos/seed/nespresso/600/400"]), sellerName: "Carlos Rodriguez", location: "Waterloo, ON", listedAt: new Date("2026-01-18T16:30:00.000Z") },
      { id: "g_6004", title: "Le Creuset Dutch Oven 5.5qt", description: "Flame orange, cast iron. Some enamel wear inside but works perfectly.", price: 220, condition: "Good", category: "Home", images: JSON.stringify(["https://picsum.photos/seed/lecreuset/600/400"]), sellerName: "Julia Chen", location: "Toronto, ON", listedAt: new Date("2026-01-17T11:00:00.000Z") },
      { id: "g_6005", title: "Roomba i7+ Robot Vacuum", description: "Self-emptying base included. Clean Base bags (3 extra). Smart mapping.", price: 380, condition: "Good", category: "Home", images: JSON.stringify(["https://picsum.photos/seed/roomba/600/400"]), sellerName: "David Park", location: "Mississauga, ON", listedAt: new Date("2026-01-16T13:30:00.000Z") },
      { id: "g_6006", title: "Air Purifier - Coway Airmega", description: "400S model, covers 1560 sq ft. Smart features, quiet operation.", price: 280, condition: "Like New", category: "Home", images: JSON.stringify(["https://picsum.photos/seed/airpurifier/600/400"]), sellerName: "Hannah Lee", location: "Waterloo, ON", listedAt: new Date("2026-01-15T15:00:00.000Z") },

      // Musical Instruments
      { id: "g_7001", title: "Fender Player Stratocaster", description: "Sunburst finish, maple neck. Includes gig bag and cable.", price: 580, condition: "Good", category: "Music", images: JSON.stringify(["https://picsum.photos/seed/fender/600/400"]), sellerName: "Jake Wilson", location: "Toronto, ON", listedAt: new Date("2026-01-20T13:30:00.000Z") },
      { id: "g_7002", title: "Yamaha P-125 Digital Piano", description: "88-key weighted action. Includes stand, bench, and pedal.", price: 520, condition: "Like New", category: "Music", images: JSON.stringify(["https://picsum.photos/seed/piano/600/400"]), sellerName: "Sophia Martinez", location: "Waterloo, ON", listedAt: new Date("2026-01-19T10:15:00.000Z") },
      { id: "g_7003", title: "Roland TD-17KV Electronic Drums", description: "Mesh heads, Bluetooth, coaching features. Great for apartment practice.", price: 1200, condition: "Good", category: "Music", images: JSON.stringify(["https://picsum.photos/seed/drums/600/400"]), sellerName: "Mike Johnson", location: "Kitchener, ON", listedAt: new Date("2026-01-18T15:45:00.000Z") },
      { id: "g_7004", title: "Audio-Technica AT2020 Mic Bundle", description: "Condenser mic with boom arm, shock mount, pop filter, and XLR cable.", price: 140, condition: "Like New", category: "Music", images: JSON.stringify(["https://picsum.photos/seed/microphone/600/400"]), sellerName: "Ashley Brown", location: "Waterloo, ON", listedAt: new Date("2026-01-17T12:30:00.000Z") },
    ];

    await prisma.goods.createMany({ data: dummyGoods });
  }

  // Backfill sellerId for legacy listings so chat can resolve a seller user.
  // We use a stable fallback account in demo data.
  await prisma.goods.updateMany({
    where: { sellerId: null },
    data: { sellerId: "u_admin" }
  });
};

const requireRole = (allowedRoles = []) => (req, res, next) => {
  const role = req.header("x-user-role");
  if (!role || !allowedRoles.includes(role)) {
    return res.status(403).json({ message: "Access denied." });
  }
  return next();
};

const normalizeOptionalString = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
};

const normalizeOptionalPrice = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeImageList = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeOptionalString(entry))
    .filter(Boolean);
};

const parseImageList = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
};

const toDraftResponse = (draft) => ({
  ...draft,
  images: parseImageList(draft.images)
});

// Build a set of favorited goods IDs for a user to optimize response shaping
const buildFavoriteSet = async (userId) => {
  if (!userId) return new Set();

  const favorites = await prisma.favorite.findMany({
    where: { userId },
    select: { goodsId: true }
  });

  return new Set(favorites.map((item) => item.goodsId));
};

const toGoodsResponse = (item, favoriteSet = new Set()) => ({
  ...item,
  images: parseImageList(item.images),
  isFavorited: favoriteSet.has(item.id)
});

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value) => {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "for", "with", "to", "of", "in", "on",
    "at", "by", "new", "good", "like"
  ]);

  return normalizeText(value)
    .split(" ")
    .filter((word) => word && word.length > 1 && !stopWords.has(word));
};

// Compute a personalized recommendation score for a candidate item based on user's favorite items
// Score is based on category matches, token overlaps in title/description/category, price proximity, shopping cart and recency of listing
const computePersonalRecommendationScore = (candidate, favoriteItems, cartItems = []) => {
  let score = 0;

  const favoriteCategoryWeights = new Map();
  const favoriteTokenWeights = new Map();

  const cartCategoryWeights = new Map();
  const cartTokenWeights = new Map();

  for (const item of favoriteItems) {
    favoriteCategoryWeights.set(
      item.category,
      (favoriteCategoryWeights.get(item.category) || 0) + 1
    );

    const words = [
      ...tokenize(item.title),
      ...tokenize(item.description),
      ...tokenize(item.category)
    ];

    for (const word of words) {
      favoriteTokenWeights.set(word, (favoriteTokenWeights.get(word) || 0) + 1);
    }
  }

  for (const item of cartItems) {
    cartCategoryWeights.set(
      item.category,
      (cartCategoryWeights.get(item.category) || 0) + 1
    );

    const words = [
      ...tokenize(item.title),
      ...tokenize(item.description),
      ...tokenize(item.category)
    ];

    for (const word of words) {
      cartTokenWeights.set(word, (cartTokenWeights.get(word) || 0) + 1);
    }
  }

  score += (favoriteCategoryWeights.get(candidate.category) || 0) * 20;

  score += (cartCategoryWeights.get(candidate.category) || 0) * 30;

  const candidateWords = new Set([
    ...tokenize(candidate.title),
    ...tokenize(candidate.description),
    ...tokenize(candidate.category)
  ]);

  for (const word of candidateWords) {
    if (favoriteTokenWeights.has(word)) {
      score += favoriteTokenWeights.get(word) * 5;
    }
    if (cartTokenWeights.has(word)) {
      score += cartTokenWeights.get(word) * 8;
    }
  }

  for (const item of cartItems) {
    const diff = Math.abs(Number(candidate.price) - Number(item.price));
    const maxPrice = Math.max(Number(candidate.price), Number(item.price), 1);
    const similarity = 1 - diff / maxPrice;
    score += Math.max(0, similarity) * 12;
  }

  const ageMs = Date.now() - new Date(candidate.listedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 3) score += 8;
  else if (ageDays <= 7) score += 5;
  else if (ageDays <= 14) score += 2;

  return score;
};

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/drafts", requireRole(["admin", "user"]), async (req, res) => {
  const userId = req.header("x-user-id");
  if (!userId) {
    return res.status(400).json({ message: "Missing user id." });
  }

  const drafts = await prisma.draft.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" }
  });

  return res.json({
    items: drafts.map((draft) => toDraftResponse(draft))
  });
});

app.post("/api/drafts", requireRole(["admin", "user"]), async (req, res) => {
  const userId = req.header("x-user-id");
  if (!userId) {
    return res.status(400).json({ message: "Missing user id." });
  }

  const {
    id,
    title,
    description,
    price,
    condition,
    category,
    images,
    location
  } = req.body || {};

  const normalized = {
    title: normalizeOptionalString(title),
    description: normalizeOptionalString(description),
    price: normalizeOptionalPrice(price),
    condition: normalizeOptionalString(condition),
    category: normalizeOptionalString(category),
    location: normalizeOptionalString(location),
    images: normalizeImageList(images)
  };

  const hasDraftContent = Boolean(
    normalized.title ||
      normalized.description ||
      normalized.condition ||
      normalized.category ||
      normalized.location ||
      normalized.price !== null ||
      normalized.images.length
  );

  if (!hasDraftContent) {
    return res.status(400).json({ message: "Draft is empty. Add some content first." });
  }

  const payload = {
    title: normalized.title,
    description: normalized.description,
    price: normalized.price,
    condition: normalized.condition,
    category: normalized.category,
    location: normalized.location,
    images: JSON.stringify(normalized.images)
  };

  if (id) {
    const existingDraft = await prisma.draft.findFirst({
      where: { id: String(id), userId }
    });

    if (!existingDraft) {
      return res.status(404).json({ message: "Draft not found." });
    }

    const updatedDraft = await prisma.draft.update({
      where: { id: existingDraft.id },
      data: payload
    });

    return res.status(200).json({ draft: toDraftResponse(updatedDraft) });
  }

  const newDraft = await prisma.draft.create({
    data: {
      id: `d_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      userId,
      ...payload
    }
  });

  return res.status(201).json({ draft: toDraftResponse(newDraft) });
});

app.delete("/api/drafts/:id", requireRole(["admin", "user"]), async (req, res) => {
  const userId = req.header("x-user-id");
  if (!userId) {
    return res.status(400).json({ message: "Missing user id." });
  }

  const { id } = req.params;
  const existingDraft = await prisma.draft.findFirst({
    where: { id, userId }
  });

  if (!existingDraft) {
    return res.status(404).json({ message: "Draft not found." });
  }

  await prisma.draft.delete({ where: { id: existingDraft.id } });
  return res.status(204).send();
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required." });
  }

  const user = await prisma.user.findFirst({
    where: { email, password },
    select: { id: true, name: true, email: true, role: true, emailVerified: true }
  });

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  if (!user.emailVerified) {
    return res.status(403).json({
      message: "Please verify your email before logging in.",
      code: "EMAIL_NOT_VERIFIED"
    });
  }

  const token = jwt.sign(
    { sub: user.id, id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  return res.json({ user, token });
});


app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required." });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters." });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ message: "Email already registered." });
  }

  const token = makeToken();
  console.log("[REGISTER]", email, "token=", token);
  const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

  const newUser = {
    id: `u_${Date.now()}`,
    name,
    email,
    password,
    role: "user",
    createdAt: new Date(),
    emailVerified: false,
    verificationToken: token,
    verificationExpires: expires
  };

  await prisma.user.create({ data: newUser });

  const verifyUrl = `${getClientUrl()}/verify-email?token=${token}`;

  if (!isEmailConfigured()) {
    return res.status(201).json({
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, emailVerified: false },
      message: "Account created. Email service not configured, so verification email was not sent."
    });
  }

  try {
    await sendVerificationEmail({ to: email, name, verifyUrl });
  } catch (e) {
    return res.status(500).json({
      message: "Account created, but failed to send verification email. Please try resend."
    });
  }

  return res.status(201).json({
    user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, emailVerified: false },
    message: "Account created. Please check your email to verify your account."
  });
});

app.get("/api/auth/verify", async (req, res) => {
  const { token } = req.query;
  console.log("[REGISTER]", "token=", token);
  if (!token) return res.status(400).json({ message: "Missing token." });

  const user = await prisma.user.findFirst({
    where: { verificationToken: String(token) }
  });

  if (!user) return res.status(400).json({ message: "Invalid token." });
  if (user.emailVerified) {
    return res.json({ message: "Email already verified." });
  }
  // console.log("[VERIFY] token=", token);
  // console.log("[VERIFY] now=", new Date().toISOString());
  // console.log("[VERIFY] dbExpires=", user?.verificationExpires?.toISOString(), "verified=", user?.emailVerified);

  if (!user.verificationExpires || user.verificationExpires < new Date()) {
    return res.status(400).json({ message: "Token expired." });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      // verificationToken: null,
      verificationExpires: null
    }
  });

  return res.json({ message: "Email verified successfully." });
});

app.post("/api/auth/resend-verification", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ message: "Email is required." });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ message: "User not found." });
  if (user.emailVerified) return res.status(400).json({ message: "Email already verified." });

  const token = makeToken();
  console.log("[REGISTER]", email, "token=", token);
  const expires = new Date(Date.now() + 1000 * 60 * 60);

  await prisma.user.update({
    where: { id: user.id },
    data: { verificationToken: token, verificationExpires: expires }
  });

  const verifyUrl = `${getClientUrl()}/verify-email?token=${token}`;

  if (!isEmailConfigured()) {
    return res.json({ message: "Email service not configured, cannot send verification email." });
  }

  await sendVerificationEmail({ to: email, name: user.name, verifyUrl });
  return res.json({ message: "Verification email resent." });
});


// Get all goods with optional search and category filter
// app.get("/api/goods", async (req, res) => {
//   const { search, category, limit } = req.query;
  
//   let where = {};
//   if (search) {
//     where.OR = [
//       { title: { contains: search } },
//       { description: { contains: search } },
//       { category: { contains: search } }
//     ];
//   }
//   if (category && category !== "All") {
//     where.category = category;
//   }

//   const goods = await prisma.goods.findMany({
//     where,
//     orderBy: { listedAt: "desc" },
//     take: limit ? parseInt(limit) : undefined
//   });
  
//   const items = goods.map((item) => ({
//     ...item,
//     images: item.images ? JSON.parse(item.images) : []
//   }));
//   res.json({ items });
// });
app.get("/api/goods", async (req, res) => {
  const { search, category, limit } = req.query;
  const userId = req.header("x-user-id");

  let where = {};
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
      { category: { contains: search } }
    ];
  }
  if (category && category !== "All") {
    where.category = category;
  }

  const [goods, favoriteSet] = await Promise.all([
    prisma.goods.findMany({
      where,
      orderBy: { listedAt: "desc" },
      take: limit ? parseInt(limit) : undefined
    }),
    buildFavoriteSet(userId)
  ]);

  const items = goods.map((item) => toGoodsResponse(item, favoriteSet));
  res.json({ items });
});

// Get single product by ID
// app.get("/api/goods/:id", async (req, res) => {
//   const { id } = req.params;
//   const item = await prisma.goods.findUnique({ where: { id } });
  
//   if (!item) {
//     return res.status(404).json({ message: "Product not found" });
//   }
  
//   res.json({
//     item: {
//       ...item,
//       images: item.images ? JSON.parse(item.images) : []
//     }
//   });
// });
app.get("/api/goods/:id", async (req, res) => {
  const { id } = req.params;
  const userId = req.header("x-user-id");

  const [item, favoriteSet] = await Promise.all([
    prisma.goods.findUnique({ where: { id } }),
    buildFavoriteSet(userId)
  ]);

  if (!item) {
    return res.status(404).json({ message: "Product not found" });
  }

  res.json({
    item: toGoodsResponse(item, favoriteSet)
  });
});

// Get recommendations based on category and exclude current item
// app.get("/api/goods/:id/recommendations", async (req, res) => {
//   const { id } = req.params;
//   const { limit = 8 } = req.query;
  
//   const currentItem = await prisma.goods.findUnique({ where: { id } });
//   if (!currentItem) {
//     return res.status(404).json({ message: "Product not found" });
//   }

//   // Get items from same category, excluding current item
//   const similarItems = await prisma.goods.findMany({
//     where: {
//       category: currentItem.category,
//       id: { not: id }
//     },
//     orderBy: { listedAt: "desc" },
//     take: parseInt(limit)
//   });

//   // If not enough similar items, get popular items from other categories
//   let recommendations = similarItems;
//   if (recommendations.length < parseInt(limit)) {
//     const otherItems = await prisma.goods.findMany({
//       where: {
//         id: { notIn: [id, ...recommendations.map(i => i.id)] }
//       },
//       orderBy: { listedAt: "desc" },
//       take: parseInt(limit) - recommendations.length
//     });
//     recommendations = [...recommendations, ...otherItems];
//   }

//   const items = recommendations.map((item) => ({
//     ...item,
//     images: item.images ? JSON.parse(item.images) : []
//   }));
  
//   res.json({ items });
// });
app.get("/api/goods/:id/recommendations", async (req, res) => {
  const { id } = req.params;
  const { limit = 8 } = req.query;
  const userId = req.header("x-user-id");

  const currentItem = await prisma.goods.findUnique({ where: { id } });
  if (!currentItem) {
    return res.status(404).json({ message: "Product not found" });
  }

  const similarItems = await prisma.goods.findMany({
    where: {
      category: currentItem.category,
      id: { not: id }
    },
    orderBy: { listedAt: "desc" },
    take: parseInt(limit)
  });

  let recommendations = similarItems;
  if (recommendations.length < parseInt(limit)) {
    const otherItems = await prisma.goods.findMany({
      where: {
        id: { notIn: [id, ...recommendations.map((i) => i.id)] }
      },
      orderBy: { listedAt: "desc" },
      take: parseInt(limit) - recommendations.length
    });
    recommendations = [...recommendations, ...otherItems];
  }

  const favoriteSet = await buildFavoriteSet(userId);
  const items = recommendations.map((item) => toGoodsResponse(item, favoriteSet));

  res.json({ items });
});

// Get user's favorite items
app.get("/api/favorites", requireRole(["admin", "user"]), async (req, res) => {
  const userId = req.header("x-user-id");
  if (!userId) {
    return res.status(400).json({ message: "Missing user id." });
  }

  const favorites = await prisma.favorite.findMany({
    where: { userId },
    include: { goods: true },
    orderBy: { createdAt: "desc" }
  });

  const items = favorites.map((favorite) =>
    toGoodsResponse(favorite.goods, new Set([favorite.goodsId]))
  );

  return res.json({ items });
});

// Add favorite
app.post("/api/favorites", requireRole(["admin", "user"]), async (req, res) => {
  const userId = req.header("x-user-id");
  const { goodsId } = req.body || {};

  if (!userId) {
    return res.status(400).json({ message: "Missing user id." });
  }
  if (!goodsId) {
    return res.status(400).json({ message: "goodsId is required." });
  }

  const goods = await prisma.goods.findUnique({ where: { id: goodsId } });
  if (!goods) {
    return res.status(404).json({ message: "Product not found." });
  }

  await prisma.favorite.upsert({
    where: {
      userId_goodsId: { userId, goodsId }
    },
    update: {},
    create: {
      userId,
      goodsId
    }
  });

  return res.status(201).json({ success: true });
});

// Remove favorite
app.delete("/api/favorites/:goodsId", requireRole(["admin", "user"]), async (req, res) => {
  const userId = req.header("x-user-id");
  const { goodsId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: "Missing user id." });
  }

  const existing = await prisma.favorite.findUnique({
    where: {
      userId_goodsId: { userId, goodsId }
    }
  });

  if (!existing) {
    return res.status(404).json({ message: "Favorite not found." });
  }

  await prisma.favorite.delete({
    where: {
      userId_goodsId: { userId, goodsId }
    }
  });

  return res.json({ success: true });
});

// Get personalized recommendations based on user's favorites
app.get("/api/recommendations/personal", requireRole(["admin", "user"]), async (req, res) => {
  const userId = req.header("x-user-id");
  const { limit = 8, cartIds = "" } = req.query;

  if (!userId) {
    return res.status(400).json({ message: "Missing user id." });
  }

  const cartItemIds = String(cartIds)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const [favorites, cartItems] = await Promise.all([
    prisma.favorite.findMany({
      where: { userId },
      include: { goods: true },
      orderBy: { createdAt: "desc" }
    }),
    cartItemIds.length > 0
      ? prisma.goods.findMany({
          where: {
            id: { in: cartItemIds }
          }
        })
      : Promise.resolve([])
  ]);

  const favoriteItems = favorites.map((f) => f.goods);
  const excludedIds = new Set([
    ...favoriteItems.map((item) => item.id),
    ...cartItems.map((item) => item.id)
  ]);

  if (favoriteItems.length === 0 && cartItems.length === 0) {
    const fallback = await prisma.goods.findMany({
      orderBy: { listedAt: "desc" },
      take: parseInt(limit)
    });

    const favoriteSet = await buildFavoriteSet(userId);
    return res.json({
      items: fallback.map((item) => toGoodsResponse(item, favoriteSet))
    });
  }

  const candidates = await prisma.goods.findMany({
    where: {
      id: { notIn: Array.from(excludedIds) }
    }
  });

  const ranked = candidates
    .map((item) => ({
      ...item,
      __score: computePersonalRecommendationScore(item, favoriteItems, cartItems)
    }))
    .sort((a, b) => b.__score - a.__score)
    .slice(0, parseInt(limit));

  const favoriteSet = await buildFavoriteSet(userId);

  return res.json({
    items: ranked.map(({ __score, ...item }) => toGoodsResponse(item, favoriteSet))
  });
});

// Get all categories
app.get("/api/categories", async (_req, res) => {
  const goods = await prisma.goods.findMany({
    select: { category: true }
  });
  const categories = [...new Set(goods.map(g => g.category))].sort();
  res.json({ categories });
});

// Upload listing image
app.post("/api/goods/upload-image", requireRole(["admin", "user"]), (req, res) => {
  goodsImageUpload.single("image")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "Image must be 5MB or smaller." });
      }
      return res.status(400).json({ message: err.message || "Image upload failed." });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Image file is required." });
    }

    return res.status(201).json({
      url: `/api/uploads/goods/${req.file.filename}`
    });
  });
});

// Create new listing
app.post("/api/goods", requireRole(["admin", "user"]), async (req, res) => {
  const { title, description, price, condition, category, images, location } = req.body || {};

  if (!title || !price || !condition || !category) {
    return res.status(400).json({ message: "Missing required fields." });
  }
  
  const sellerName = req.header("x-user-name") || "Community Seller";
  const sellerId = req.header("x-user-id") || null;
  const newItem = {
    id: `g_${Date.now()}`,
    title,
    description: description || "",
    price: Number(price),
    condition,
    category,
    images: JSON.stringify(Array.isArray(images) && images.length > 0 ? images : []),
    sellerId,
    sellerName,
    location: location || "Waterloo, ON",
    listedAt: new Date()
  };
  
  await prisma.goods.create({ data: newItem });
  return res.status(201).json({
    item: { ...newItem, images: JSON.parse(newItem.images) }
  });
});

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

app.post("/api/transactions/checkout", requireRole(["admin", "user"]), async (req, res) => {
  const { userId, items, payment } = req.body || {};
  if (!userId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Invalid checkout payload." });
  }

  const goods = await prisma.goods.findMany();
  const enrichedItems = items
    .map((item) => {
      const found = goods.find((g) => g.id === item.id);
      if (!found) return null;
      return {
        id: found.id,
        title: found.title,
        price: found.price,
        quantity: Number(item.quantity || 1)
      };
    })
    .filter(Boolean);

  const total = enrichedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cardNumber = payment?.cardNumber || "";
  const last4 = cardNumber ? cardNumber.slice(-4) : "0000";

  const newTransaction = {
    id: `t_${Date.now()}`,
    userId,
    total,
    status: "pending",
    createdAt: new Date(),
    last4
  };

  await prisma.transaction.create({
    data: {
      ...newTransaction,
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

  return res.status(201).json({
    transaction: {
      ...newTransaction,
      items: enrichedItems,
      payment: { method: "card", last4 }
    }
  });
});

// Catch-all route: serve React app for any non-API routes (client-side routing)
// Mount chat routes and real-time socket service.
const chatService = mountChatService(app, httpServer);

if (process.env.NODE_ENV === "production") {
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

const start = async () => {
  try {
    await prisma.$connect();
    await initRedis();
    await chatService?.tryAttachRedisAdapter?.();
    await seedIfEmpty();
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error?.message || error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== "test") {
  start();
}

const shutdown = async () => {
  try {
    await closeRedis();
    await prisma.$disconnect();
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
export { app, prisma, start };
