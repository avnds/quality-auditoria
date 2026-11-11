import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/auth/auth-response";
import { calcularStatusDocumento, dataAtualFortaleza, type ResultadoVerificacaoDocumento, type TipoControleDocumento } from "@/lib/documentos/calcular-status";

type Contexto = { params: Promise<{ lojaId: string }> };

type Linha = {
    documento_loja_id: string;
    instancia_id: string | null;
    colaborador_id: string | null;
    colaborador_nome: string | null;
    tipo_controle: string;
    alerta_dias: number;
    verificacao_id: string | null;
    resultado: string | null;
    data_prazo: string | null;
    data_verificacao: string | null;
};

export async function GET(_request: Request, context: Contexto) {
    try {
        const acesso = await requirePermission("documentos.visualizar");
        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO" ? unauthorizedResponse() : forbiddenResponse();
        }
        const { lojaId } = await context.params;
        const loja = await db.execute({
            sql: `SELECT id FROM lojas l WHERE id = ?
                  AND (? IN ('MASTER', 'SUPERVISORA') OR EXISTS (
                      SELECT 1 FROM usuario_lojas ul WHERE ul.loja_id = l.id AND ul.usuario_id = ?
                  )) LIMIT 1`,
            args: [lojaId, acesso.usuario.perfil, acesso.usuario.id],
        });
        if (!loja.rows.length) {
            return NextResponse.json({ success: false, message: "Loja não encontrada ou sem acesso." }, { status: 404 });
        }

        const resultado = await db.execute({
            sql: `WITH alvos AS (
                      SELECT dl.id AS documento_loja_id, NULL AS instancia_id,
                             NULL AS colaborador_id, NULL AS colaborador_nome,
                             dl.ciclo_atual AS ciclo_documento, NULL AS ciclo_instancia,
                             dc.tipo_controle,
                             COALESCE(dl.alerta_dias, dc.alerta_dias) AS alerta_dias
                      FROM documentos_lojas dl
                      JOIN documentos_catalogo dc ON dc.id = dl.documento_id
                      WHERE dl.loja_id = ? AND dl.ativo = 1 AND dc.ativo = 1
                        AND dc.modalidade = 'LOJA'
                      UNION ALL
                      SELECT dl.id, di.id, c.id, c.nome, dl.ciclo_atual, di.ciclo_atual,
                             dc.tipo_controle, COALESCE(dl.alerta_dias, dc.alerta_dias)
                      FROM documentos_lojas dl
                      JOIN documentos_catalogo dc ON dc.id = dl.documento_id
                      JOIN colaboradores c ON c.loja_id = dl.loja_id
                      LEFT JOIN documentos_instancias di
                        ON di.documento_loja_id = dl.id AND di.colaborador_id = c.id
                      WHERE dl.loja_id = ? AND c.loja_id = dl.loja_id
                        AND dl.ativo = 1 AND dc.ativo = 1
                        AND (di.id IS NULL OR di.ativo = 1)
                        AND c.ativo = 1 AND dc.modalidade = 'COLABORADOR'
                  ),
                  versoes AS (
                      SELECT v.*, ROW_NUMBER() OVER (
                          PARTITION BY COALESCE(v.verificacao_raiz_id, v.id)
                          ORDER BY v.versao DESC, v.id DESC
                      ) AS posicao_versao
                      FROM documentos_verificacoes v
                      JOIN documentos_lojas dl ON dl.id = v.documento_loja_id
                      WHERE dl.loja_id = ?
                  ),
                  atuais AS (
                      SELECT v.*, raiz.registrado_em AS registrado_original_em,
                             raiz.id AS id_original
                      FROM versoes v
                      JOIN documentos_verificacoes raiz
                        ON raiz.id = COALESCE(v.verificacao_raiz_id, v.id)
                      WHERE v.posicao_versao = 1
                  ),
                  classificados AS (
                      SELECT a.documento_loja_id, a.instancia_id, a.colaborador_id,
                             a.colaborador_nome, a.tipo_controle, a.alerta_dias,
                             v.id AS verificacao_id, v.resultado, v.data_prazo,
                             v.data_verificacao,
                             ROW_NUMBER() OVER (
                                 PARTITION BY a.documento_loja_id, a.colaborador_id, a.instancia_id
                                 ORDER BY v.data_verificacao DESC,
                                          v.registrado_original_em DESC, v.id_original DESC
                             ) AS posicao
                      FROM alvos a
                      LEFT JOIN atuais v ON v.documento_loja_id = a.documento_loja_id
                        AND ((a.instancia_id IS NULL AND v.instancia_id IS NULL)
                             OR a.instancia_id = v.instancia_id)
                        AND v.ciclo_documento = a.ciclo_documento
                        AND ((a.ciclo_instancia IS NULL AND v.ciclo_instancia IS NULL)
                             OR a.ciclo_instancia = v.ciclo_instancia)
                  )
                  SELECT documento_loja_id, instancia_id, colaborador_id, colaborador_nome,
                         tipo_controle, alerta_dias, verificacao_id, resultado,
                         data_prazo, data_verificacao
                  FROM classificados WHERE posicao = 1
                  ORDER BY documento_loja_id, colaborador_nome COLLATE NOCASE`,
            args: [lojaId, lojaId, lojaId],
        });
        const hoje = dataAtualFortaleza();
        const documentos = (resultado.rows as unknown as Linha[]).map((linha) => ({
            documento_loja_id: String(linha.documento_loja_id),
            instancia_id: linha.instancia_id === null ? null : String(linha.instancia_id),
            colaborador_id: linha.colaborador_id === null ? null : String(linha.colaborador_id),
            colaborador_nome: linha.colaborador_nome === null ? null : String(linha.colaborador_nome),
            verificacao_id: linha.verificacao_id === null ? null : String(linha.verificacao_id),
            data_verificacao: linha.data_verificacao === null ? null : String(linha.data_verificacao),
            ...calcularStatusDocumento({
                tipo_controle: linha.tipo_controle as TipoControleDocumento,
                alerta_dias: Number(linha.alerta_dias),
                verificacao: linha.verificacao_id === null ? null : {
                    resultado: linha.resultado as ResultadoVerificacaoDocumento,
                    data_prazo: linha.data_prazo === null ? null : String(linha.data_prazo),
                },
                hoje,
            }),
        }));
        return NextResponse.json({
            success: true, hoje, documentos,
            resumo: {
                total: documentos.length,
                verificados: documentos.filter((item) => item.verificacao_id !== null).length,
                exigem_atencao: documentos.filter((item) => item.exige_atencao).length,
            },
        });
    } catch (error) {
        console.error("Erro ao calcular status documentais:", error);
        return NextResponse.json({ success: false, message: "Não foi possível calcular os status." }, { status: 500 });
    }
}
