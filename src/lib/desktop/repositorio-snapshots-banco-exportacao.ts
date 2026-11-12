import type { Client } from "@libsql/client";
import type { LogicalDatabaseBackup } from "../db/backup";
import type { SessaoExportacaoAutorizada } from "./autorizacao-sessao-exportacao";
import { consultarSessaoExportacao } from "./repositorio-sessoes-exportacao";
import {
    serializarSnapshotBancoExportacao,
    desserializarSnapshotBancoExportacao,
    type EnvelopeSnapshotBancoExportacao,
} from "./serializacao-snapshot-banco";

/**
 * DDL proposto; nunca executado automaticamente. Snapshot contém dados
 * sensíveis e referências privadas. Requer controle de acesso e retenção.
 */
export const NOME_TABELA_SNAPSHOTS_BANCO_EXPORTACAO = "desktop_export_database_snapshots" as const;
export const SQL_CRIAR_TABELA_SNAPSHOTS_BANCO_EXPORTACAO = `
CREATE TABLE IF NOT EXISTS desktop_export_database_snapshots (
    sessao_id TEXT PRIMARY KEY NOT NULL,
    conteudo_json TEXT NOT NULL,
    conteudo_sha256 TEXT NOT NULL CHECK(length(conteudo_sha256) = 64),
    FOREIGN KEY(sessao_id) REFERENCES desktop_export_sessions(sessao_id)
)`.trim();

export async function guardarSnapshotBancoExportacao(
    db: Client,
    registro: SessaoExportacaoAutorizada,
    backup: LogicalDatabaseBackup,
    agora = new Date()
): Promise<void> {
    const sessao = await consultarSessaoExportacao(db, registro.descritor.sessaoId, registro.usuarioId, agora);
    if (!sessao ||
        sessao.perfilNaCriacao !== registro.perfilNaCriacao ||
        sessao.descritor.manifestoSha256 !== registro.descritor.manifestoSha256) {
        throw new Error("Sessão inexistente, expirada, revogada ou divergente.");
    }
    const envelope = serializarSnapshotBancoExportacao(sessao.descritor, backup);
    await db.execute({
        sql: `INSERT INTO desktop_export_database_snapshots
              (sessao_id, conteudo_json, conteudo_sha256) VALUES (?, ?, ?)`,
        args: [envelope.sessaoId, envelope.conteudoJson, envelope.conteudoSha256],
    });
}

export async function recuperarSnapshotBancoExportacao(
    db: Client,
    sessaoId: string,
    usuarioId: string,
    agora = new Date()
): Promise<LogicalDatabaseBackup | null> {
    const sessao = await consultarSessaoExportacao(db, sessaoId, usuarioId, agora);
    if (!sessao) return null;
    const resultado = await db.execute({
        sql: `SELECT conteudo_json, conteudo_sha256
              FROM desktop_export_database_snapshots WHERE sessao_id = ? LIMIT 1`,
        args: [sessaoId],
    });
    const row = resultado.rows[0];
    if (!row) return null;
    const envelope: EnvelopeSnapshotBancoExportacao = {
        formato: "quality-desktop-database-snapshot",
        versao: 1,
        sessaoId,
        conteudoJson: String(row.conteudo_json),
        conteudoSha256: String(row.conteudo_sha256),
    };
    return desserializarSnapshotBancoExportacao(sessao.descritor, envelope, agora);
}
