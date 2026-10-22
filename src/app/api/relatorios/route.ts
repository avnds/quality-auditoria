import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET() {
    const auth = await requirePermission("relatorios.visualizar");

    if (!auth.autorizado) {
        return NextResponse.json(
            {
                success: false,
                message:
                    auth.motivo === "NAO_AUTENTICADO"
                        ? "Usuário não autenticado."
                        : "Você não possui permissão para visualizar relatórios.",
            },
            {
                status:
                    auth.motivo === "NAO_AUTENTICADO" ? 401 : 403,
            }
        );
    }

    const usuario = auth.usuario;

    try {
        const args: string[] = [];

        let filtroLoja = "";

        if (usuario.perfil === "CONSULTOR") {
            filtroLoja = " AND a.auditor_id = ?";
            args.push(usuario.id);
        } else if (
            usuario.perfil !== "MASTER" &&
            usuario.perfil !== "SUPERVISORA"
        ) {
            filtroLoja = `
                AND EXISTS (
                    SELECT 1
                    FROM usuario_lojas ul
                    WHERE ul.loja_id = a.loja_id
                      AND ul.usuario_id = ?
                )
            `;

            args.push(usuario.id);
        }

        const result = await db.execute({
            sql: `
                SELECT
                    a.id AS auditoria_id,
                    av.id AS auditoria_versao_id,
                    av.numero AS versao_numero,
                    av.status AS status,
                    a.criada_em AS auditoria_criada_em,
                    av.criada_em AS versao_criada_em,
                    l.id AS loja_id,
                    l.nome AS loja_nome,
                    c.id AS cliente_id,
                    c.nome_fantasia AS cliente_nome,
                    u.id AS auditor_id,
                    u.nome AS auditor_nome,
                    a.gerente_loja_nome
                FROM auditorias a
                INNER JOIN auditoria_versoes av
                    ON av.auditoria_id = a.id
                INNER JOIN lojas l
                    ON l.id = a.loja_id
                INNER JOIN clientes c
                    ON c.id = l.cliente_id
                INNER JOIN usuarios u
                    ON u.id = a.auditor_id
                WHERE av.numero = (
                    SELECT MAX(av2.numero)
                    FROM auditoria_versoes av2
                    WHERE av2.auditoria_id = a.id
                )
                  AND av.status = 'FINALIZADA'
                  ${filtroLoja}
                ORDER BY av.criada_em DESC
            `,
            args,
        });

        return NextResponse.json({
            success: true,
            auditorias: result.rows,
        });
    } catch (error) {
        console.error("Erro ao listar relatórios:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Erro interno ao listar relatórios.",
            },
            { status: 500 }
        );
    }
}