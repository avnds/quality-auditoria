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

function hojeFortaleza() {
    const partes = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
    return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

async function buscarContexto(
    lojaId: string, vinculoId: string, instanciaId: string,
    usuario: { id: string; perfil: string }
) {
    const resposta = await db.execute({
        sql: `SELECT dl.ciclo_atual AS ciclo_documento, di.ciclo_atual AS ciclo_instancia,
                     dl.ativo AS documento_ativo, di.ativo AS instancia_ativa,
                     dc.ativo AS catalogo_ativo, l.ativo AS loja_ativa,
                     c.ativo AS colaborador_ativo
              FROM documentos_instancias di
              JOIN documentos_lojas dl ON dl.id = di.documento_loja_id
              JOIN documentos_catalogo dc ON dc.id = dl.documento_id
              JOIN colaboradores c ON c.id = di.colaborador_id
              JOIN lojas l ON l.id = dl.loja_id
              WHERE di.id = ? AND dl.id = ? AND dl.loja_id = ?
                AND c.loja_id = dl.loja_id AND dc.modalidade = 'COLABORADOR'
                AND (? = 'MASTER' OR EXISTS (
                    SELECT 1 FROM usuario_lojas ul
                    WHERE ul.loja_id = dl.loja_id AND ul.usuario_id = ?
                )) LIMIT 1`,
        args: [instanciaId, vinculoId, lojaId, usuario.perfil, usuario.id],
    });
    return resposta.rows[0] ?? null;
}

async function ultimaVerificacao(vinculoId: string, instanciaId: string, cicloDocumento: number, cicloInstancia: number) {
    const resultado = await db.execute({
        sql: `SELECT id FROM documentos_verificacoes
              WHERE documento_loja_id = ? AND instancia_id = ?
                AND ciclo_documento = ? AND ciclo_instancia = ?
              ORDER BY data_verificacao DESC, registrado_em DESC, id DESC LIMIT 1`,
        args: [vinculoId, instanciaId, cicloDocumento, cicloInstancia],
    });
    return resultado.rows.length ? String(resultado.rows[0].id) : null;
}

export async function GET(_request: Request, context: Contexto) {
    try {
        const acesso = await requirePermission("documentos.verificar");
        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO" ? unauthorizedResponse() : forbiddenResponse();
        }
        const { lojaId, vinculoId, instanciaId } = await context.params;
        const alvo = await buscarContexto(lojaId, vinculoId, instanciaId, acesso.usuario);
        if (!alvo) {
            return NextResponse.json({ success: false, message: "ASO não encontrado ou sem acesso." }, { status: 404 });
        }
        const cicloDocumento = Number(alvo.ciclo_documento);
        const cicloInstancia = Number(alvo.ciclo_instancia);
        const resultado = await db.execute({
            sql: `SELECT id, resultado, data_verificacao, data_prazo, observacao,
                         prazo_informado_manualmente, ultima_verificacao_vista_id,
                         status, motivo_bloqueio, criado_em, atualizado_em
                  FROM documentos_rascunhos
                  WHERE usuario_id = ? AND documento_loja_id = ? AND instancia_id = ?
                    AND ciclo_documento = ? AND ciclo_instancia = ?
                    AND status = 'EM_EDICAO' LIMIT 1`,
            args: [acesso.usuario.id, vinculoId, instanciaId, cicloDocumento, cicloInstancia],
        });
        const ultimaId = await ultimaVerificacao(vinculoId, instanciaId, cicloDocumento, cicloInstancia);
        const rascunho = resultado.rows[0] ?? null;
        return NextResponse.json({
            success: true,
            editavel: Number(alvo.documento_ativo) === 1 && Number(alvo.instancia_ativa) === 1 &&
                Number(alvo.catalogo_ativo) === 1 && Number(alvo.loja_ativa) === 1 &&
                Number(alvo.colaborador_ativo) === 1,
            ciclo_documento: cicloDocumento, ciclo_instancia: cicloInstancia,
            ultima_verificacao_id: ultimaId,
            precisa_revisar: rascunho !== null && rascunho.ultima_verificacao_vista_id !== ultimaId,
            rascunho,
        });
    } catch (error) {
        console.error("Erro ao consultar rascunho individual:", error);
        return NextResponse.json({ success: false, message: "Não foi possível consultar o rascunho." }, { status: 500 });
    }
}

export async function PUT(request: Request, context: Contexto) {
    try {
        const acesso = await requirePermission("documentos.verificar");
        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO" ? unauthorizedResponse() : forbiddenResponse();
        }
        const { lojaId, vinculoId, instanciaId } = await context.params;
        const alvo = await buscarContexto(lojaId, vinculoId, instanciaId, acesso.usuario);
        if (!alvo) {
            return NextResponse.json({ success: false, message: "ASO não encontrado ou sem acesso." }, { status: 404 });
        }
        if ([alvo.documento_ativo, alvo.instancia_ativa, alvo.catalogo_ativo,
            alvo.loja_ativa, alvo.colaborador_ativo].some((valor) => Number(valor) !== 1)) {
            return NextResponse.json({ success: false, message: "ASO inativo. Rascunho disponível apenas para leitura." }, { status: 409 });
        }
        const body: unknown = await request.json();
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return NextResponse.json({ success: false, message: "Dados inválidos." }, { status: 400 });
        }
        const dados = body as Record<string, unknown>;
        const resultado = dados.resultado;
        const dataVerificacao = dados.data_verificacao;
        const dataPrazo = dados.data_prazo;
        const observacao = dados.observacao;
        const manual = dados.prazo_informado_manualmente;
        const vista = dados.ultima_verificacao_vista_id;
        if (!(resultado === null || resultado === "APRESENTADO" || resultado === "NAO_APRESENTADO") ||
            !(dataVerificacao === null || (dataValida(dataVerificacao) && dataVerificacao <= hojeFortaleza())) ||
            !(dataPrazo === null || dataValida(dataPrazo)) ||
            typeof observacao !== "string" || observacao.length > 4000 ||
            (manual !== 0 && manual !== 1) ||
            !("ultima_verificacao_vista_id" in dados) ||
            !(vista === null || (typeof vista === "string" && vista.length > 0))) {
            return NextResponse.json({ success: false, message: "Campos do rascunho inválidos." }, { status: 400 });
        }
        const cicloDocumento = Number(alvo.ciclo_documento);
        const cicloInstancia = Number(alvo.ciclo_instancia);
        const ultimaId = await ultimaVerificacao(vinculoId, instanciaId, cicloDocumento, cicloInstancia);
        if (vista !== ultimaId) {
            return NextResponse.json({
                success: false, message: "Outra verificação foi confirmada. Revise antes de salvar.",
                ultima_verificacao_id: ultimaId,
            }, { status: 409 });
        }

        const id = crypto.randomUUID();
        const gravacao = await db.execute({
            sql: `INSERT INTO documentos_rascunhos
                    (id, usuario_id, documento_loja_id, instancia_id, ciclo_documento, ciclo_instancia,
                     resultado, data_verificacao, data_prazo, observacao,
                     prazo_informado_manualmente, ultima_verificacao_vista_id, status)
                  SELECT ?, ?, dl.id, di.id, dl.ciclo_atual, di.ciclo_atual,
                         ?, ?, ?, ?, ?, ?, 'EM_EDICAO'
                  FROM documentos_instancias di
                  JOIN documentos_lojas dl ON dl.id = di.documento_loja_id
                  JOIN documentos_catalogo dc ON dc.id = dl.documento_id
                  JOIN colaboradores c ON c.id = di.colaborador_id
                  JOIN lojas l ON l.id = dl.loja_id
                  WHERE di.id = ? AND dl.id = ? AND dl.loja_id = ?
                    AND di.ciclo_atual = ? AND dl.ciclo_atual = ?
                    AND c.loja_id = dl.loja_id
                    AND di.ativo = 1 AND dl.ativo = 1 AND dc.ativo = 1
                    AND c.ativo = 1 AND l.ativo = 1 AND dc.modalidade = 'COLABORADOR'
                    AND (? = 'MASTER' OR EXISTS (
                        SELECT 1 FROM usuario_lojas ul
                        WHERE ul.loja_id = dl.loja_id AND ul.usuario_id = ?
                    ))
                    AND (SELECT id FROM documentos_verificacoes
                         WHERE documento_loja_id = dl.id AND instancia_id = di.id
                           AND ciclo_documento = dl.ciclo_atual
                           AND ciclo_instancia = di.ciclo_atual
                         ORDER BY data_verificacao DESC, registrado_em DESC, id DESC LIMIT 1) IS ?
                  ON CONFLICT(usuario_id, instancia_id, ciclo_documento, ciclo_instancia)
                    WHERE instancia_id IS NOT NULL AND status = 'EM_EDICAO'
                  DO UPDATE SET
                    resultado = excluded.resultado,
                    data_verificacao = excluded.data_verificacao,
                    data_prazo = excluded.data_prazo,
                    observacao = excluded.observacao,
                    prazo_informado_manualmente = excluded.prazo_informado_manualmente,
                    ultima_verificacao_vista_id = excluded.ultima_verificacao_vista_id,
                    atualizado_em = CURRENT_TIMESTAMP`,
            args: [id, acesso.usuario.id, resultado as string | null,
                dataVerificacao as string | null, dataPrazo as string | null,
                observacao, manual as number, vista as string | null,
                instanciaId, vinculoId, lojaId, cicloInstancia, cicloDocumento,
                acesso.usuario.perfil, acesso.usuario.id, ultimaId],
        });
        if (Number(gravacao.rowsAffected) !== 1) {
            return NextResponse.json({
                success: false, message: "O ASO ou seu histórico mudou. Atualize antes de salvar.",
            }, { status: 409 });
        }
        return NextResponse.json({
            success: true, message: "Rascunho individual salvo.",
            ciclo_documento: cicloDocumento, ciclo_instancia: cicloInstancia,
        });
    } catch (error) {
        console.error("Erro ao salvar rascunho individual:", error);
        return NextResponse.json({ success: false, message: "Não foi possível salvar o rascunho." }, { status: 500 });
    }
}
