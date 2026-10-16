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

        /*
         * 5. Conta as respostas existentes para os itens
         *    pertencentes à versão atual da auditoria.
         */
        const respostasResult = await db.execute({
            sql: `
                SELECT
                    ar.auditoria_setor_id,
                    ar.checklist_item_id,
                    ar.resultado
                FROM auditoria_respostas ar
                INNER JOIN auditoria_setores aus
                    ON aus.id = ar.auditoria_setor_id
                INNER JOIN checklist_itens ci
                    ON ci.id = ar.checklist_item_id
                INNER JOIN checklist_secoes cs
                    ON cs.id = ci.checklist_secao_id
                   AND cs.checklist_versao_id =
                       aus.checklist_versao_id
                WHERE aus.auditoria_versao_id = ?
                  AND ci.ativo = 1
            `,
            args: [
                String(auditoria.auditoria_versao_id),
            ],
        });

        const resultadosValidos = new Set([
            "CONFORME",
            "PARCIALMENTE_CONFORME",
            "NAO_CONFORME",
            "NAO_APLICAVEL",
        ]);

        const itensAtivos = new Set(
            itensResult.rows.map(
                (item) =>
                    `${String(
                        item.auditoria_setor_id
                    )}:${String(
                        item.checklist_item_id
                    )}`
            )
        );

        const respostas = new Set(
            respostasResult.rows
                .filter((resposta) => {
                    const chave =
                        `${String(
                            resposta.auditoria_setor_id
                        )}:${String(
                            resposta.checklist_item_id
                        )}`;

                    return (
                        resultadosValidos.has(
                            String(resposta.resultado)
                        ) &&
                        itensAtivos.has(chave)
                    );
                })
                .map(
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

        const observacoesPendentesResult = await db.execute({
            sql: `
                SELECT
                    ar.id AS resposta_id,
                    ar.checklist_item_id,
                    ar.resultado
                FROM auditoria_respostas ar
                INNER JOIN auditoria_setores aus
                    ON aus.id = ar.auditoria_setor_id
                INNER JOIN checklist_itens ci
                    ON ci.id = ar.checklist_item_id
                   AND ci.ativo = 1
                INNER JOIN checklist_secoes cs
                    ON cs.id = ci.checklist_secao_id
                   AND cs.checklist_versao_id =
                       aus.checklist_versao_id
                WHERE aus.auditoria_versao_id = ?
                  AND ar.resultado IN (
                      'PARCIALMENTE_CONFORME',
                      'NAO_CONFORME'
                  )
                  AND TRIM(COALESCE(ar.observacao, '')) = ''
            `,
            args: [
                String(auditoria.auditoria_versao_id),
            ],
        });

        if (observacoesPendentesResult.rows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Não é possível enviar a auditoria: existem itens Parcialmente Conforme ou Não Conforme sem observação.",
                    pendencias: {
                        totalSemObservacao:
                            observacoesPendentesResult.rows.length,
                    },
                },
                { status: 409 }
            );
        }

        /*
        *7. Verifica se todos os itens Não Conforme
        * possuem pelo menos uma evidência fotográfica.
        */
        const evidenciasPendentesResult = await db.execute({
            sql: `
                SELECT
                    ar.id AS resposta_id,
                    ar.checklist_item_id,
                    COUNT(e.id) AS total_evidencias
                FROM auditoria_respostas ar
                INNER JOIN auditoria_setores aus
                    ON aus.id = ar.auditoria_setor_id
                INNER JOIN checklist_itens ci
                    ON ci.id = ar.checklist_item_id
                   AND ci.ativo = 1
                INNER JOIN checklist_secoes cs
                    ON cs.id = ci.checklist_secao_id
                   AND cs.checklist_versao_id =
                       aus.checklist_versao_id
                LEFT JOIN evidencias e
                    ON e.resposta_id = ar.id
                WHERE aus.auditoria_versao_id = ?
                  AND ar.resultado = 'NAO_CONFORME'
                GROUP BY
                    ar.id,
                    ar.checklist_item_id
                HAVING COUNT(e.id) < 1
            `,
            args: [
                String(auditoria.auditoria_versao_id),
            ],
        });

        if (evidenciasPendentesResult.rows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Não é possível enviar a auditoria: existem itens Não Conforme sem evidência fotográfica.",
                    pendencias: {
                        totalItensSemEvidencia:
                            evidenciasPendentesResult.rows.length,
                    },
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
        const transacao = await db.transaction("write");

        try {
            const atualizacao = await transacao.execute({
                sql: `
            UPDATE auditoria_versoes
            SET status = 'ENVIADA',
                enviada_em = CURRENT_TIMESTAMP
            WHERE id = ?
              AND status IN ('ABERTA', 'EM_CORRECAO')
        `,
                args: [
                    String(auditoria.auditoria_versao_id),
                ],
            });

            if (atualizacao.rowsAffected !== 1) {
                await transacao.rollback();

                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "A auditoria já foi alterada. Atualize a página antes de tentar novamente.",
                    },
                    { status: 409 }
                );
            }

            await transacao.execute({
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
                            String(auditoria.auditoria_versao_id),
                        versaoNumero:
                            Number(auditoria.versao_numero),
                        totalItens:
                            itensResult.rows.length,
                        totalRespondidos:
                            respostas.size,
                    }),
                ],
            });

            await transacao.commit();
        } catch (error) {
            try {
                await transacao.rollback();
            } catch {
                // Preserva o erro original da transação.
            }

            throw error;
        }

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