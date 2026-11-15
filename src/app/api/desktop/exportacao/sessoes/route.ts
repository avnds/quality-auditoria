import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import db from "@/lib/db";
import { createLogicalDatabaseBackup } from "@/lib/db/backup";
import { identificarAmbienteBanco } from "@/lib/db/identificar-ambiente";
import { prepararManifestoImportacaoDesktop } from "@/lib/desktop/manifesto-importacao";
import { criarDescritorSessaoExportacao } from "@/lib/desktop/sessao-exportacao";
import { vincularSessaoExportacao } from "@/lib/desktop/autorizacao-sessao-exportacao";
import { registrarExportacaoCompleta } from "@/lib/desktop/registrar-exportacao-completa";
import { NOME_TABELA_SESSOES_EXPORTACAO } from "@/lib/desktop/schema-sessoes-exportacao";
import { NOME_TABELA_MANIFESTOS_EXPORTACAO } from "@/lib/desktop/repositorio-manifestos-exportacao";
import { NOME_TABELA_SNAPSHOTS_BANCO_EXPORTACAO } from "@/lib/desktop/repositorio-snapshots-banco-exportacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
};

/**
 * Bloqueado por padrão, inclusive na produção.
 * Somente habilitar após migração aprovada, testes e política de retenção.
 * Não transfere Blob, não ativa Desktop e não oferece sessão utilizável
 * para baixar arquivos: apenas registra o snapshot lógico.
 */
export async function POST() {
    if (process.env.QUALITY_DESKTOP_EXPORT_SESSION_ENABLED !== "true") {
        return NextResponse.json(
            { success: false, message: "Criação de sessões Desktop ainda não habilitada." },
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
        const backup = await createLogicalDatabaseBackup(db, {
            excluirTabelas: [
                NOME_TABELA_SESSOES_EXPORTACAO,
                NOME_TABELA_MANIFESTOS_EXPORTACAO,
                NOME_TABELA_SNAPSHOTS_BANCO_EXPORTACAO,
            ],
        });
        const manifesto = prepararManifestoImportacaoDesktop(backup, "producao_direta");
        const agora = new Date();
        const descritor = criarDescritorSessaoExportacao(manifesto, agora);
        const registro = vincularSessaoExportacao(descritor, manifesto, usuario, agora);
        await registrarExportacaoCompleta(db, registro, backup, agora);
        return NextResponse.json({
            success: true,
            sessaoId: descritor.sessaoId,
            expiraEm: descritor.expiraEm,
            totalArquivos: manifesto.totalArquivos,
            arquivosPrivadosIncluidos: false,
            transferenciaHabilitada: false,
            instalacaoOfflinePronta: false,
        }, { status: 201, headers });
    } catch (error) {
        console.error("Falha ao registrar sessão de exportação Desktop:", error);
        return NextResponse.json(
            { success: false, message: "Não foi possível registrar a sessão de exportação." },
            { status: 500, headers }
        );
    }
}
