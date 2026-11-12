import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import db from "@/lib/db";
import { identificarAmbienteBanco } from "@/lib/db/identificar-ambiente";
import { recuperarSnapshotBancoExportacao } from "@/lib/desktop/repositorio-snapshots-banco-exportacao";
import { recuperarManifestoExportacao } from "@/lib/desktop/repositorio-manifestos-exportacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
};

type Contexto = { params: Promise<{ sessaoId: string }> };

/**
 * Endpoint desativado por padrão. Retorna somente snapshot da própria sessão,
 * com autorização atual; não entrega tokens ou arquivos privados.
 */
export async function GET(_request: NextRequest, contexto: Contexto) {
    if (process.env.QUALITY_DESKTOP_EXPORT_SESSION_ENABLED !== "true") {
        return NextResponse.json(
            { success: false, message: "Recuperação de sessões Desktop ainda não habilitada." },
            { status: 503, headers }
        );
    }
    try {
        if (identificarAmbienteBanco() !== "production") {
            return NextResponse.json(
                { success: false, message: "Operação permitida somente na produção online." },
                { status: 403, headers }
            );
        }
        const usuario = await getCurrentUser();
        if (!usuario) {
            return NextResponse.json(
                { success: false, message: "Autenticação necessária." },
                { status: 401, headers }
            );
        }
        if (usuario.perfil !== "MASTER" && usuario.perfil !== "SUPERVISORA") {
            return NextResponse.json(
                { success: false, message: "Perfil não autorizado." },
                { status: 403, headers }
            );
        }
        const { sessaoId } = await contexto.params;
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(sessaoId)) {
            return NextResponse.json(
                { success: false, message: "Identificador de sessão inválido." },
                { status: 400, headers }
            );
        }
        const agora = new Date();
        const manifesto = await recuperarManifestoExportacao(db, sessaoId, usuario.id, agora);
        if (!manifesto) {
            return NextResponse.json(
                { success: false, message: "Sessão indisponível." },
                { status: 404, headers }
            );
        }
        const backup = await recuperarSnapshotBancoExportacao(db, sessaoId, usuario.id, agora);
        if (!backup) {
            return NextResponse.json(
                { success: false, message: "Sessão indisponível." },
                { status: 404, headers }
            );
        }
        return NextResponse.json(
            {
                success: true,
                sessaoId,
                backup,
                manifesto: manifesto.manifesto,
                arquivosPrivadosIncluidos: false,
                instalacaoOfflinePronta: false,
            },
            { headers }
        );
    } catch (error) {
        console.error("Falha ao recuperar snapshot da sessão Desktop:", error);
        return NextResponse.json(
            { success: false, message: "Não foi possível recuperar o snapshot." },
            { status: 500, headers }
        );
    }
}
