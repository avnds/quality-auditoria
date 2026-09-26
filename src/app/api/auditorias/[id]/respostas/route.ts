import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

const RESULTADOS_VALIDOS = [
    "CONFORME",
    "PARCIALMENTE_CONFORME",
    "NAO_CONFORME",
    "NAO_APLICAVEL",
] as const;

type Resultado = (typeof RESULTADOS_VALIDOS)[number];

export async function POST(
    request: Request,
    context: RouteContext
) {
    try {
        const resultadoPermissao =
            await requirePermission("auditorias.responder");

        if (!resultadoPermissao.autorizado) {
            if (
                resultadoPermissao.motivo ===
                "NAO_AUTENTICADO"
            ) {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const usuario = resultadoPermissao.usuario;
        const { id } = await context.params;

        const body = await request.json();

        const auditoriaSetorId = String(
            body.auditoriaSetorId ?? ""
        ).trim();

        const checklistItemId = String(
            body.checklistItemId ?? ""
        ).trim();

        const resultado = String(
            body.resultado ?? ""
        ).trim() as Resultado;

        const observacao =
            body.observacao === null ||
            body.observacao === undefined
                ? ""
                : String(body.observacao).trim();

        if (
            !auditoriaSetorId ||
            !checklistItemId ||
            !RESULTADOS_VALIDOS.includes(resultado)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Dados da resposta inválidos.",
                },
                { status: 400 }
            );
        }

        const exigeObservacao =
            resultado === "PARCIALMENTE_CONFORME" ||
            resultado === "NAO_CONFORME";

        if (exigeObservacao && !observacao) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "É obrigatório informar uma observação para este resultado.",
                },
                { status: 400 }
            );
        }

        const auditoriaResult = await db.execute({
            sql: `
                SELECT
                    a.id,
                    a.loja_id,
                    av.id AS auditoria_versao_id,
                    av.status
                FROM auditorias a
                INNER JOIN auditoria_versoes av
                    ON av.auditoria_id = a.id
                WHERE a.id = ?
                  AND av.numero = (
                      SELECT MAX(av2.numero)
                      FROM auditoria_versoes av2
                      WHERE av2.auditoria_id = a.id
                  )
                LIMIT 1
            `,
            args: [id],
        });

        if (auditoriaResult.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Auditoria não encontrada.",
                },
                { status: 404 }
            );
        }

        const auditoria = auditoriaResult.rows[0];

        if (
            usuario.perfil !== "MASTER" &&
            usuario.perfil !== "SUPERVISORA"
        ) {
            const autorizacaoResult = await db.execute({
                sql: `
                    SELECT 1
                    FROM usuario_lojas
                    WHERE usuario_id = ?
                      AND loja_id = ?
                    LIMIT 1
                `,
                args: [
                    usuario.id,
                    String(auditoria.loja_id),
                ],
            });

            if (autorizacaoResult.rows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Você não possui autorização para esta auditoria.",
                    },
                    { status: 403 }
                );
            }
        }

        if (String(auditoria.status) !== "ABERTA") {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Esta auditoria não está aberta para respostas.",
                },
                { status: 409 }
            );
        }

        const setorResult = await db.execute({
            sql: `
                SELECT 1
                FROM auditoria_setores
                WHERE id = ?
                  AND auditoria_versao_id = ?
                LIMIT 1
            `,
            args: [
                auditoriaSetorId,
                String(auditoria.auditoria_versao_id),
            ],
        });

        if (setorResult.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Setor da auditoria inválido.",
                },
                { status: 400 }
            );
        }

        const itemResult = await db.execute({
            sql: `
                SELECT 1
                FROM checklist_itens ci
                INNER JOIN checklist_secoes cs
                    ON cs.id = ci.checklist_secao_id
                INNER JOIN auditoria_setores aus
                    ON aus.checklist_versao_id =
                       cs.checklist_versao_id
                WHERE ci.id = ?
                  AND aus.id = ?
                  AND ci.ativo = 1
                LIMIT 1
            `,
            args: [
                checklistItemId,
                auditoriaSetorId,
            ],
        });

        if (itemResult.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Item do checklist inválido para este setor.",
                },
                { status: 400 }
            );
        }

        const existenteResult = await db.execute({
            sql: `
                SELECT id
                FROM auditoria_respostas
                WHERE auditoria_setor_id = ?
                  AND checklist_item_id = ?
                LIMIT 1
            `,
            args: [
                auditoriaSetorId,
                checklistItemId,
            ],
        });

        if (existenteResult.rows.length > 0) {
            const respostaId = String(
                existenteResult.rows[0].id
            );

            await db.execute({
                sql: `
                    UPDATE auditoria_respostas
                    SET resultado = ?,
                        observacao = ?,
                        respondido_em = CURRENT_TIMESTAMP
                    WHERE id = ?
                `,
                args: [
                    resultado,
                    observacao || null,
                    respostaId,
                ],
            });

            return NextResponse.json({
                success: true,
                resposta: {
                    id: respostaId,
                    auditoriaSetorId,
                    checklistItemId,
                    resultado,
                    observacao: observacao || null,
                },
                atualizado: true,
            });
        }

        const respostaId = crypto.randomUUID();

        await db.execute({
            sql: `
                INSERT INTO auditoria_respostas (
                    id,
                    auditoria_setor_id,
                    checklist_item_id,
                    resultado,
                    observacao,
                    respondido_em
                )
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `,
            args: [
                respostaId,
                auditoriaSetorId,
                checklistItemId,
                resultado,
                observacao || null,
            ],
        });

        return NextResponse.json({
            success: true,
            resposta: {
                id: respostaId,
                auditoriaSetorId,
                checklistItemId,
                resultado,
                observacao: observacao || null,
            },
            criado: true,
        });
    } catch (error) {
        console.error(
            "Erro ao salvar resposta da auditoria:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível salvar a resposta.",
            },
            { status: 500 }
        );
    }
}