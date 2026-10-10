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

export async function POST(
    _request: Request,
    context: RouteContext
) {
    try {
        const resultadoPermissao =
            await requirePermission("auditorias.executar");

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

        /*
         * 1. Localiza a auditoria e sua versão atual.
         */
        const auditoriaResult = await db.execute({
            sql: `
                SELECT
                    a.id,
                    a.auditor_id,
                    av.id AS auditoria_versao_id,
                    av.numero AS versao_numero,
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

        /*
         * 2. Somente o auditor responsável pode enviar
         *    a auditoria para validação.
         */
        if (String(auditoria.auditor_id) !== String(usuario.id)) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Somente o auditor responsável pode enviar esta auditoria para validação.",
                },
                { status: 403 }
            );
        }

        /*
         * 3. A auditoria precisa estar aberta.
         */
        if (
            String(auditoria.status) !== "ABERTA" &&
            String(auditoria.status) !== "EM_CORRECAO"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Somente auditorias abertas podem ser enviadas para validação.",
                },
                { status: 409 }
            );
        }

        /*
         * 4. Conta todos os itens ativos dos checklists
         *    selecionados para a versão atual da auditoria.
         */
        const itensResult = await db.execute({
            sql: `
                SELECT
                    aus.id AS auditoria_setor_id,
                    ci.id AS checklist_item_id
                FROM auditoria_setores aus
                INNER JOIN checklist_secoes cs
                    ON cs.checklist_versao_id =
                       aus.checklist_versao_id
                INNER JOIN checklist_itens ci
                    ON ci.checklist_secao_id = cs.id
                WHERE aus.auditoria_versao_id = ?
                  AND ci.ativo = 1
                ORDER BY aus.ordem, cs.ordem, ci.ordem
            `,
            args: [
                String(auditoria.auditoria_versao_id),
            ],
        });

        /*
         * 5. Conta as respostas existentes para os itens
         *    pertencentes à versão atual da auditoria.
         */
        const respostasResult = await db.execute({
            sql: `
                SELECT
                    ar.auditoria_setor_id,
                    ar.checklist_item_id
                FROM auditoria_respostas ar
                INNER JOIN auditoria_setores aus
                    ON aus.id = ar.auditoria_setor_id
                WHERE aus.auditoria_versao_id = ?
            `,
            args: [
                String(auditoria.auditoria_versao_id),
            ],
        });

        const respostas = new Set(
            respostasResult.rows.map(
                (resposta) =>
                    `${String(
                        resposta.auditoria_setor_id
                    )}:${String(
                        resposta.checklist_item_id
                    )}`
            )
        );

        /*
         * 6. Verifica exatamente quais itens estão sem resposta.
         */
        const itensPendentes = itensResult.rows.filter(
            (item) =>
                !respostas.has(
                    `${String(
                        item.auditoria_setor_id
                    )}:${String(
                        item.checklist_item_id
                    )}`
                )
        );

        if (itensPendentes.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Não é possível enviar a auditoria para validação porque existem itens sem resposta.",
                    pendencias: {
                        totalItens: itensResult.rows.length,
                        totalRespondidos:
                            itensResult.rows.length -
                            itensPendentes.length,
                        totalPendentes:
                            itensPendentes.length,
                    },
                },
                { status: 409 }
            );
        }

        /*
         * 7. Não permite uma auditoria sem itens.
         *
         * Isso também protege contra uma configuração
         * inconsistente de checklist.
         */
        if (itensResult.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "A auditoria não possui itens de checklist para responder.",
                },
                { status: 409 }
            );
        }
        const acaoHistorico =
            String(auditoria.status) === "EM_CORRECAO"
                ? "REENVIADA"
                : "ENVIADA_PARA_VALIDACAO";

        /*
         * 8. Atualiza o status e registra o histórico
         *    em uma única operação de escrita.
         */
        await db.batch(
            [
                {
                    sql: `
                        UPDATE auditoria_versoes
                        SET status = 'ENVIADA',
                            enviada_em = CURRENT_TIMESTAMP
                        WHERE id = ?
                            AND status IN ('ABERTA', 'EM_CORRECAO')
                    `,
                    args: [
                        String(
                            auditoria.auditoria_versao_id
                        ),
                    ],
                },
                {
                    sql: `
                        INSERT INTO auditoria_historico (
                            id,
                            auditoria_id,
                            usuario_id,
                            acao,
                            detalhes
                        )
                        VALUES (?, ?, ?, ?, ?)
                    `,
                    args: [
                        crypto.randomUUID(),
                        String(id),
                        String(usuario.id),
                        acaoHistorico,
                        JSON.stringify({
                            auditoriaVersaoId:
                                String(
                                    auditoria.auditoria_versao_id
                                ),
                            versaoNumero:
                                Number(
                                    auditoria.versao_numero
                                ),
                            totalItens:
                                itensResult.rows.length,
                            totalRespondidos:
                                respostas.size,
                        }),
                    ],
                },
            ],
            "write"
        );

        return NextResponse.json({
            success: true,
            message:
                "Auditoria enviada para validação com sucesso.",
            auditoria: {
                id: String(id),
                auditoriaVersaoId: String(
                    auditoria.auditoria_versao_id
                ),
                versaoNumero: Number(
                    auditoria.versao_numero
                ),
                status: "ENVIADA",
            },
        });
    } catch (error) {
        console.error(
            "Erro ao enviar auditoria para validação:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível enviar a auditoria para validação.",
            },
            { status: 500 }
        );
    }
}