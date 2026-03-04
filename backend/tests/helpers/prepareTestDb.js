import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..", "..");

function resolveSqliteDbPath(databaseUrl) {
  const url = databaseUrl || "file:./test.db";
  if (!url.startsWith("file:")) {
    throw new Error(`Only sqlite file URLs are supported in tests, got: ${url}`);
  }

  const sqlitePath = url.slice("file:".length);
  if (!sqlitePath) {
    throw new Error("DATABASE_URL must include a sqlite database path.");
  }

  if (path.isAbsolute(sqlitePath)) {
    return sqlitePath;
  }

  // Prisma resolves sqlite relative paths from the schema directory.
  return path.resolve(backendRoot, "prisma", sqlitePath);
}

export function prepareTestDb() {
  const dbPath = resolveSqliteDbPath(process.env.DATABASE_URL);
  const schemaPath = path.resolve(__dirname, "test-schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  execFileSync("sqlite3", [dbPath], {
    input: schemaSql,
    stdio: ["pipe", "inherit", "inherit"]
  });
}
