import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { identificarAmbienteBanco } from "@/lib/db/identificar-ambiente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pré-verificação somente leitura para a importação direta.
 * Não entrega backup, URLs privadas, tokens ou arquivos.
 * Não inicia transferências nem modifica o banco.
 */
export async function GET() {
    try {
        const ambiente = identificarAmbienteBanco();
        if (ambiente !== "production") {
            return NextResponse.json(
                { success: false, message: "Importação direta disponível apenas no Quality Cloud de produção." },
                { status: 403, headers: { "Cache-Control": "no-store" } }
            );
        }

        const usuario = await getCurrentUser();
        if (!usuario) {
            return NextResponse.json(
                { success: false, message: "Autenticação necessária." },
                { status: 401, headers: { "Cache-Control": "no-store" } }
            );
        }

        if (usuario.perfil !== "MASTER" && usuario.perfil !== "SUPERVISORA") {
            return NextResponse.json(
                { success: false, message: "Perfil não autorizado para exportação offline." },
                { status: 403, headers: { "Cache-Control": "no-store" } }
            );
        }

        return NextResponse.json(
            { success: true, origem: "production", modalidade: "producao_direta", transferenciaHabilitada: false },
            { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }
        );
    } catch (error) {
        console.error("Falha na pré-verificação de exportação offline:", error);
        return NextResponse.json(
            { success: false, message: "Não foi possível verificar a disponibilidade da importação direta." },
            { status: 503, headers: { "Cache-Control": "no-store" } }
        );
    }
}
