import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/auth/auth-response";

type Contexto = { params: Promise<{ id: string }> };

function dataValida(valor: unknown): valor is string {
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const data = new Date(valor + "T12:00:00Z");
    return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

export async function POST(request: Request, context: Contexto) {
    try {
        const acesso = await requirePermission("documentos.corrigir");
        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO" ? unauthorizedResponse() : forbiddenResponse();
        }
        if (acesso.usuario.perfil !== "MASTER" && acesso.usuario.perfil !== "SUPERVISORA") {
            return forbiddenResponse();
        }
        const { id } = await context.params;
        const body: unknown = await request.json();
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return NextResponse.json({ success: false, message: "Dados inválidos." }, { status: 400 });
        }
        const dados = body as Record<string, unknown>;
        const motivo = typeof dados.motivo_correcao === "string" ? dados.motivo_correcao.trim() : "";
        const resultado = dados.resultado;
        const dataPrazo = dados.data_prazo === undefined ? null : dados.data_prazo;
        const observacao = typeof dados.observacao === "string" ? dados.observacao.trim() : "";
        const manual = dados.prazo_informado_manualmente === undefined ? 0 : dados.prazo_informado_manualmente;
        if (!motivo || motivo.length > 2000 ||
            (resultado !== "APRESENTADO" && resultado !== "NAO_APRESENTADO") ||
            !(dataPrazo === null || dataValida(dataPrazo)) ||
            typeof dados.observacao !== "string" || observacao.length > 4000 ||
            (manual !== 0 && manual !== 1)) {
            return NextResponse.json({ success: false, message: "Resultado, prazo, observação ou motivo inválidos." }, { status: 400 });
        }
        if ((resultado === "NAO_APRESENTADO" || dataPrazo === null) && !observacao) {
            return NextResponse.json({ success: false, message: "Informe observação para documento não apresentado ou sem prazo." }, { status: 400 });
        }
        if (resultado === "NAO_APRESENTADO" && dataPrazo !== null) {
            return NextResponse.json({ success: false, message: "Documento não apresentado não pode ter prazo." }, { status: 400 });
        }
        if (manual === 1 && dataPrazo === null) {
            return NextResponse.json({ success: false, message: "Prazo manual exige uma data." }, { status: 400 });
        }

        const consulta = await db.execute({
            sql: `SELECT v.*, dl.loja_id, dl.ciclo_atual AS ciclo_documento_atual,
                         dl.ativo AS documento_ativo, dc.ativo AS catalogo_ativo,
                         l.ativo AS loja_ativa, dc.modalidade,
                         di.ativo AS instancia_ativa, di.ciclo_atual AS ciclo_instancia_atual,
                         c.ativo AS colaborador_ativo, c.loja_id AS loja_colaborador
                  FROM documentos_verificacoes v
                  JOIN documentos_lojas dl ON dl.id = v.documento_loja_id
                  JOIN documentos_catalogo dc ON dc.id = dl.documento_id
                  JOIN lojas l ON l.id = dl.loja_id
                  LEFT JOIN documentos_instancias di ON di.id = v.instancia_id
                  LEFT JOIN colaboradores c ON c.id = di.colaborador_id
                  WHERE v.id = ?
                    AND (? IN ('MASTER', 'SUPERVISORA') OR EXISTS (
                        SELECT 1 FROM usuario_lojas ul
                        WHERE ul.loja_id = dl.loja_id AND ul.usuario_id = ?
                    )) LIMIT 1`,
            args: [id, acesso.usuario.perfil, acesso.usuario.id],
        });
        if (!consulta.rows.length) {
            return NextResponse.json({ success: false, message: "Verificação não encontrada ou sem acesso." }, { status: 404 });
        }
        const anterior = consulta.rows[0];
        const raiz = anterior.verificacao_raiz_id === null ? id : String(anterior.verificacao_raiz_id);
        const ultima = await db.execute({
            sql: `SELECT id, versao FROM documentos_verificacoes
                  WHERE id = ? OR verificacao_raiz_id = ?
                  ORDER BY versao DESC LIMIT 1`,
            args: [raiz, raiz],
        });
        if (!ultima.rows.length || String(ultima.rows[0].id) !== id) {
            return NextResponse.json({
                success: false, message: "Esta versão já foi corrigida. Abra a versão mais recente.",
            }, { status: 409 });
        }
        if (Number(anterior.documento_ativo) !== 1 ||
            Number(anterior.catalogo_ativo) !== 1 || Number(anterior.loja_ativa) !== 1 ||
            Number(anterior.ciclo_documento) !== Number(anterior.ciclo_documento_atual) ||
            (anterior.instancia_id !== null &&
                (Number(anterior.instancia_ativa) !== 1 ||
                 Number(anterior.colaborador_ativo) !== 1 ||
                 anterior.loja_colaborador !== anterior.loja_id ||
                 Number(anterior.ciclo_instancia) !== Number(anterior.ciclo_instancia_atual)))) {
            return NextResponse.json({
                success: false, message: "Verificação de ciclo encerrado ou documento inativo não pode ser corrigida.",
            }, { status: 409 });
        }
        const novaVersao = Number(anterior.versao) + 1;
        const novoId = crypto.randomUUID();
        const insercao = await db.execute({
            sql: `INSERT INTO documentos_verificacoes
                    (id, documento_loja_id, instancia_id, ciclo_documento, ciclo_instancia,
                     verificacao_raiz_id, versao_anterior_id, versao,
                     resultado, data_verificacao, data_prazo, observacao,
                     periodicidade_meses_snapshot, alerta_dias_snapshot, tipo_controle_snapshot,
                     prazo_informado_manualmente, motivo_correcao, registrado_por)
                  SELECT ?, v.documento_loja_id, v.instancia_id, v.ciclo_documento, v.ciclo_instancia,
                         ?, v.id, ?, ?, v.data_verificacao, ?, ?,
                         v.periodicidade_meses_snapshot, v.alerta_dias_snapshot, v.tipo_controle_snapshot,
                         ?, ?, ?
                  FROM documentos_verificacoes v
                  JOIN documentos_lojas dl ON dl.id = v.documento_loja_id
                  JOIN documentos_catalogo dc ON dc.id = dl.documento_id
                  JOIN lojas l ON l.id = dl.loja_id
                  LEFT JOIN documentos_instancias di ON di.id = v.instancia_id
                  LEFT JOIN colaboradores c ON c.id = di.colaborador_id
                  WHERE v.id = ? AND (v.id = ? OR v.verificacao_raiz_id = ?)
                    AND v.versao = ?
                    AND dl.ativo = 1 AND dc.ativo = 1 AND l.ativo = 1
                    AND dl.ciclo_atual = v.ciclo_documento
                    AND (v.instancia_id IS NULL OR (
                        di.ativo = 1 AND c.ativo = 1 AND c.loja_id = dl.loja_id
                        AND di.ciclo_atual = v.ciclo_instancia
                    ))
                    AND (? IN ('MASTER', 'SUPERVISORA') OR EXISTS (
                        SELECT 1 FROM usuario_lojas ul
                        WHERE ul.loja_id = dl.loja_id AND ul.usuario_id = ?
                    ))
                    AND NOT EXISTS (
                        SELECT 1 FROM documentos_verificacoes outra
                        WHERE outra.verificacao_raiz_id = ? AND outra.versao > v.versao
                    )`,
            args: [novoId, raiz, novaVersao, resultado as string,
                dataPrazo as string | null, observacao || null, manual as number,
                motivo, acesso.usuario.id, id, raiz, raiz, Number(anterior.versao),
                acesso.usuario.perfil, acesso.usuario.id, raiz],
        });
        if (Number(insercao.rowsAffected) !== 1) {
            return NextResponse.json({
                success: false, message: "A verificação mudou. Atualize antes de corrigir.",
            }, { status: 409 });
        }
        return NextResponse.json({
            success: true, verificacao_id: novoId, verificacao_raiz_id: raiz,
            versao: novaVersao, versao_anterior_id: id,
        }, { status: 201 });
    } catch (error) {
        console.error("Erro ao corrigir verificação documental:", error);
        return NextResponse.json({ success: false, message: "Não foi possível corrigir a verificação." }, { status: 500 });
    }
}
