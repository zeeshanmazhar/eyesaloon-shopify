import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dbPath = join(root, "prisma", "dev.sqlite");
const migrationPath = join(
  root,
  "prisma",
  "migrations",
  "20240530213853_create_session_table",
  "migration.sql",
);

const migrationSql = readFileSync(migrationPath, "utf8").replace(
  'CREATE TABLE "Session"',
  'CREATE TABLE IF NOT EXISTS "Session"',
);

execFileSync("sqlite3", [dbPath], {
  input: migrationSql,
  stdio: ["pipe", "inherit", "inherit"],
});

