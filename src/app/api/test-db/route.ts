import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const result = await db.execute("SELECT 1 AS conectado");

    return NextResponse.json({
      success: true,
      message: "Conexão com o Turso funcionando!",
      result: result.rows,
    });
  } catch (error) {
    console.error("Erro ao conectar ao Turso:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Erro ao conectar ao banco.",
      },
      { status: 500 }
    );
  }
}