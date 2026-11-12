import type { Client } from "@libsql/client";
import type { LogicalDatabaseBackup } from "../db/backup";
import type { SessaoExportacaoAutorizada } from "./autorizacao-sessao-exportacao";
import { prepararManifestoImportacaoDesktop } from "./manifesto-importacao";
import { validarDescritorSessaoExportacao } from "./sessao-exportacao";
import { prepararSnapshotManifestoExportacao } from "./snapshot-manifesto-exportacao";
import { serializarSnapshotManifesto } from "./serializacao-snapshot-manifesto";
import { serializarSnapshotBancoExportacao } from "./serializacao-snapshot-banco";

/**
 * Persiste os três registros numa única transação: ou todos são gravados,
 * ou nenhum. Requer tabelas previamente migradas e autorização pelo chamador.
 * Não cria tabelas, não acessa Blob e não habilita rotas de exportação.
 */
export async function registrarExportacaoCompleta(
    db: Client,
    registro: SessaoExportacaoAutorizada,
    backup: LogicalDatabaseBackup,
    agora = new Date()
): Promise<void> {
    const { descritor, usuarioId, perfilNaCriacao } = registro;
    const manifesto = prepararManifestoImportacaoDesktop(backup, "producao_direta");
    if (!usuarioId || !/^[A-Za-z0-9_-]{1,128}$/.test(usuarioId) ||
        (perfilNaCriacao !== "MASTER" && perfilNaCriacao !== "SUPERVISORA") ||
        !validarDescritorSessaoExportacao(descritor, manifesto, agora)) {
        throw new Error("Registro de exportação inválido ou expirado.");
    }
    const envelopeManifesto = serializarSnapshotManifesto(
        descritor, prepararSnapshotManifestoExportacao(descritor, manifesto)
    );
    const envelopeBanco = serializarSnapshotBancoExportacao(descritor, backup);
    const criada = Date.parse(descritor.criadaEm);
    const expira = Date.parse(descritor.expiraEm);
    const transaction = await db.transaction("write");
    try {
        await transaction.execute({
            sql: `INSERT INTO desktop_export_sessions
                  (sessao_id, usuario_id, perfil_criacao, manifesto_sha256,
                   criada_em, expira_em, revogada_em, criada_em_unix, expira_em_unix)
                  VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
            args: [descritor.sessaoId, usuarioId, perfilNaCriacao, descritor.manifestoSha256,
                descritor.criadaEm, descritor.expiraEm, criada, expira],
        });
        await transaction.execute({
            sql: `INSERT INTO desktop_export_manifests
                  (sessao_id, conteudo_json, conteudo_sha256) VALUES (?, ?, ?)`,
            args: [descritor.sessaoId, envelopeManifesto.conteudoJson, envelopeManifesto.conteudoSha256],
        });
        await transaction.execute({
            sql: `INSERT INTO desktop_export_database_snapshots
                  (sessao_id, conteudo_json, conteudo_sha256) VALUES (?, ?, ?)`,
            args: [descritor.sessaoId, envelopeBanco.conteudoJson, envelopeBanco.conteudoSha256],
        });
        await transaction.commit();
    } finally {
        await transaction.close();
    }
}
