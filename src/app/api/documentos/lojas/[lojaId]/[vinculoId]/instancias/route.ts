import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/auth/auth-response";

type Contexto = { params: Promise<{ lojaId: string; vinculoId: string }> };

export async function GET(_request: Request, context: Contexto) {
    try {
        const acesso = await requirePermission("documentos.visualizar");
        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO" ? unauthorizedResponse() : forbiddenResponse();
        }
        const { lojaId, vinculoId } = await context.params;
        const vinculo = await db.execute({
            sql: `SELECT dl.id, dl.ativo, dl.ciclo_atual, dc.modalidade
                  FROM documentos_lojas dl
                  JOIN documentos_catalogo dc ON dc.id = dl.documento_id
                  WHERE dl.id = ? AND dl.loja_id = ?
                    AND (? = 'MASTER' OR EXISTS (
                        SELECT 1 FROM usuario_lojas ul
                        WHERE ul.loja_id = dl.loja_id AND ul.usuario_id = ?
                    )) LIMIT 1`,
            args: [vinculoId, lojaId, acesso.usuario.perfil, acesso.usuario.id],
        });
        if (!vinculo.rows.length) {
            return NextResponse.json({ success: false, message: "Documento não encontrado ou sem acesso." }, { status: 404 });
        }
        if (vinculo.rows[0].modalidade !== "COLABORADOR") {
            return NextResponse.json({ success: false, message: "Este documento não é individual." }, { status: 400 });
        }

        const colaboradores = await db.execute({
            sql: `SELECT c.id AS colaborador_id, c.nome, c.cargo, c.ativo AS colaborador_ativo,
                         di.id AS instancia_id, di.ativo AS instancia_ativa,
                         di.ciclo_atual AS ciclo_instancia
                  FROM colaboradores c
                  LEFT JOIN documentos_instancias di
                    ON di.colaborador_id = c.id AND di.documento_loja_id = ?
                  WHERE c.loja_id = ?
                  ORDER BY c.ativo DESC, c.nome COLLATE NOCASE, c.id`,
            args: [vinculoId, lojaId],
        });
        return NextResponse.json({
            success: true,
            documento_ativo: Number(vinculo.rows[0].ativo) === 1,
            ciclo_documento: Number(vinculo.rows[0].ciclo_atual),
            colaboradores: colaboradores.rows,
        });
    } catch (error) {
        console.error("Erro ao listar instâncias documentais:", error);
        return NextResponse.json({ success: false, message: "Não foi possível listar colaboradores." }, { status: 500 });
    }
}

export async function POST(request: Request, context: Contexto) {
    try {
        const acesso = await requirePermission("documentos.gerenciar_instancias");
        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO" ? unauthorizedResponse() : forbiddenResponse();
        }
        if (acesso.usuario.perfil !== "MASTER" && acesso.usuario.perfil !== "SUPERVISORA") {
            return forbiddenResponse();
        }
        const { lojaId, vinculoId } = await context.params;
        const body: unknown = await request.json();
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return NextResponse.json({ success: false, message: "Dados inválidos." }, { status: 400 });
        }
        const dados = body as Record<string, unknown>;
        const colaboradorId = typeof dados.colaborador_id === "string" ? dados.colaborador_id.trim() : "";
        if (!colaboradorId) {
            return NextResponse.json({ success: false, message: "Informe o colaborador." }, { status: 400 });
        }

        const vinculo = await db.execute({
            sql: `SELECT dl.id FROM documentos_lojas dl
                  JOIN documentos_catalogo dc ON dc.id = dl.documento_id
                  JOIN lojas l ON l.id = dl.loja_id
                  WHERE dl.id = ? AND dl.loja_id = ? AND dl.ativo = 1
                    AND dc.ativo = 1 AND dc.modalidade = 'COLABORADOR' AND l.ativo = 1
                  LIMIT 1`,
            args: [vinculoId, lojaId],
        });
        if (!vinculo.rows.length) {
            return NextResponse.json({ success: false, message: "Documento individual não está ativo." }, { status: 409 });
        }
        const colaborador = await db.execute({
            sql: "SELECT id FROM colaboradores WHERE id = ? AND loja_id = ? AND ativo = 1 LIMIT 1",
            args: [colaboradorId, lojaId],
        });
        if (!colaborador.rows.length) {
            return NextResponse.json({ success: false, message: "Colaborador não encontrado ou inativo nesta loja." }, { status: 404 });
        }
        const existente = await db.execute({
            sql: "SELECT id FROM documentos_instancias WHERE documento_loja_id = ? AND colaborador_id = ? LIMIT 1",
            args: [vinculoId, colaboradorId],
        });
        if (existente.rows.length) {
            return NextResponse.json({
                success: false, message: "Instância já existe. A reativação preserva o histórico anterior.",
            }, { status: 409 });
        }

        const id = crypto.randomUUID();
        const novo = { id, documento_loja_id: vinculoId, colaborador_id: colaboradorId, ativo: 1, ciclo_atual: 1 };
        await db.batch([
            {
                sql: `INSERT INTO documentos_instancias
                    (id, documento_loja_id, colaborador_id, ativo, ciclo_atual, criado_por)
                    VALUES (?, ?, ?, 1, 1, ?)`,
                args: [id, vinculoId, colaboradorId, acesso.usuario.id],
            },
            {
                sql: `INSERT INTO documentos_alteracoes
                    (id, entidade_tipo, entidade_id, acao, dados_novos, usuario_id)
                    VALUES (?, 'INSTANCIA', ?, 'CRIAR', ?, ?)`,
                args: [crypto.randomUUID(), id, JSON.stringify(novo), acesso.usuario.id],
            },
        ], "write");
        return NextResponse.json({ success: true, instancia: novo }, { status: 201 });
    } catch (error) {
        console.error("Erro ao criar instância documental:", error);
        return NextResponse.json({ success: false, message: "Não foi possível criar a instância." }, { status: 500 });
    }
}
