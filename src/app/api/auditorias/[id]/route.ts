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

export async function GET(
    _request: Request,
    context: RouteContext
) {
    try {
        const resultado = await requirePermission("auditorias.executar");

        if (!resultado.autorizado) {
            if (resultado.motivo === "NAO_AUTENTICADO") {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const usuario = resultado.usuario;
        const { id } = await context.params;

        const auditoriaResult = await db.execute({
            sql: `
                SELECT
                    a.id,
                    a.loja_id,
                    a.auditor_id,
                    a.encarregado_nome,
                    a.gerente_setor_nome,
                    a.gerente_loja_nome,
                    a.criada_em,

                    l.nome AS loja_nome,
                    c.nome_fantasia AS cliente_nome,

                    u.nome AS auditor_nome,
                    u.perfil AS auditor_perfil,

                    av.id AS auditoria_versao_id,
                    av.numero AS versao_numero,
                    av.status AS versao_status,
                    av.criada_em AS versao_criada_em

                FROM auditorias a

                INNER JOIN lojas l
                    ON l.id = a.loja_id

                INNER JOIN clientes c
                    ON c.id = l.cliente_id

                INNER JOIN usuarios u
                    ON u.id = a.auditor_id

                INNER JOIN auditoria_versoes av
                    ON av.auditoria_id = a.id

                ${usuario.perfil === "MASTER" ||
                    usuario.perfil === "SUPERVISORA"
                    ? ""
                    : `
                            INNER JOIN usuario_lojas ul
                                ON ul.loja_id = a.loja_id
                               AND ul.usuario_id = ?
                        `
                }

                WHERE a.id = ?

                  AND av.numero = (
                      SELECT MAX(av2.numero)
                      FROM auditoria_versoes av2
                      WHERE av2.auditoria_id = a.id
                  )

                LIMIT 1
            `,
            args:
                usuario.perfil === "MASTER" ||
                    usuario.perfil === "SUPERVISORA"
                    ? [id]
                    : [usuario.id, id],
        });

        if (auditoriaResult.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Auditoria não encontrada ou sem autorização.",
                },
                { status: 404 }
            );
        }

        const auditoria = auditoriaResult.rows[0];

        const evidenciasResult = await db.execute({
            sql: `
        SELECT
            e.id,
            e.resposta_id,
            e.ordem

        FROM evidencias e

        INNER JOIN auditoria_respostas ar
            ON ar.id = e.resposta_id

        INNER JOIN auditoria_setores aus
            ON aus.id = ar.auditoria_setor_id

        WHERE aus.auditoria_versao_id = ?

        ORDER BY
            e.resposta_id,
            e.ordem
    `,
            args: [auditoria.auditoria_versao_id],
        });

        const evidenciasPorResposta = new Map<
            string,
            Array<{
                id: string;
                ordem: number;
            }>
        >();

        for (const evidencia of evidenciasResult.rows) {
            const respostaId = String(evidencia.resposta_id);

            const lista =
                evidenciasPorResposta.get(respostaId) ?? [];

            lista.push({
                id: String(evidencia.id),
                ordem: Number(evidencia.ordem),
            });

            evidenciasPorResposta.set(
                respostaId,
                lista
            );
        }

        const setoresResult = await db.execute({
            sql: `
                SELECT
                    aus.id AS auditoria_setor_id,
                    aus.setor_id,
                    s.nome AS setor_nome,
                    aus.checklist_versao_id,
                    cv.numero AS checklist_versao_numero,
                    c.id AS checklist_id,
                    c.nome AS checklist_nome,
                    aus.ordem

                FROM auditoria_setores aus

                INNER JOIN setores s
                    ON s.id = aus.setor_id

                INNER JOIN checklist_versoes cv
                    ON cv.id = aus.checklist_versao_id

                INNER JOIN checklists c
                    ON c.id = cv.checklist_id

                WHERE aus.auditoria_versao_id = ?

                ORDER BY aus.ordem
            `,
            args: [auditoria.auditoria_versao_id],
        });

        const setores = [];

        for (const setor of setoresResult.rows) {
            const secoesResult = await db.execute({
                sql: `
                    SELECT
                        cs.id,
                        cs.nome,
                        cs.descricao,
                        cs.ordem

                    FROM checklist_secoes cs

                    WHERE cs.checklist_versao_id = ?

                    ORDER BY cs.ordem
                `,
                args: [setor.checklist_versao_id],
            });

            const secoes = [];

            for (const secao of secoesResult.rows) {
                const itensResult = await db.execute({
                    sql: `
                        SELECT
                            ci.id,
                            ci.texto,
                            ci.orientacao,
                            ci.ordem,
                            ci.ativo,

                            ar.id AS resposta_id,
                            ar.resultado AS resposta_resultado,
                            ar.observacao AS resposta_observacao,
                            ar.respondido_em AS resposta_respondido_em

                        FROM checklist_itens ci

                        LEFT JOIN auditoria_respostas ar
                            ON ar.checklist_item_id = ci.id
                           AND ar.auditoria_setor_id = ?

                        WHERE ci.checklist_secao_id = ?
                          AND ci.ativo = 1

                        ORDER BY ci.ordem
                    `,
                    args: [
                        setor.auditoria_setor_id,
                        secao.id,
                    ],
                });

                secoes.push({
                    id: String(secao.id),
                    nome: String(secao.nome),
                    descricao:
                        secao.descricao === null ||
                            secao.descricao === undefined
                            ? null
                            : String(secao.descricao),
                    ordem: Number(secao.ordem),

                    itens: itensResult.rows.map((item) => ({
                        id: String(item.id),
                        texto: String(item.texto),
                        orientacao:
                            item.orientacao === null ||
                                item.orientacao === undefined
                                ? null
                                : String(item.orientacao),
                        ordem: Number(item.ordem),
                        ativo: Number(item.ativo) === 1,

                        resposta:
                            item.resposta_id === null ||
                                item.resposta_id === undefined
                                ? null
                                : {
                                    id: String(
                                        item.resposta_id
                                    ),
                                    resultado:
                                        item.resposta_resultado ===
                                            null ||
                                            item.resposta_resultado ===
                                            undefined
                                            ? null
                                            : String(
                                                item.resposta_resultado
                                            ),
                                    observacao:
                                        item.resposta_observacao ===
                                            null ||
                                            item.resposta_observacao ===
                                            undefined
                                            ? null
                                            : String(
                                                item.resposta_observacao
                                            ),
                                    respondido_em:
                                        item.resposta_respondido_em ===
                                            null ||
                                            item.resposta_respondido_em ===
                                            undefined
                                            ? null
                                            : String(
                                                item.resposta_respondido_em
                                            ),
                                    evidencias:
                                        evidenciasPorResposta.get(
                                            String(
                                                item.resposta_id
                                            )
                                        ) ?? [],
                                },
                    })),
                });
            }

            setores.push({
                auditoria_setor_id: String(
                    setor.auditoria_setor_id
                ),
                setor_id: String(setor.setor_id),
                setor_nome: String(setor.setor_nome),
                checklist_versao_id: String(
                    setor.checklist_versao_id
                ),
                checklist_versao_numero: Number(
                    setor.checklist_versao_numero
                ),
                checklist_id: String(setor.checklist_id),
                checklist_nome: String(setor.checklist_nome),
                ordem: Number(setor.ordem),
                secoes,
            });
        }

        return NextResponse.json({
            success: true,
            auditoria: {
                id: String(auditoria.id),
                loja_id: String(auditoria.loja_id),
                loja_nome: String(auditoria.loja_nome),
                cliente_nome: String(
                    auditoria.cliente_nome
                ),

                auditor_id: String(auditoria.auditor_id),
                auditor_nome: String(
                    auditoria.auditor_nome
                ),
                auditor_perfil: String(
                    auditoria.auditor_perfil
                ),

                encarregado_nome:
                    auditoria.encarregado_nome === null
                        ? null
                        : String(
                            auditoria.encarregado_nome
                        ),

                gerente_setor_nome:
                    auditoria.gerente_setor_nome === null
                        ? null
                        : String(
                            auditoria.gerente_setor_nome
                        ),

                gerente_loja_nome:
                    auditoria.gerente_loja_nome === null
                        ? null
                        : String(
                            auditoria.gerente_loja_nome
                        ),

                criada_em: String(auditoria.criada_em),

                versao: {
                    id: String(
                        auditoria.auditoria_versao_id
                    ),
                    numero: Number(
                        auditoria.versao_numero
                    ),
                    status: String(
                        auditoria.versao_status
                    ),
                    criada_em: String(
                        auditoria.versao_criada_em
                    ),
                },

                setores,
            },
        });
    } catch (error) {
        console.error(
            "Erro ao consultar execução da auditoria:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível carregar a auditoria para execução.",
            },
            { status: 500 }
        );
    }
}