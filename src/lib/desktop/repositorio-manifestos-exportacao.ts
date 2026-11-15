import type { Client } from "@libsql/client";
import type { SessaoExportacaoAutorizada } from "./autorizacao-sessao-exportacao";
import type { SnapshotManifestoExportacao } from "./snapshot-manifesto-exportacao";
import {
    serializarSnapshotManifesto,
    desserializarSnapshotManifesto,
    type EnvelopeSnapshotManifesto,
} from "./serializacao-snapshot-manifesto";
import { consultarSessaoExportacao } from "./repositorio-sessoes-exportacao";

/**
 * Migração PROPOSTA, não executada automaticamente.
 * Deve ser aplicada somente depois de autorização explícita.
 * A tabela também deverá ser excluída da exportação lógica Desktop.
 */
export const NOME_TABELA_MANIFESTOS_EXPORTACAO = "desktop_export_manifests" as const;
export const SQL_CRIAR_TABELA_MANIFESTOS_EXPORTACAO = `
CREATE TABLE IF NOT EXISTS desktop_export_manifests (
    sessao_id TEXT PRIMARY KEY NOT NULL,
    conteudo_json TEXT NOT NULL,
    conteudo_sha256 TEXT NOT NULL CHECK(length(conteudo_sha256) = 64),
    FOREIGN KEY(sessao_id) REFERENCES desktop_export_sessions(sessao_id)
)`.trim();

/**
 * Exige uma sessão ativa, não revogada e pertencente ao usuário.
 * Não cria tabelas e não armazena URLs de Blob ou credenciais.
 */
export async function guardarManifestoExportacao(
    db: Client,
    registro: SessaoExportacaoAutorizada,
    snapshot: SnapshotManifestoExportacao,
    agora = new Date()
): Promise<void> {
    const sessao = await consultarSessaoExportacao(db, registro.descritor.sessaoId, registro.usuarioId, agora);
    if (!sessao || sessao.descritor.manifestoSha256 !== registro.descritor.manifestoSha256 ||
        sessao.perfilNaCriacao !== registro.perfilNaCriacao) {
        throw new Error("Sessão inexistente, expirada ou revogada.");
    }
    const envelope = serializarSnapshotManifesto(sessao.descritor, snapshot);
    await db.execute({
        sql: `INSERT INTO desktop_export_manifests (sessao_id, conteudo_json, conteudo_sha256)
              VALUES (?, ?, ?)`,
        args: [envelope.sessaoId, envelope.conteudoJson, envelope.conteudoSha256],
    });
}

export async function recuperarManifestoExportacao(
    db: Client,
    sessaoId: string,
    usuarioId: string,
    agora = new Date()
): Promise<SnapshotManifestoExportacao | null> {
    const sessao = await consultarSessaoExportacao(db, sessaoId, usuarioId, agora);
    if (!sessao) return null;
    const resultado = await db.execute({
        sql: `SELECT conteudo_json, conteudo_sha256 FROM desktop_export_manifests WHERE sessao_id = ? LIMIT 1`,
        args: [sessaoId],
    });
    const row = resultado.rows[0];
    if (!row) return null;
    const envelope: EnvelopeSnapshotManifesto = {
        formato: "quality-desktop-manifest-storage",
        versao: 1,
        sessaoId,
        conteudoJson: String(row.conteudo_json),
        conteudoSha256: String(row.conteudo_sha256),
    };
    return desserializarSnapshotManifesto(sessao.descritor, envelope);
}
