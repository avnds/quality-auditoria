import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import db from "@/lib/db";
import { createLogicalDatabaseBackup } from "@/lib/db/backup";
import { identificarAmbienteBanco } from "@/lib/db/identificar-ambiente";
import { prepararManifestoImportacaoDesktop } from "@/lib/desktop/manifesto-importacao";
import { NOME_TABELA_SESSOES_EXPORTACAO } from "@/lib/desktop/schema-sessoes-exportacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
};

export async function GET() {
    try {
        if (identificarAmbienteBanco() !== "production") {
            return NextResponse.json(
                { success: false, message: "Exportação direta disponível apenas na produção online." },
                { status: 403, headers: noStore }
            );
        }

        const usuario = await getCurrentUser();
        if (!usuario) {
            return NextResponse.json(
                { success: false, message: "Autenticação necessária." },
                { status: 401, headers: noStore }
            );
        }

        if (usuario.perfil !== "MASTER" && usuario.perfil !== "SUPERVISORA") {
            return NextResponse.json(
                { success: false, message: "Perfil não autorizado para exportação offline." },
                { status: 403, headers: noStore }
            );
        }

        // O backup é obtido em uma transação de leitura pela função existente.
        // Não aceita URLs, caminhos, consultas SQL ou identificadores fornecidos pelo cliente.
        const backup = await createLogicalDatabaseBackup(db, {
            excluirTabelas: [NOME_TABELA_SESSOES_EXPORTACAO],
        });
        const manifesto = prepararManifestoImportacaoDesktop(backup, "producao_direta");

        return NextResponse.json(
            {
                success: true,
                backup,
                manifesto,
                arquivosPrivadosIncluidos: false,
                instalacaoOfflinePronta: false,
            },
            { headers: noStore }
        );
    } catch (error) {
        console.error("Falha ao preparar exportação direta do Desktop:", error);
        return NextResponse.json(
            { success: false, message: "Não foi possível preparar a exportação direta." },
            { status: 500, headers: noStore }
        );
    }
}
