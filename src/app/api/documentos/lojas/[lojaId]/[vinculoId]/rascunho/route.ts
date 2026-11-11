import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/auth/auth-response";

type Contexto = { params: Promise<{ lojaId: string; vinculoId: string }> };

async function contextoDocumento(lojaId: string, vinculoId: string, usuario: { id: string; perfil: string }) {
    const resultado = await db.execute({
        sql: `SELECT dl.id, dl.ciclo_atual, dl.ativo, dc.modalidade, dc.ativo AS catalogo_ativo,
                     l.ativo AS loja_ativa
              FROM documentos_lojas dl
              JOIN documentos_catalogo dc ON dc.id = dl.documento_id
              JOIN lojas l ON l.id = dl.loja_id
              WHERE dl.id = ? AND dl.loja_id = ?
                AND (? = 'MASTER' OR EXISTS (
                    SELECT 1 FROM usuario_lojas ul WHERE ul.loja_id = dl.loja_id AND ul.usuario_id = ?
                )) LIMIT 1`,
        args: [vinculoId, lojaId, usuario.perfil, usuario.id],
    });
    return resultado.rows[0] ?? null;
}

export async function GET(_request: Request, context: Contexto) {
    try {
        const acesso = await requirePermission("documentos.verificar");
        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO" ? unauthorizedResponse() : forbiddenResponse();
        }
        const { lojaId, vinculoId } = await context.params;
        const documento = await contextoDocumento(lojaId, vinculoId, acesso.usuario);
        if (!documento) {
            return NextResponse.json({ success: false, message: "Documento não encontrado ou sem acesso." }, { status: 404 });
        }
        if (documento.modalidade !== "LOJA") {
            return NextResponse.json({ success: false, message: "Rascunhos individuais terão uma rota própria." }, { status: 400 });
        }

        const resultado = await db.execute({
            sql: `SELECT id, resultado, data_verificacao, data_prazo, observacao,
                         prazo_informado_manualmente, ultima_verificacao_vista_id,
                         status, motivo_bloqueio, criado_em, atualizado_em
                  FROM documentos_rascunhos
                  WHERE usuario_id = ? AND documento_loja_id = ?
                    AND instancia_id IS NULL AND ciclo_documento = ?
                    AND status = 'EM_EDICAO'
                  LIMIT 1`,
            args: [acesso.usuario.id, vinculoId, Number(documento.ciclo_atual)],
        });
        const ultima = await db.execute({
            sql: `SELECT v.id FROM documentos_verificacoes v
                  JOIN documentos_verificacoes raiz ON raiz.id = COALESCE(v.verificacao_raiz_id, v.id)
                  WHERE v.documento_loja_id = ? AND v.instancia_id IS NULL AND v.ciclo_documento = ?
                    AND NOT EXISTS (
                        SELECT 1 FROM documentos_verificacoes nova
                        WHERE nova.verificacao_raiz_id = raiz.id AND nova.versao > v.versao
                    )
                  ORDER BY v.data_verificacao DESC, raiz.registrado_em DESC, raiz.id DESC LIMIT 1`,
            args: [vinculoId, Number(documento.ciclo_atual)],
        });
        const ultimaId = ultima.rows.length ? String(ultima.rows[0].id) : null;
        const rascunho = resultado.rows[0] ?? null;
        return NextResponse.json({
            success: true,
            editavel: Number(documento.ativo) === 1 && Number(documento.catalogo_ativo) === 1 && Number(documento.loja_ativa) === 1,
            ciclo_documento: Number(documento.ciclo_atual),
            ultima_verificacao_id: ultimaId,
            precisa_revisar: rascunho !== null && rascunho.ultima_verificacao_vista_id !== ultimaId,
            rascunho,
        });
    } catch (error) {
        console.error("Erro ao consultar rascunho documental:", error);
        return NextResponse.json({ success: false, message: "Não foi possível consultar o rascunho." }, { status: 500 });
    }
}

export async function PUT(request: Request, context: Contexto) {
    try {
        const acesso = await requirePermission("documentos.verificar");
        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO" ? unauthorizedResponse() : forbiddenResponse();
        }
        const { lojaId, vinculoId } = await context.params;
        const documento = await contextoDocumento(lojaId, vinculoId, acesso.usuario);
        if (!documento) {
            return NextResponse.json({ success: false, message: "Documento não encontrado ou sem acesso." }, { status: 404 });
        }
        if (documento.modalidade !== "LOJA") {
            return NextResponse.json({ success: false, message: "Rascunhos individuais terão uma rota própria." }, { status: 400 });
        }
        if (Number(documento.ativo) !== 1 || Number(documento.catalogo_ativo) !== 1 || Number(documento.loja_ativa) !== 1) {
            return NextResponse.json({ success: false, message: "Documento inativo. Rascunho disponível apenas para leitura." }, { status: 409 });
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

        const dataValida = (valor: unknown): valor is string => {
            if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
            const data = new Date(valor + "T12:00:00Z");
            return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
        };
        const hoje = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date());
        if (!(resultado === null || resultado === "APRESENTADO" || resultado === "NAO_APRESENTADO") ||
            !(dataVerificacao === null || (dataValida(dataVerificacao) && dataVerificacao <= hoje)) ||
            !(dataPrazo === null || dataValida(dataPrazo)) ||
            typeof observacao !== "string" || observacao.length > 4000 ||
            (manual !== 0 && manual !== 1) ||
            !(vista === null || (typeof vista === "string" && vista.length > 0))) {
            return NextResponse.json({ success: false, message: "Campos do rascunho inválidos." }, { status: 400 });
        }
        const ciclo = Number(documento.ciclo_atual);
        const ultima = await db.execute({
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
        const ultimaId = ultima.rows.length ? String(ultima.rows[0].id) : null;
        if (vista !== ultimaId) {
            return NextResponse.json({
                success: false, message: "Outra verificação foi confirmada. Revise antes de salvar.",
                ultima_verificacao_id: ultimaId,
            }, { status: 409 });
        }

        const id = crypto.randomUUID();
        await db.execute({
            sql: `INSERT INTO documentos_rascunhos
                    (id, usuario_id, documento_loja_id, instancia_id, ciclo_documento, ciclo_instancia,
                     resultado, data_verificacao, data_prazo, observacao, prazo_informado_manualmente,
                     ultima_verificacao_vista_id, status)
                  VALUES (?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, 'EM_EDICAO')
                  ON CONFLICT(usuario_id, documento_loja_id, ciclo_documento)
                    WHERE instancia_id IS NULL AND status = 'EM_EDICAO'
                  DO UPDATE SET
                    resultado = excluded.resultado,
                    data_verificacao = excluded.data_verificacao,
                    data_prazo = excluded.data_prazo,
                    observacao = excluded.observacao,
                    prazo_informado_manualmente = excluded.prazo_informado_manualmente,
                    ultima_verificacao_vista_id = excluded.ultima_verificacao_vista_id,
                    atualizado_em = CURRENT_TIMESTAMP`,
            args: [id, acesso.usuario.id, vinculoId, ciclo,
                resultado as string | null, dataVerificacao as string | null, dataPrazo as string | null,
                observacao, manual as number, vista as string | null],
        });
        return NextResponse.json({ success: true, message: "Rascunho salvo.", ciclo_documento: ciclo });
    } catch (error) {
        console.error("Erro ao salvar rascunho documental:", error);
        return NextResponse.json({ success: false, message: "Não foi possível salvar o rascunho." }, { status: 500 });
    }
}
