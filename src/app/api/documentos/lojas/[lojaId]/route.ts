import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/auth/auth-response";

type Contexto = { params: Promise<{ lojaId: string }> };

export async function GET(_request: Request, context: Contexto) {
    try {
        const acesso = await requirePermission("documentos.visualizar");
        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO" ? unauthorizedResponse() : forbiddenResponse();
        }

        const { lojaId } = await context.params;
        const usuario = acesso.usuario;
        const loja = await db.execute({
            sql: usuario.perfil === "MASTER"
                ? "SELECT id FROM lojas WHERE id = ? LIMIT 1"
                : "SELECT l.id FROM lojas l JOIN usuario_lojas ul ON ul.loja_id = l.id WHERE l.id = ? AND ul.usuario_id = ? LIMIT 1",
            args: usuario.perfil === "MASTER" ? [lojaId] : [lojaId, usuario.id],
        });
        if (!loja.rows.length) {
            return NextResponse.json({ success: false, message: "Loja não encontrada ou sem acesso." }, { status: 404 });
        }

        const resultado = await db.execute({
            sql: `
                SELECT dl.id, dl.loja_id, dl.documento_id, dl.periodicidade_meses,
                       dl.alerta_dias, dl.ativo, dl.ciclo_atual, dl.criado_em, dl.atualizado_em,
                       dc.nome, dc.descricao, dc.tipo_controle, dc.modalidade,
                       dc.periodicidade_meses AS periodicidade_padrao,
                       dc.alerta_dias AS alerta_padrao, dc.ativo AS catalogo_ativo
                FROM documentos_lojas dl
                JOIN documentos_catalogo dc ON dc.id = dl.documento_id
                WHERE dl.loja_id = ?
                ORDER BY dc.nome COLLATE NOCASE
            `,
            args: [lojaId],
        });
        return NextResponse.json({ success: true, documentos: resultado.rows });
    } catch (error) {
        console.error("Erro ao listar documentos da loja:", error);
        return NextResponse.json({ success: false, message: "Não foi possível consultar documentos da loja." }, { status: 500 });
    }
}

export async function POST(request: Request, context: Contexto) {
    try {
        const acesso = await requirePermission("documentos.gerenciar_lojas");
        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO" ? unauthorizedResponse() : forbiddenResponse();
        }
        if (acesso.usuario.perfil !== "MASTER" && acesso.usuario.perfil !== "SUPERVISORA") {
            return forbiddenResponse();
        }

        const { lojaId } = await context.params;
        const body: unknown = await request.json();
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return NextResponse.json({ success: false, message: "Dados inválidos." }, { status: 400 });
        }
        const dados = body as Record<string, unknown>;
        const documentoId = typeof dados.documento_id === "string" ? dados.documento_id.trim() : "";
        const periodicidade = dados.periodicidade_meses === undefined ? null : dados.periodicidade_meses;
        const alerta = dados.alerta_dias === undefined ? null : dados.alerta_dias;
        if (!documentoId ||
            !(periodicidade === null || (typeof periodicidade === "number" && Number.isInteger(periodicidade) && periodicidade > 0 && periodicidade <= 1200)) ||
            !(alerta === null || (typeof alerta === "number" && Number.isInteger(alerta) && alerta >= 0 && alerta <= 3650))) {
            return NextResponse.json({ success: false, message: "Documento, periodicidade ou alerta inválido." }, { status: 400 });
        }

        const loja = await db.execute({
            sql: `SELECT l.id FROM lojas l
                  WHERE l.id = ? AND l.ativo = 1
                    AND (? = 'MASTER' OR EXISTS (
                        SELECT 1 FROM usuario_lojas ul
                        WHERE ul.loja_id = l.id AND ul.usuario_id = ?
                    ))
                  LIMIT 1`,
            args: [lojaId, acesso.usuario.perfil, acesso.usuario.id],
        });
        if (!loja.rows.length) {
            return NextResponse.json({ success: false, message: "Loja inexistente ou inativa." }, { status: 404 });
        }
        const documento = await db.execute({
            sql: "SELECT id FROM documentos_catalogo WHERE id = ? AND ativo = 1 LIMIT 1",
            args: [documentoId],
        });
        if (!documento.rows.length) {
            return NextResponse.json({ success: false, message: "Tipo documental inexistente ou inativo." }, { status: 404 });
        }
        const existente = await db.execute({
            sql: "SELECT id FROM documentos_lojas WHERE loja_id = ? AND documento_id = ? LIMIT 1",
            args: [lojaId, documentoId],
        });
        if (existente.rows.length) {
            return NextResponse.json({ success: false, message: "Documento já vinculado. Utilize a edição para alterar ou reativar." }, { status: 409 });
        }

        const id = crypto.randomUUID();
        const novo = { id, loja_id: lojaId, documento_id: documentoId,
            periodicidade_meses: periodicidade, alerta_dias: alerta, ativo: 1, ciclo_atual: 1 };
        await db.batch([
            {
                sql: `INSERT INTO documentos_lojas
                    (id, loja_id, documento_id, periodicidade_meses, alerta_dias, ativo, ciclo_atual, criado_por)
                    VALUES (?, ?, ?, ?, ?, 1, 1, ?)`,
                args: [id, lojaId, documentoId, periodicidade as number | null, alerta as number | null, acesso.usuario.id],
            },
            {
                sql: `INSERT INTO documentos_alteracoes
                    (id, entidade_tipo, entidade_id, acao, dados_novos, usuario_id)
                    VALUES (?, 'DOCUMENTO_LOJA', ?, 'VINCULAR', ?, ?)`,
                args: [crypto.randomUUID(), id, JSON.stringify(novo), acesso.usuario.id],
            },
        ], "write");

        return NextResponse.json({ success: true, documento: novo }, { status: 201 });
    } catch (error) {
        console.error("Erro ao vincular documento à loja:", error);
        return NextResponse.json({ success: false, message: "Não foi possível vincular documento à loja." }, { status: 500 });
    }
}
