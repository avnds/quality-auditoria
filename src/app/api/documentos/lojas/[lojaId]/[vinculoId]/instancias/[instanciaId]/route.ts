import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/auth/auth-response";

type Contexto = { params: Promise<{ lojaId: string; vinculoId: string; instanciaId: string }> };

export async function PATCH(request: Request, context: Contexto) {
    try {
        const acesso = await requirePermission("documentos.gerenciar_instancias");
        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO" ? unauthorizedResponse() : forbiddenResponse();
        }
        if (acesso.usuario.perfil !== "MASTER" && acesso.usuario.perfil !== "SUPERVISORA") {
            return forbiddenResponse();
        }
        const { lojaId, vinculoId, instanciaId } = await context.params;
        const corpo: unknown = await request.json();
        if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
            return NextResponse.json({ success: false, message: "Dados inválidos." }, { status: 400 });
        }
        const dados = corpo as Record<string, unknown>;
        const ativo = dados.ativo === true || dados.ativo === 1 ? 1 :
            dados.ativo === false || dados.ativo === 0 ? 0 : null;
        const justificativa = typeof dados.justificativa === "string" ? dados.justificativa.trim() : "";
        if (ativo === null || (ativo === 0 && !justificativa) || justificativa.length > 2000) {
            return NextResponse.json({
                success: false, message: "Informe um status válido e justificativa para inativar (até 2000 caracteres).",
            }, { status: 400 });
        }

        const atualResult = await db.execute({
            sql: `SELECT di.id, di.ativo, di.ciclo_atual, di.colaborador_id,
                         dl.ativo AS documento_ativo, dc.ativo AS catalogo_ativo,
                         c.ativo AS colaborador_ativo, l.ativo AS loja_ativa
                  FROM documentos_instancias di
                  JOIN documentos_lojas dl ON dl.id = di.documento_loja_id
                  JOIN documentos_catalogo dc ON dc.id = dl.documento_id
                  JOIN colaboradores c ON c.id = di.colaborador_id
                  JOIN lojas l ON l.id = dl.loja_id
                  WHERE di.id = ? AND dl.id = ? AND dl.loja_id = ?
                    AND c.loja_id = dl.loja_id AND dc.modalidade = 'COLABORADOR'
                    AND (? IN ('MASTER', 'SUPERVISORA') OR EXISTS (
                        SELECT 1 FROM usuario_lojas ul
                        WHERE ul.loja_id = dl.loja_id AND ul.usuario_id = ?
                    )) LIMIT 1`,
            args: [instanciaId, vinculoId, lojaId, acesso.usuario.perfil, acesso.usuario.id],
        });
        if (!atualResult.rows.length) {
            return NextResponse.json({ success: false, message: "Instância não encontrada ou sem acesso." }, { status: 404 });
        }
        const anterior = atualResult.rows[0];
        if (Number(anterior.ativo) === ativo) {
            return NextResponse.json({ success: false, message: "A instância já está no status solicitado." }, { status: 409 });
        }
        if (ativo === 1 && [anterior.documento_ativo, anterior.catalogo_ativo,
            anterior.colaborador_ativo, anterior.loja_ativa].some((valor) => Number(valor) !== 1)) {
            return NextResponse.json({
                success: false, message: "Ative primeiro a loja, o colaborador e o documento correspondente.",
            }, { status: 409 });
        }

        const cicloAnterior = Number(anterior.ciclo_atual);
        // A reativação individual preserva o ciclo e as verificações anteriores.
        // Diferentemente do vínculo de loja, o ASO não reinicia seu histórico.
        const alteracao = await db.execute({
            sql: `UPDATE documentos_instancias
                  SET ativo = ?, atualizado_em = CURRENT_TIMESTAMP
                  WHERE id = ? AND ativo = ? AND ciclo_atual = ?
                    AND EXISTS (
                        SELECT 1 FROM documentos_lojas dl
                        JOIN documentos_catalogo dc ON dc.id = dl.documento_id
                        JOIN colaboradores c ON c.id = ?
                        JOIN lojas l ON l.id = dl.loja_id
                        WHERE dl.id = documentos_instancias.documento_loja_id
                          AND dl.id = ? AND dl.loja_id = ?
                          AND c.loja_id = dl.loja_id AND dc.modalidade = 'COLABORADOR'
                          AND (? = 0 OR (dl.ativo = 1 AND dc.ativo = 1 AND c.ativo = 1 AND l.ativo = 1))
                    )`,
            args: [ativo, instanciaId, 1 - ativo, cicloAnterior, String(anterior.colaborador_id),
                vinculoId, lojaId, ativo],
        });
        if (Number(alteracao.rowsAffected) !== 1) {
            return NextResponse.json({ success: false, message: "A instância mudou. Atualize e tente novamente." }, { status: 409 });
        }

        await db.execute({
            sql: `INSERT INTO documentos_alteracoes
                    (id, entidade_tipo, entidade_id, acao, dados_anteriores, dados_novos, justificativa, usuario_id)
                  VALUES (?, 'INSTANCIA', ?, ?, ?, ?, ?, ?)`,
            args: [crypto.randomUUID(), instanciaId, ativo === 1 ? "REATIVAR" : "INATIVAR",
                JSON.stringify({ ativo: 1 - ativo, ciclo_atual: cicloAnterior }),
                JSON.stringify({ ativo, ciclo_atual: cicloAnterior }),
                justificativa || null, acesso.usuario.id],
        });
        return NextResponse.json({
            success: true,
            message: ativo === 1 ? "ASO reativado, mantendo o histórico." : "ASO inativado.",
            ativo, ciclo_instancia: cicloAnterior,
        });
    } catch (error) {
        console.error("Erro ao alterar instância documental:", error);
        return NextResponse.json({ success: false, message: "Não foi possível alterar a instância." }, { status: 500 });
    }
}
