import { createHmac, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import db from "@/lib/db";
import { createLogicalDatabaseBackup } from "@/lib/db/backup";
import { identificarAmbienteBanco } from "@/lib/db/identificar-ambiente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Esta autorização apenas comprova que o servidor gerou o backup.
// Não comprova que o navegador concluiu o download.
export async function GET(request: Request) {
    const usuario = await getCurrentUser();
    if (!usuario) {
        return NextResponse.json({ success: false, message: "Usuário não autenticado." }, { status: 401 });
    }
    if (usuario.perfil !== "MASTER") {
        return NextResponse.json({ success: false, message: "Somente MASTER pode preparar a restauração." }, { status: 403 });
    }

    try {
        const ambiente = identificarAmbienteBanco();
        const backup = await createLogicalDatabaseBackup(db);
        const secret = process.env.TURSO_AUTH_TOKEN;
        if (!secret) throw new Error("Não há chave para assinar a autorização de restauração.");

        const issuedAt = Date.now();
        const payload = [usuario.id, ambiente, issuedAt, randomUUID()].join(":");
        const signature = createHmac("sha256", secret).update(payload).digest("hex");
        const token = Buffer.from(payload + ":" + signature).toString("base64url");
        const timestamp = new Date(issuedAt).toISOString().replace(/[:.]/g, "-");

        const response = new NextResponse(JSON.stringify(backup), {
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Disposition": `attachment; filename="quality-recuperacao-${ambiente}-${timestamp}.json"`,
                "Cache-Control": "private, no-store, max-age=0",
                "X-Content-Type-Options": "nosniff",
            },
        });
        response.cookies.set("quality_restore_prepared", token, {
            httpOnly: true,
            sameSite: "strict",
            secure: new URL(request.url).protocol === "https:",
            path: "/api/backup-restauracao/restaurar",
            maxAge: 600,
        });
        return response;
    } catch (error) {
        console.error("Falha ao preparar backup de recuperação:", error);
        return NextResponse.json({
            success: false,
            message: "Não foi possível gerar o backup de recuperação. Restauração não autorizada.",
        }, { status: 500 });
    }
}
