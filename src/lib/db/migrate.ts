import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({
  path: path.join(process.cwd(), ".env.local"),
});

async function migrate() {
  const { default: db } = await import("../db");

  // Tabela que registra as migrations já executadas
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      aplicada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrationsDir = path.join(
    process.cwd(),
    "src",
    "lib",
    "db",
    "migrations"
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const migrationId = file.replace(".sql", "");

    const result = await db.execute({
      sql: "SELECT id FROM schema_migrations WHERE id = ?",
      args: [migrationId],
    });

    if (result.rows.length > 0) {
      console.log(`Já aplicada: ${file}`);
      continue;
    }

    console.log(`Aplicando: ${file}`);

    const migrationPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(migrationPath, "utf-8");

    const statements = sql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      console.log("Executando:", statement.substring(0, 80));
      await db.execute(statement);
    }

    await db.execute({
      sql: "INSERT INTO schema_migrations (id) VALUES (?)",
      args: [migrationId],
    });

    console.log(`Migration ${file} executada com sucesso.`);
  }

  console.log("Todas as migrations foram verificadas.");
}

migrate().catch((error) => {
  console.error("Erro ao executar migrations:", error);
  process.exit(1);
});