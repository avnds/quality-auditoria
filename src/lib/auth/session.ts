import { createHash, randomBytes, randomUUID } from "crypto";
import db from "../db";

const SESSION_DURATION_DAYS = 7;

function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

export async function createSession(usuarioId: string) {
    // Encerra qualquer sessão anterior do usuário
    await db.execute({
        sql: `
            UPDATE sessoes
            SET encerrada_em = CURRENT_TIMESTAMP
            WHERE usuario_id = ?
              AND encerrada_em IS NULL
        `,
        args: [usuarioId],
    });

    // Gera o token que ficará no navegador
    const token = randomBytes(32).toString("hex");

    // No banco fica somente o hash
    const tokenHash = hashToken(token);

    const sessionId = randomUUID();

    await db.execute({
        sql: `
            INSERT INTO sessoes (
                id,
                usuario_id,
                token_hash,
                expira_em
            )
            VALUES (
                ?,
                ?,
                ?,
                datetime(CURRENT_TIMESTAMP, '+${SESSION_DURATION_DAYS} days')
            )
        `,
        args: [
            sessionId,
            usuarioId,
            tokenHash,
        ],
    });

    return {
        sessionId,
        token,
    };
}

export async function getSessionByToken(token: string) {
    const tokenHash = hashToken(token);

    const result = await db.execute({
        sql: `
            SELECT
                s.id,
                s.usuario_id,
                s.expira_em,
                u.nome,
                u.email,
                u.perfil
            FROM sessoes s
            INNER JOIN usuarios u
                ON u.id = s.usuario_id
            WHERE s.token_hash = ?
              AND s.encerrada_em IS NULL
              AND s.expira_em > CURRENT_TIMESTAMP
              AND u.ativo = 1
            LIMIT 1
        `,
        args: [tokenHash],
    });

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}

export async function destroySession(token: string) {
    const tokenHash = hashToken(token);

    await db.execute({
        sql: `
            UPDATE sessoes
            SET encerrada_em = CURRENT_TIMESTAMP
            WHERE token_hash = ?
              AND encerrada_em IS NULL
        `,
        args: [tokenHash],
    });
}