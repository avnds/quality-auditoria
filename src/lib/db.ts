import { createClient } from "@libsql/client";
import { identificarAmbienteBanco } from "@/lib/db/identificar-ambiente";

const ambiente = identificarAmbienteBanco();

const db = ambiente === "production_offline"
  ? createClient({
      // Em modo Desktop, o arquivo SQLite é obrigatório. Nunca usar
      // credenciais Turso como fallback.
      url: process.env.TURSO_DATABASE_URL!,
    })
  : createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });

export default db;
