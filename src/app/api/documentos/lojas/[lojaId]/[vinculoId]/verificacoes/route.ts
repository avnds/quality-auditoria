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


function dataValida(valor: unknown): valor is string {
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const data = new Date(valor + "T12:00:00Z");
    return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

export async function POST(request: Request, context: Contexto) {
    try {
        const acesso = await requirePermission("documentos.verificar");
        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO" ? unauthorizedResponse() : forbiddenResponse();
        }
        const { lojaId, vinculoId } = await context.params;
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

        const hoje = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date());
        if ((resultado !== "APRESENTADO" && resultado !== "NAO_APRESENTADO") ||
            !dataValida(dataVerificacao) || dataVerificacao > hoje ||
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

        const vinculoResult = await db.execute({
            sql: `SELECT dl.id, dl.ciclo_atual, dl.periodicidade_meses,
                         dl.alerta_dias, dc.periodicidade_meses AS periodicidade_padrao,
                         dc.alerta_dias AS alerta_padrao, dc.tipo_controle, dc.modalidade
                  FROM documentos_lojas dl
                  JOIN documentos_catalogo dc ON dc.id = dl.documento_id
                  JOIN lojas l ON l.id = dl.loja_id
                  WHERE dl.id = ? AND dl.loja_id = ?
                    AND dl.ativo = 1 AND dc.ativo = 1 AND l.ativo = 1
                    AND (? = 'MASTER' OR EXISTS (
                        SELECT 1 FROM usuario_lojas ul
                        WHERE ul.loja_id = dl.loja_id AND ul.usuario_id = ?
                    )) LIMIT 1`,
            args: [vinculoId, lojaId, acesso.usuario.perfil, acesso.usuario.id],
        });
        if (!vinculoResult.rows.length) {
            return NextResponse.json({ success: false, message: "Documento inativo, inexistente ou sem acesso." }, { status: 404 });
        }
        const vinculo = vinculoResult.rows[0];
        if (vinculo.modalidade !== "LOJA") {
            return NextResponse.json({ success: false, message: "Documentos individuais exigem confirmação por colaborador." }, { status: 400 });
        }
        const ciclo = Number(vinculo.ciclo_atual);
        const ultimaResult = await db.execute({
            sql: `SELECT v.id FROM documentos_verificacoes v
                  JOIN documentos_verificacoes raiz ON raiz.id = COALESCE(v.verificacao_raiz_id, v.id)
                  WHERE v.documento_loja_id = ? AND v.instancia_id IS NULL AND v.ciclo_documento = ?
                    AND NOT EXISTS (
                        SELECT 1 FROM documentos_verificacoes nova
                        WHERE nova.verificacao_raiz_id = raiz.id AND nova.versao > v.versao
                    )
                  ORDER BY v.data_verificacao DESC, raiz.registrado_em DESC, raiz.id DESC LIMIT 1`,
            args: [vinculoId, ciclo],
        });
        const ultimaId = ultimaResult.rows.length ? String(ultimaResult.rows[0].id) : null;
        if (vista !== ultimaId) {
            return NextResponse.json({
                success: false,
                message: "Há uma verificação mais recente. Revise os dados antes de confirmar.",
            }, { status: 409 });
        }

        const id = crypto.randomUUID();
        const periodicidade = vinculo.periodicidade_meses ?? vinculo.periodicidade_padrao;
        const alerta = vinculo.alerta_dias ?? vinculo.alerta_padrao;
        const insercao = await db.execute({
            sql: `INSERT INTO documentos_verificacoes
                (id, documento_loja_id, instancia_id, ciclo_documento, ciclo_instancia,
                 versao, resultado, data_verificacao, data_prazo, observacao,
                 periodicidade_meses_snapshot, alerta_dias_snapshot, tipo_controle_snapshot,
                 prazo_informado_manualmente, registrado_por)
                SELECT ?, dl.id, NULL, dl.ciclo_atual, NULL,
                       1, ?, ?, ?, ?, ?, ?, ?, ?, ?
                FROM documentos_lojas dl
                JOIN documentos_catalogo dc ON dc.id = dl.documento_id
                JOIN lojas l ON l.id = dl.loja_id
                WHERE dl.id = ? AND dl.loja_id = ? AND dl.ciclo_atual = ?
                  AND dl.ativo = 1 AND dc.ativo = 1 AND l.ativo = 1
                  AND dc.modalidade = 'LOJA'
                  AND (? = 'MASTER' OR EXISTS (
                      SELECT 1 FROM usuario_lojas ul WHERE ul.loja_id = dl.loja_id AND ul.usuario_id = ?
                  ))
                  AND (SELECT v.id FROM documentos_verificacoes v
                       JOIN documentos_verificacoes raiz ON raiz.id = COALESCE(v.verificacao_raiz_id, v.id)
                       WHERE v.documento_loja_id = dl.id AND v.instancia_id IS NULL
                         AND v.ciclo_documento = dl.ciclo_atual
                         AND NOT EXISTS (
                             SELECT 1 FROM documentos_verificacoes nova
                             WHERE nova.verificacao_raiz_id = raiz.id AND nova.versao > v.versao
                         )
                       ORDER BY v.data_verificacao DESC, raiz.registrado_em DESC, raiz.id DESC LIMIT 1) IS ?`,
            args: [id, resultado as string, dataVerificacao, dataPrazo as string | null,
                observacao || null, periodicidade === null ? null : Number(periodicidade),
                Number(alerta), String(vinculo.tipo_controle), manual as number, acesso.usuario.id,
                vinculoId, lojaId, ciclo, acesso.usuario.perfil, acesso.usuario.id, ultimaId],
        });
        if (Number(insercao.rowsAffected) !== 1) {
            return NextResponse.json({
                success: false, message: "O documento ou seu histórico mudou. Atualize antes de confirmar.",
            }, { status: 409 });
        }
        // O registro confirmado é a fonte de verdade; o rascunho do autor
        // deixa de ser editável, sem apagar o histórico de edição.
        await db.execute({
            sql: `UPDATE documentos_rascunhos
                  SET status = 'CONFIRMADO', verificacao_confirmada_id = ?,
                      atualizado_em = CURRENT_TIMESTAMP
                  WHERE usuario_id = ? AND documento_loja_id = ?
                    AND instancia_id IS NULL AND ciclo_documento = ?
                    AND status = 'EM_EDICAO'
                    AND ultima_verificacao_vista_id IS ?`,
            args: [id, acesso.usuario.id, vinculoId, ciclo, ultimaId],
        });
        return NextResponse.json({ success: true, verificacao_id: id, ciclo_documento: ciclo }, { status: 201 });
    } catch (error) {
        console.error("Erro ao confirmar verificação documental:", error);
        return NextResponse.json({ success: false, message: "Não foi possível confirmar a verificação." }, { status: 500 });
    }
}
