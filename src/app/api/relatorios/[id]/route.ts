import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    calcularResultados,
    type RespostaParaCalculo,
    type ResultadoAuditoria,
    type ResultadoPontuacao,
} from "@/lib/auditorias/calcular-resultados";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

type RouteContext = {
    params: Promise<{ id: string }>;
};

const RESULTADOS_VALIDOS = new Set<ResultadoAuditoria>([
    "CONFORME",
    "PARCIALMENTE_CONFORME",
    "NAO_CONFORME",
    "NAO_APLICAVEL",
]);

export async function GET(
    _request: Request,
    context: RouteContext
) {
    try {
        const auth = await requirePermission("relatorios.visualizar");

        if (!auth.autorizado) {
            return auth.motivo === "NAO_AUTENTICADO"
                ? unauthorizedResponse()
                : forbiddenResponse();
        }

        const usuario = auth.usuario;
        const { id } = await context.params;

        const args: string[] = [id];
        let filtroLoja = "";

        if (
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

        const auditoriaResult = await db.execute({
            sql: `
                SELECT
                    a.id,
                    a.loja_id,
                    a.auditor_id,
                    a.gerente_loja_nome,
                    a.encarregado_nome,
                    a.gerente_setor_nome,
                    a.criada_em,
                    l.nome AS loja_nome,
                    c.nome_fantasia AS cliente_nome,
                    u.nome AS auditor_nome,
                    av.id AS auditoria_versao_id,
                    av.numero AS versao_numero,
                    av.status AS versao_status,
                    av.criada_em AS versao_criada_em
                FROM auditorias a
                INNER JOIN lojas l ON l.id = a.loja_id
                INNER JOIN clientes c ON c.id = l.cliente_id
                INNER JOIN usuarios u ON u.id = a.auditor_id
                INNER JOIN auditoria_versoes av
                    ON av.auditoria_id = a.id
                WHERE a.id = ?
                  AND av.numero = (
                      SELECT MAX(av2.numero)
                      FROM auditoria_versoes av2
                      WHERE av2.auditoria_id = a.id
                  )
                  AND av.status = 'FINALIZADA'
                  ${filtroLoja}
                LIMIT 1
            `,
            args,
        });

        if (auditoriaResult.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Auditoria finalizada não encontrada ou sem autorização.",
                },
                { status: 404 }
            );
        }

        const auditoria = auditoriaResult.rows[0];
        const versaoId = String(auditoria.auditoria_versao_id);
        const [permissaoGerar, permissaoBaixar, relatorioResult] =
            await Promise.all([
                requirePermission("relatorios.gerar"),
                requirePermission("relatorios.baixar"),
                db.execute({
                    sql: `
                SELECT gerado_em
                FROM relatorios
                WHERE auditoria_versao_id = ?
                  AND arquivo_uri IS NOT NULL
                LIMIT 1
            `,
                    args: [versaoId],
                }),
            ]);

        const podeGerar = permissaoGerar.autorizado;
        const podeBaixar = permissaoBaixar.autorizado;

        const relatorioExistente = relatorioResult.rows[0] ?? null;

        const setoresResult = await db.execute({
            sql: `
                SELECT
                    aus.id AS auditoria_setor_id,
                    aus.setor_id,
                    s.nome AS setor_nome,
                    aus.checklist_versao_id,
                    cv.numero AS checklist_versao_numero,
                    c.nome AS checklist_nome,
                    aus.ordem
                FROM auditoria_setores aus
                INNER JOIN setores s ON s.id = aus.setor_id
                INNER JOIN checklist_versoes cv
                    ON cv.id = aus.checklist_versao_id
                INNER JOIN checklists c ON c.id = cv.checklist_id
                WHERE aus.auditoria_versao_id = ?
                ORDER BY aus.ordem
            `,
            args: [versaoId],
        });

        const setores = [];
        const resultadosPorSetor: ResultadoPontuacao[] = [];

        for (const setor of setoresResult.rows) {
            const secoesResult = await db.execute({
                sql: `
                    SELECT id, nome, descricao, ordem
                    FROM checklist_secoes
                    WHERE checklist_versao_id = ?
                    ORDER BY ordem
                `,
                args: [String(setor.checklist_versao_id)],
            });

            const secoes = [];
            const itensParaCalculo: RespostaParaCalculo[] = [];

            for (const secao of secoesResult.rows) {
                const itensResult = await db.execute({
                    sql: `
                        SELECT
                            ci.id,
                            ci.texto,
                            ci.orientacao,
                            ci.ordem,
                            ci.item_vencimento,
                            ar.id AS resposta_id,
                            ar.resultado,
                            ar.observacao,
                            ar.respondido_em
                        FROM checklist_itens ci
                        LEFT JOIN auditoria_respostas ar
                            ON ar.checklist_item_id = ci.id
                           AND ar.auditoria_setor_id = ?
                        WHERE ci.checklist_secao_id = ?
                          AND ci.ativo = 1
                        ORDER BY ci.ordem
                    `,
                    args: [
                        String(setor.auditoria_setor_id),
                        String(secao.id),
                    ],
                });

                const itens = [];

                for (const item of itensResult.rows) {
                    const resultadoBruto =
                        item.resultado == null
                            ? null
                            : String(item.resultado);

                    const resultadoValido =
                        resultadoBruto !== null &&
                            RESULTADOS_VALIDOS.has(
                                resultadoBruto as ResultadoAuditoria
                            )
                            ? (resultadoBruto as ResultadoAuditoria)
                            : null;

                    itensParaCalculo.push({
                        checklist_item_id: String(item.id),
                        resultado: resultadoValido,
                        item_vencimento:
                            item.item_vencimento == null
                                ? null
                                : Number(item.item_vencimento),
                    });

                    let evidencias: {
                        id: string;
                        ordem: number;
                    }[] = [];

                    if (item.resposta_id != null) {
                        const evidenciasResult = await db.execute({
                            sql: `
                                SELECT id, ordem
                                FROM evidencias
                                WHERE resposta_id = ?
                                ORDER BY ordem
                            `,
                            args: [String(item.resposta_id)],
                        });

                        evidencias = evidenciasResult.rows.map((e) => ({
                            id: String(e.id),
                            ordem: Number(e.ordem),
                        }));
                    }

                    itens.push({
                        id: String(item.id),
                        texto: String(item.texto),
                        orientacao:
                            item.orientacao == null
                                ? null
                                : String(item.orientacao),
                        ordem: Number(item.ordem),
                        item_vencimento:
                            item.item_vencimento == null
                                ? null
                                : Number(item.item_vencimento),
                        resposta:
                            item.resposta_id == null
                                ? null
                                : {
                                    id: String(item.resposta_id),
                                    resultado: resultadoBruto,
                                    observacao:
                                        item.observacao == null
                                            ? null
                                            : String(item.observacao),
                                    respondido_em:
                                        item.respondido_em == null
                                            ? null
                                            : String(item.respondido_em),
                                    evidencias,
                                },
                    });
                }

                secoes.push({
                    id: String(secao.id),
                    nome: String(secao.nome),
                    descricao:
                        secao.descricao == null
                            ? null
                            : String(secao.descricao),
                    ordem: Number(secao.ordem),
                    itens,
                });
            }

            const resultados = calcularResultados(itensParaCalculo);
            resultadosPorSetor.push(resultados);

            setores.push({
                id: String(setor.auditoria_setor_id),
                setor_id: String(setor.setor_id),
                nome: String(setor.setor_nome),
                checklist_nome: String(setor.checklist_nome),
                checklist_versao_numero: Number(
                    setor.checklist_versao_numero
                ),
                ordem: Number(setor.ordem),
                secoes,
                resultados,
            });
        }

        const resultadosGerais: ResultadoPontuacao = {
            totalItens: 0,
            totalRespondidos: 0,
            totalConformes: 0,
            totalParcialmenteConformes: 0,
            totalNaoConformes: 0,
            totalNaoAplicaveis: 0,
            totalPendentes: 0,
            pontosObtidos: 0,
            maximoAplicavel: 0,
            percentual: null,
            alertaAbaixoDe60: false,
        };

        let somaPonderada = 0;
        let denominador = 0;

        for (const resultado of resultadosPorSetor) {
            resultadosGerais.totalItens += resultado.totalItens;
            resultadosGerais.totalRespondidos += resultado.totalRespondidos;
            resultadosGerais.totalConformes += resultado.totalConformes;
            resultadosGerais.totalParcialmenteConformes +=
                resultado.totalParcialmenteConformes;
            resultadosGerais.totalNaoConformes += resultado.totalNaoConformes;
            resultadosGerais.totalNaoAplicaveis +=
                resultado.totalNaoAplicaveis;
            resultadosGerais.totalPendentes += resultado.totalPendentes;
            resultadosGerais.pontosObtidos += resultado.pontosObtidos;
            resultadosGerais.maximoAplicavel += resultado.maximoAplicavel;

            if (
                resultado.percentual !== null &&
                resultado.maximoAplicavel > 0
            ) {
                somaPonderada +=
                    resultado.percentual * resultado.maximoAplicavel;
                denominador += resultado.maximoAplicavel;
            }
        }

        if (denominador > 0) {
            resultadosGerais.percentual = somaPonderada / denominador;
            resultadosGerais.alertaAbaixoDe60 =
                resultadosGerais.percentual < 60;
        }

        return NextResponse.json({
            success: true,
            auditoria: {
                id: String(auditoria.id),
                cliente_nome: String(auditoria.cliente_nome),
                loja_id: String(auditoria.loja_id),
                loja_nome: String(auditoria.loja_nome),
                auditor_id: String(auditoria.auditor_id),
                auditor_nome: String(auditoria.auditor_nome),
                gerente_loja_nome:
                    auditoria.gerente_loja_nome == null
                        ? null
                        : String(auditoria.gerente_loja_nome),
                encarregado_nome:
                    auditoria.encarregado_nome == null
                        ? null
                        : String(auditoria.encarregado_nome),
                gerente_setor_nome:
                    auditoria.gerente_setor_nome == null
                        ? null
                        : String(auditoria.gerente_setor_nome),
                criada_em: String(auditoria.criada_em),
                versao: {
                    id: versaoId,
                    numero: Number(auditoria.versao_numero),
                    status: String(auditoria.versao_status),
                    criada_em: String(auditoria.versao_criada_em),
                },
                podeGerar,
                podeBaixar,
                pdfDisponivel: Boolean(relatorioExistente),
                pdfGeradoEm:
                    relatorioExistente?.gerado_em == null
                        ? null
                        : String(relatorioExistente.gerado_em),
                setores,
                resultados: resultadosGerais,
            },
        });
    } catch (error) {
        console.error("Erro ao carregar prévia do relatório:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível carregar a prévia do relatório.",
            },
            { status: 500 }
        );
    }
}