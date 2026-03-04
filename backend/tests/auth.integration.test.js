import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../server.js";
import { prepareTestDb } from "./helpers/prepareTestDb.js";

const prisma = new PrismaClient();

async function resetDb() {
  await prisma.transactionItem.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.goods.deleteMany();
  await prisma.user.deleteMany();
}

describe("Auth integration", () => {
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

  test("register -> login blocked -> verify -> login success", async () => {
    const email = "test1@example.com";
    const password = "password123";
    const name = "Test User";

    // register
    const reg = await request(app)
      .post("/api/auth/register")
      .send({ name, email, password })
      .expect(201);

    // login should be blocked (not verified)
    const loginBlocked = await request(app)
      .post("/api/auth/login")
      .send({ email, password })
      .expect(403);

    expect(loginBlocked.body.code).toBe("EMAIL_NOT_VERIFIED");

    // fetch token from DB (since email is not actually sent in tests)
    const u = await prisma.user.findUnique({ where: { email } });
    expect(u).toBeTruthy();
    expect(u.emailVerified).toBe(false);
    expect(u.verificationToken).toBeTruthy();

    // verify
    await request(app)
      .get("/api/auth/verify")
      .query({ token: u.verificationToken })
      .expect(200);

    const u2 = await prisma.user.findUnique({ where: { email } });
    expect(u2.emailVerified).toBe(true);

    // login success
    const loginOk = await request(app)
      .post("/api/auth/login")
      .send({ email, password })
      .expect(200);

    expect(loginOk.body.user.email).toBe(email);
  });

  test("resend-verification updates token", async () => {
    const email = "test2@example.com";
    const password = "password123";
    const name = "Test User";

    await request(app)
      .post("/api/auth/register")
      .send({ name, email, password })
      .expect(201);

    const u1 = await prisma.user.findUnique({ where: { email } });
    const oldToken = u1.verificationToken;

    await request(app)
      .post("/api/auth/resend-verification")
      .send({ email })
      .expect(200);

    const u2 = await prisma.user.findUnique({ where: { email } });
    expect(u2.verificationToken).toBeTruthy();
    expect(u2.verificationToken).not.toBe(oldToken);
  });
});
