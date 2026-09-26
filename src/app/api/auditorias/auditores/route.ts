import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { temPermissao } from "@/lib/auth/authorization";

export async function GET(request: Request) {
    const auth = await requirePermission("auditorias.iniciar");

    if (!auth.autorizado) {
        return NextResponse.json(
            {
                success: false,
                message:
                    auth.motivo === "NAO_AUTENTICADO"
                        ? "Usuário não autenticado."
                        : "Você não possui permissão para iniciar auditorias.",
            },
            {
                status:
                    auth.motivo === "NAO_AUTENTICADO" ? 401 : 403,
            }
        );
    }

    const usuario = auth.usuario;

    const { searchParams } = new URL(request.url);
    const lojaId = searchParams.get("loja_id")?.trim();

    if (!lojaId) {
        return NextResponse.json(
            {
                success: false,
                message: "Loja não informada.",
            },
            { status: 400 }
        );
    }

    // Verifica se a loja existe e está ativa.
    const lojaResult = await db.execute({
        sql: `
            SELECT id
            FROM lojas
            WHERE id = ?
              AND ativo = 1
            LIMIT 1
        `,
        args: [lojaId],
    });

    if (lojaResult.rows.length === 0) {
        return NextResponse.json(
            {
                success: false,
                message: "Loja não encontrada ou inativa.",
            },
            { status: 404 }
        );
    }

    /*
     * CONSULTOR criando auditoria:
     * só pode trabalhar em lojas às quais ele está autorizado.
     */
    if (usuario.perfil === "CONSULTOR") {
        const autorizacaoResult = await db.execute({
            sql: `
                SELECT 1
                FROM usuario_lojas
                WHERE usuario_id = ?
                  AND loja_id = ?
                LIMIT 1
            `,
            args: [usuario.id, lojaId],
        });

        if (autorizacaoResult.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Você não possui autorização para realizar auditorias nesta loja.",
                },
                { status: 403 }
            );
        }
    }

    /*
     * Buscamos somente usuários ativos.
     *
     * CONSULTOR:
     * precisa estar vinculado à loja.
     *
     * SUPERVISORA / MASTER:
     * não precisam de vínculo com a loja para atuar como auditor.
     */
    const usuariosResult = await db.execute({
        sql: `
            SELECT
                u.id,
                u.nome,
                u.email,
                u.perfil,
                u.ativo
            FROM usuarios u
            WHERE u.ativo = 1
              AND u.perfil IN ('MASTER', 'SUPERVISORA', 'CONSULTOR')
            ORDER BY u.nome
        `,
        args: [],
    });

    const auditores = [];

    for (const row of usuariosResult.rows) {
        const auditorId = String(row.id);
        const perfil = String(row.perfil);

        const podeExecutar = await temPermissao(
            auditorId,
            "auditorias.executar"
        );

        if (!podeExecutar) {
            continue;
        }

        /*
         * MASTER e SUPERVISORA não precisam
         * de autorização em usuario_lojas.
         */
        if (perfil === "MASTER" || perfil === "SUPERVISORA") {
            auditores.push({
                id: auditorId,
                nome: String(row.nome),
                email: row.email ? String(row.email) : null,
                perfil,
                ativo: Number(row.ativo),
            });

            continue;
        }

        /*
         * CONSULTOR precisa obrigatoriamente
         * estar autorizado à loja selecionada.
         */
        if (perfil === "CONSULTOR") {
            const vinculoResult = await db.execute({
                sql: `
                    SELECT 1
                    FROM usuario_lojas
                    WHERE usuario_id = ?
                      AND loja_id = ?
                    LIMIT 1
                `,
                args: [auditorId, lojaId],
            });

            if (vinculoResult.rows.length === 0) {
                continue;
            }

            auditores.push({
                id: auditorId,
                nome: String(row.nome),
                email: row.email ? String(row.email) : null,
                perfil,
                ativo: Number(row.ativo),
            });
        }
    }

    /*
     * Se o usuário atual for CONSULTOR,
     * ele só deve aparecer se estiver autorizado
     * à loja — regra já validada acima.
     */
    return NextResponse.json({
        success: true,
        auditores,
    });
}