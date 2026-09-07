import db from "@/lib/db";

export type Perfil = "MASTER" | "SUPERVISORA" | "CONSULTOR";

export async function temPermissao(
    usuarioId: string,
    permissao: string
): Promise<boolean> {
    const usuarioResult = await db.execute({
        sql: `
            SELECT perfil, ativo
            FROM usuarios
            WHERE id = ?
            LIMIT 1
        `,
        args: [usuarioId],
    });

    if (usuarioResult.rows.length === 0) {
        return false;
    }

    const usuario = usuarioResult.rows[0];

    if (usuario.ativo !== 1) {
        return false;
    }

    const perfil = String(usuario.perfil) as Perfil;

    // MASTER possui todas as permissões do sistema.
    if (perfil === "MASTER") {
        return true;
    }

    const permissaoResult = await db.execute({
        sql: `
            SELECT 1
            FROM usuario_permissao
            WHERE usuario_id = ?
              AND permissao_id = ?
            LIMIT 1
        `,
        args: [usuarioId, permissao],
    });

    return permissaoResult.rows.length > 0;
}