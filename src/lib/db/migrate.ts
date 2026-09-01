import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({
  path: path.join(process.cwd(), ".env.local"),
});

async function migrate() {
  const { default: db } = await import("../db");

  const migrationPath = path.join(
    process.cwd(),
    "src",
    "lib",
    "db",
    "migrations",
    "001_initial_schema.sql"
  );

  const sql = fs.readFileSync(migrationPath, "utf-8");

  const statements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    console.log("Executando:", statement.substring(0, 80));
    await db.execute(statement);
  }

  console.log("Migration 001 executada com sucesso.");
}

migrate().catch((error) => {
  console.error("Erro ao executar migration:", error);
  process.exit(1);
});