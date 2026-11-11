import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/auth/auth-response";

type Contexto = { params: Promise<{ lojaId: string; vinculoId: string }> };

export async function GET(request: Request, context: Contexto) {
    try {
        const acesso = await requirePermission("documentos.visualizar");
        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO" ? unauthorizedResponse() : forbiddenResponse();
        }
        const { lojaId, vinculoId } = await context.params;
        const instanciaId = new URL(request.url).searchParams.get("instancia_id");
        const usuario = acesso.usuario;

        const vinculo = await db.execute({
            sql: `SELECT dl.id, dl.ciclo_atual, dc.modalidade
                  FROM documentos_lojas dl
                  JOIN documentos_catalogo dc ON dc.id = dl.documento_id
                  WHERE dl.id = ? AND dl.loja_id = ?
                  AND EXISTS (SELECT 1 FROM lojas l WHERE l.id = dl.loja_id)
                  AND (? = 'MASTER' OR EXISTS (
                      SELECT 1 FROM usuario_lojas ul WHERE ul.loja_id = dl.loja_id AND ul.usuario_id = ?
                  )) LIMIT 1`,
            args: [vinculoId, lojaId, usuario.perfil, usuario.id],
        });
        if (!vinculo.rows.length) {
            return NextResponse.json({ success: false, message: "Documento não encontrado ou sem acesso." }, { status: 404 });
        }
        const modalidade = String(vinculo.rows[0].modalidade);
        if ((modalidade === "COLABORADOR" && !instanciaId) || (modalidade === "LOJA" && instanciaId)) {
            return NextResponse.json({ success: false, message: "Informe um alvo compatível com a modalidade documental." }, { status: 400 });
        }
        if (instanciaId) {
            const instancia = await db.execute({
                sql: "SELECT id FROM documentos_instancias WHERE id = ? AND documento_loja_id = ? LIMIT 1",
                args: [instanciaId, vinculoId],
            });
            if (!instancia.rows.length) {
                return NextResponse.json({ success: false, message: "Instância não encontrada." }, { status: 404 });
            }
        }

        const resultado = await db.execute({
            sql: `SELECT v.id, v.documento_loja_id, v.instancia_id, v.ciclo_documento,
                         v.ciclo_instancia, v.verificacao_raiz_id, v.versao_anterior_id,
                         v.versao, v.resultado, v.data_verificacao, v.data_prazo,
                         v.observacao, v.periodicidade_meses_snapshot,
                         v.alerta_dias_snapshot, v.tipo_controle_snapshot,
                         v.prazo_informado_manualmente, v.motivo_correcao,
                         v.registrado_por, v.registrado_em
                  FROM documentos_verificacoes v
                  WHERE v.documento_loja_id = ?
                    AND ((? IS NULL AND v.instancia_id IS NULL) OR v.instancia_id = ?)
                  ORDER BY v.data_verificacao DESC, v.registrado_em DESC, v.id DESC, v.versao DESC`,
            args: [vinculoId, instanciaId, instanciaId],
        });
        return NextResponse.json({
            success: true,
            ciclo_atual: Number(vinculo.rows[0].ciclo_atual),
            verificacoes: resultado.rows,
        });
    } catch (error) {
        console.error("Erro ao consultar verificações documentais:", error);
        return NextResponse.json({ success: false, message: "Não foi possível consultar as verificações." }, { status: 500 });
    }
}
