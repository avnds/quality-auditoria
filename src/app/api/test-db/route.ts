import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const result = await db.execute(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    return NextResponse.json({
      success: true,
      message: "Conexão com o Turso funcionando!",
      tabelas: result.rows,
    });
  } catch (error) {
    console.error("Erro ao consultar o Turso:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erro ao consultar o banco.",
      },
      { status: 500 }
    );
  }
}