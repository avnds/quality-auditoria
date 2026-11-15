import type { Client } from "@libsql/client";
import type { SessaoExportacaoAutorizada } from "./autorizacao-sessao-exportacao";
import type { DescritorSessaoExportacao } from "./sessao-exportacao";
import {
    SQL_BUSCAR_SESSAO_EXPORTACAO,
    SQL_REVOGAR_SESSAO_EXPORTACAO,
} from "./schema-sessoes-exportacao";

/**
 * A tabela precisa existir previamente por migração autorizada.
 * Este módulo nunca cria tabelas e nunca é chamado automaticamente.
 */
export async function registrarSessaoExportacao(
    db: Client,
    registro: SessaoExportacaoAutorizada
): Promise<void> {
    const { descritor, usuarioId, perfilNaCriacao } = registro;
    const criada = Date.parse(descritor.criadaEm);
    const expira = Date.parse(descritor.expiraEm);
    if (!Number.isFinite(criada) || !Number.isFinite(expira) ||
        expira <= criada || expira - criada > 3_600_000 ||
        !/^[0-9a-f-]{36}$/.test(descritor.sessaoId) ||
        !/^[a-f0-9]{64}$/.test(descritor.manifestoSha256) ||
        !usuarioId || (perfilNaCriacao !== "MASTER" && perfilNaCriacao !== "SUPERVISORA")) {
        throw new Error("Registro de sessão inválido.");
    }
    await db.execute({
        sql: `INSERT INTO desktop_export_sessions
            (sessao_id, usuario_id, perfil_criacao, manifesto_sha256,
             criada_em, expira_em, revogada_em, criada_em_unix, expira_em_unix)
            VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        args: [
            descritor.sessaoId, usuarioId, perfilNaCriacao,
            descritor.manifestoSha256, descritor.criadaEm, descritor.expiraEm,
            criada, expira,
        ],
    });
}

export async function consultarSessaoExportacao(
    db: Client,
    sessaoId: string,
    usuarioId: string,
    agora = new Date()
): Promise<SessaoExportacaoAutorizada | null> {
    if (!/^[0-9a-f-]{36}$/.test(sessaoId) || !usuarioId ||
        !Number.isFinite(agora.getTime())) return null;
    const resultado = await db.execute({
        sql: SQL_BUSCAR_SESSAO_EXPORTACAO,
        args: [sessaoId, usuarioId, agora.getTime()],
    });
    const row = resultado.rows[0];
    if (!row) return null;
    const descritor: DescritorSessaoExportacao = {
        formato: "quality-desktop-export-session",
        versao: 1,
        sessaoId: String(row.sessao_id),
        criadaEm: String(row.criada_em),
        expiraEm: String(row.expira_em),
        manifestoSha256: String(row.manifesto_sha256),
    };
    return {
        descritor,
        usuarioId: String(row.usuario_id),
        perfilNaCriacao: String(row.perfil_criacao) as "MASTER" | "SUPERVISORA",
    };
}

export async function revogarSessaoExportacao(
    db: Client,
    sessaoId: string,
    usuarioId: string,
    agora = new Date()
): Promise<boolean> {
    if (!/^[0-9a-f-]{36}$/.test(sessaoId) || !usuarioId ||
        !Number.isFinite(agora.getTime())) return false;
    const resultado = await db.execute({
        sql: SQL_REVOGAR_SESSAO_EXPORTACAO,
        args: [agora.toISOString(), sessaoId, usuarioId],
    });
    return resultado.rowsAffected > 0;
}
