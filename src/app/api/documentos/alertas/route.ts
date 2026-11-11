import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/auth/auth-response";
import {
    calcularStatusDocumento, dataAtualFortaleza,
    type ResultadoVerificacaoDocumento, type TipoControleDocumento,
} from "@/lib/documentos/calcular-status";

export async function GET() {
    try {
        const acesso = await requirePermission("documentos.visualizar");
        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO" ? unauthorizedResponse() : forbiddenResponse();
        }

        const consulta = await db.execute({
            sql: `WITH alvos AS (
                    SELECT l.id AS loja_id, l.nome AS loja_nome,
                           dl.id AS documento_loja_id, dc.nome AS documento_nome,
                           NULL AS instancia_id, NULL AS colaborador_id,
                           NULL AS colaborador_nome, dl.ciclo_atual AS ciclo_documento,
                           NULL AS ciclo_instancia, dc.tipo_controle,
                           COALESCE(dl.alerta_dias, dc.alerta_dias) AS alerta_dias
                    FROM documentos_lojas dl
                    JOIN lojas l ON l.id = dl.loja_id
                    JOIN documentos_catalogo dc ON dc.id = dl.documento_id
                    WHERE l.ativo = 1 AND dl.ativo = 1 AND dc.ativo = 1
                      AND dc.modalidade = 'LOJA'
                      AND (? IN ('MASTER', 'SUPERVISORA') OR EXISTS (
                          SELECT 1 FROM usuario_lojas ul
                          WHERE ul.loja_id = l.id AND ul.usuario_id = ?
                      ))
                    UNION ALL
                    SELECT l.id, l.nome, dl.id, dc.nome, di.id, c.id, c.nome,
                           dl.ciclo_atual, di.ciclo_atual, dc.tipo_controle,
                           COALESCE(dl.alerta_dias, dc.alerta_dias)
                    FROM documentos_lojas dl
                    JOIN lojas l ON l.id = dl.loja_id
                    JOIN documentos_catalogo dc ON dc.id = dl.documento_id
                    JOIN documentos_instancias di ON di.documento_loja_id = dl.id
                    JOIN colaboradores c ON c.id = di.colaborador_id AND c.loja_id = l.id
                    WHERE l.ativo = 1 AND dl.ativo = 1 AND dc.ativo = 1
                      AND di.ativo = 1 AND c.ativo = 1 AND dc.modalidade = 'COLABORADOR'
                      AND (? IN ('MASTER', 'SUPERVISORA') OR EXISTS (
                          SELECT 1 FROM usuario_lojas ul
                          WHERE ul.loja_id = l.id AND ul.usuario_id = ?
                      ))
                  ),
                  versoes AS (
                      SELECT v.*, ROW_NUMBER() OVER (
                          PARTITION BY COALESCE(v.verificacao_raiz_id, v.id)
                          ORDER BY v.versao DESC, v.id DESC
                      ) AS posicao
                      FROM documentos_verificacoes v
                      WHERE EXISTS (
                          SELECT 1 FROM alvos a WHERE a.documento_loja_id = v.documento_loja_id
                      )
                  ),
                  atuais AS (
                      SELECT v.*, raiz.registrado_em AS registro_original,
                             raiz.id AS id_original
                      FROM versoes v
                      JOIN documentos_verificacoes raiz
                        ON raiz.id = COALESCE(v.verificacao_raiz_id, v.id)
                      WHERE v.posicao = 1
                  ),
                  classificados AS (
                      SELECT a.*, v.id AS verificacao_id, v.resultado,
                             v.data_verificacao, v.data_prazo,
                             ROW_NUMBER() OVER (
                                 PARTITION BY a.documento_loja_id, a.instancia_id
                                 ORDER BY v.data_verificacao DESC,
                                          v.registro_original DESC, v.id_original DESC
                             ) AS posicao
                      FROM alvos a
                      LEFT JOIN atuais v ON v.documento_loja_id = a.documento_loja_id
                        AND ((a.instancia_id IS NULL AND v.instancia_id IS NULL)
                             OR a.instancia_id = v.instancia_id)
                        AND v.ciclo_documento = a.ciclo_documento
                        AND ((a.ciclo_instancia IS NULL AND v.ciclo_instancia IS NULL)
                             OR a.ciclo_instancia = v.ciclo_instancia)
                  )
                  SELECT * FROM classificados WHERE posicao = 1
                  ORDER BY loja_nome COLLATE NOCASE, documento_nome COLLATE NOCASE,
                           colaborador_nome COLLATE NOCASE`,
            args: [acesso.usuario.perfil, acesso.usuario.id,
                acesso.usuario.perfil, acesso.usuario.id],
        });

        const hoje = dataAtualFortaleza();
        const itens = consulta.rows.map((linha) => {
            const verificacaoId = linha.verificacao_id === null ? null : String(linha.verificacao_id);
            const status = calcularStatusDocumento({
                tipo_controle: String(linha.tipo_controle) as TipoControleDocumento,
                alerta_dias: Number(linha.alerta_dias),
                verificacao: verificacaoId === null ? null : {
                    resultado: String(linha.resultado) as ResultadoVerificacaoDocumento,
                    data_prazo: linha.data_prazo === null ? null : String(linha.data_prazo),
                },
                hoje,
            });
            return {
                loja_id: String(linha.loja_id),
                loja_nome: String(linha.loja_nome),
                documento_loja_id: String(linha.documento_loja_id),
                documento_nome: String(linha.documento_nome),
                instancia_id: linha.instancia_id === null ? null : String(linha.instancia_id),
                colaborador_id: linha.colaborador_id === null ? null : String(linha.colaborador_id),
                colaborador_nome: linha.colaborador_nome === null ? null : String(linha.colaborador_nome),
                verificacao_id: verificacaoId,
                data_verificacao: linha.data_verificacao === null ? null : String(linha.data_verificacao),
                ...status,
            };
        });
        const alertas = itens.filter((item) => item.exige_atencao);
        return NextResponse.json({
            success: true, hoje, alertas,
            resumo: {
                total_documentos: itens.length,
                verificados: itens.filter((item) => item.verificacao_id !== null).length,
                total_alertas: alertas.length,
                por_status: alertas.reduce<Record<string, number>>((acumulado, item) => {
                    acumulado[item.status] = (acumulado[item.status] ?? 0) + 1;
                    return acumulado;
                }, {}),
            },
        });
    } catch (error) {
        console.error("Erro ao consultar alertas documentais:", error);
        return NextResponse.json({
            success: false, message: "Não foi possível consultar os alertas documentais.",
        }, { status: 500 });
    }
}
