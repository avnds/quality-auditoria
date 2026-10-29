import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import db from "@/lib/db";
import { createLogicalDatabaseBackup } from "@/lib/db/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    // A primeira etapa fica restrita ao ambiente local de desenvolvimento.
    // Isso impede que a rota use acidentalmente as credenciais da Vercel.
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
            {
                success: false,
                message:
                    "A exportação de backup está bloqueada neste ambiente.",
            },
            { status: 403 }
        );
    }

    const usuario = await getCurrentUser();

    if (!usuario) {
        return NextResponse.json(
            { success: false, message: "Usuário não autenticado." },
            { status: 401 }
        );
    }

    if (usuario.perfil !== "MASTER") {
        return NextResponse.json(
            {
                success: false,
                message: "Somente o perfil MASTER pode exportar o backup.",
            },
            { status: 403 }
        );
    }

    try {
        const backup = await createLogicalDatabaseBackup(db);
        const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, "-");

        return new Response(JSON.stringify(backup), {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Disposition": `attachment; filename="quality-auditoria-backup-${timestamp}.json"`,
                "Cache-Control": "private, no-store, max-age=0",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (error) {
        console.error("Erro ao gerar backup lógico:", error);

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível gerar o backup. Nenhum arquivo foi disponibilizado.",
            },
            { status: 500 }
        );
    }
}
