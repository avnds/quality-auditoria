import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/auth/auth-response";

type Contexto = { params: Promise<{ lojaId: string; vinculoId: string; instanciaId: string }> };

function dataValida(valor: unknown): valor is string {
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const data = new Date(valor + "T12:00:00Z");
    return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function dataHojeFortaleza() {
    const partes = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? "";
    return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

export async function POST(request: Request, context: Contexto) {
    try {
        const acesso = await requirePermission("documentos.verificar");
        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO" ? unauthorizedResponse() : forbiddenResponse();
        }
        const { lojaId, vinculoId, instanciaId } = await context.params;
        const body: unknown = await request.json();
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return NextResponse.json({ success: false, message: "Dados inválidos." }, { status: 400 });
        }
        const dados = body as Record<string, unknown>;
        const resultado = dados.resultado;
        const dataVerificacao = dados.data_verificacao;
        const dataPrazo = dados.data_prazo === undefined ? null : dados.data_prazo;
        const observacao = typeof dados.observacao === "string" ? dados.observacao.trim() : "";
        const manual = dados.prazo_informado_manualmente === undefined ? 0 : dados.prazo_informado_manualmente;
        const vista = dados.ultima_verificacao_vista_id;

        if ((resultado !== "APRESENTADO" && resultado !== "NAO_APRESENTADO") ||
            !dataValida(dataVerificacao) || dataVerificacao > dataHojeFortaleza() ||
            !(dataPrazo === null || dataValida(dataPrazo)) ||
            typeof dados.observacao !== "string" || observacao.length > 4000 ||
            (manual !== 0 && manual !== 1) ||
            !("ultima_verificacao_vista_id" in dados) ||
            !(vista === null || (typeof vista === "string" && vista.length > 0))) {
            return NextResponse.json({ success: false, message: "Confira resultado, datas, observação e versão consultada." }, { status: 400 });
        }
        if ((resultado === "NAO_APRESENTADO" || dataPrazo === null) && !observacao) {
            return NextResponse.json({ success: false, message: "Observação obrigatória para documento não apresentado ou sem prazo." }, { status: 400 });
        }
        if (resultado === "NAO_APRESENTADO" && dataPrazo !== null) {
            return NextResponse.json({ success: false, message: "Documento não apresentado não pode ter prazo informado." }, { status: 400 });
        }
        if (manual === 1 && dataPrazo === null) {
            return NextResponse.json({ success: false, message: "Prazo manual exige uma data." }, { status: 400 });
        }

        const contextoResult = await db.execute({
            sql: `SELECT dl.ciclo_atual AS ciclo_documento, di.ciclo_atual AS ciclo_instancia,
                         COALESCE(dl.periodicidade_meses, dc.periodicidade_meses) AS periodicidade,
                         COALESCE(dl.alerta_dias, dc.alerta_dias) AS alerta,
                         dc.tipo_controle
                  FROM documentos_instancias di
                  JOIN documentos_lojas dl ON dl.id = di.documento_loja_id
                  JOIN documentos_catalogo dc ON dc.id = dl.documento_id
                  JOIN colaboradores c ON c.id = di.colaborador_id
                  JOIN lojas l ON l.id = dl.loja_id
                  WHERE di.id = ? AND dl.id = ? AND dl.loja_id = ?
                    AND c.loja_id = dl.loja_id
                    AND di.ativo = 1 AND c.ativo = 1 AND dl.ativo = 1
                    AND dc.ativo = 1 AND l.ativo = 1 AND dc.modalidade = 'COLABORADOR'
                    AND (? = 'MASTER' OR EXISTS (
                        SELECT 1 FROM usuario_lojas ul
                        WHERE ul.loja_id = dl.loja_id AND ul.usuario_id = ?
                    )) LIMIT 1`,
            args: [instanciaId, vinculoId, lojaId, acesso.usuario.perfil, acesso.usuario.id],
        });
        if (!contextoResult.rows.length) {
            return NextResponse.json({ success: false, message: "ASO ou colaborador inativo, inexistente ou sem acesso." }, { status: 404 });
        }
        const contextoAtual = contextoResult.rows[0];
        const cicloDocumento = Number(contextoAtual.ciclo_documento);
        const cicloInstancia = Number(contextoAtual.ciclo_instancia);

        const ultima = await db.execute({
            sql: `SELECT id FROM documentos_verificacoes
                  WHERE documento_loja_id = ? AND instancia_id = ?
                    AND ciclo_documento = ? AND ciclo_instancia = ?
                  ORDER BY data_verificacao DESC, registrado_em DESC, id DESC LIMIT 1`,
            args: [vinculoId, instanciaId, cicloDocumento, cicloInstancia],
        });
        const ultimaId = ultima.rows.length ? String(ultima.rows[0].id) : null;
        if (vista !== ultimaId) {
            return NextResponse.json({
                success: false, message: "Há uma verificação mais recente. Revise os dados antes de confirmar.",
                ultima_verificacao_id: ultimaId,
            }, { status: 409 });
        }

        const id = crypto.randomUUID();
        const insercao = await db.execute({
            sql: `INSERT INTO documentos_verificacoes
                    (id, documento_loja_id, instancia_id, ciclo_documento, ciclo_instancia,
                     versao, resultado, data_verificacao, data_prazo, observacao,
                     periodicidade_meses_snapshot, alerta_dias_snapshot, tipo_controle_snapshot,
                     prazo_informado_manualmente, registrado_por)
                  SELECT ?, dl.id, di.id, dl.ciclo_atual, di.ciclo_atual,
                         1, ?, ?, ?, ?, ?, ?, ?, ?, ?
                  FROM documentos_instancias di
                  JOIN documentos_lojas dl ON dl.id = di.documento_loja_id
                  JOIN documentos_catalogo dc ON dc.id = dl.documento_id
                  JOIN colaboradores c ON c.id = di.colaborador_id
                  JOIN lojas l ON l.id = dl.loja_id
                  WHERE di.id = ? AND dl.id = ? AND dl.loja_id = ?
                    AND di.ciclo_atual = ? AND dl.ciclo_atual = ?
                    AND c.loja_id = dl.loja_id
                    AND di.ativo = 1 AND c.ativo = 1 AND dl.ativo = 1
                    AND dc.ativo = 1 AND l.ativo = 1 AND dc.modalidade = 'COLABORADOR'
                    AND (? = 'MASTER' OR EXISTS (
                        SELECT 1 FROM usuario_lojas ul
                        WHERE ul.loja_id = dl.loja_id AND ul.usuario_id = ?
                    ))
                    AND (SELECT id FROM documentos_verificacoes
                         WHERE documento_loja_id = dl.id AND instancia_id = di.id
                           AND ciclo_documento = dl.ciclo_atual
                           AND ciclo_instancia = di.ciclo_atual
                         ORDER BY data_verificacao DESC, registrado_em DESC, id DESC LIMIT 1) IS ?`,
            args: [id, resultado as string, dataVerificacao, dataPrazo as string | null,
                observacao || null,
                contextoAtual.periodicidade === null ? null : Number(contextoAtual.periodicidade),
                Number(contextoAtual.alerta), String(contextoAtual.tipo_controle),
                manual as number, acesso.usuario.id,
                instanciaId, vinculoId, lojaId, cicloInstancia, cicloDocumento,
                acesso.usuario.perfil, acesso.usuario.id, ultimaId],
        });
        if (Number(insercao.rowsAffected) !== 1) {
            return NextResponse.json({
                success: false, message: "O ASO ou seu histórico mudou. Atualize antes de confirmar.",
            }, { status: 409 });
        }
        return NextResponse.json({
            success: true, verificacao_id: id,
            ciclo_documento: cicloDocumento, ciclo_instancia: cicloInstancia,
        }, { status: 201 });
    } catch (error) {
        console.error("Erro ao confirmar ASO individual:", error);
        return NextResponse.json({ success: false, message: "Não foi possível confirmar o ASO." }, { status: 500 });
    }
}
