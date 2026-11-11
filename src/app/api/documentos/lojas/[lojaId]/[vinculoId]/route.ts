import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/auth/auth-response";

type Contexto = { params: Promise<{ lojaId: string; vinculoId: string }> };

export async function PATCH(request: Request, context: Contexto) {
    try {
        const acesso = await requirePermission("documentos.gerenciar_lojas");
        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO" ? unauthorizedResponse() : forbiddenResponse();
        }
        if (!["MASTER", "SUPERVISORA"].includes(acesso.usuario.perfil)) {
            return forbiddenResponse();
        }

        const { lojaId, vinculoId } = await context.params;
        const body: unknown = await request.json();
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return NextResponse.json({ success: false, message: "Dados inválidos." }, { status: 400 });
        }
        const dados = body as Record<string, unknown>;
        const campos = Object.keys(dados);
        const permitidos = ["periodicidade_meses", "alerta_dias", "ativo", "justificativa"];
        if (!campos.length || campos.some((campo) => !permitidos.includes(campo))) {
            return NextResponse.json({ success: false, message: "Informe campos válidos." }, { status: 400 });
        }

        const atualResult = await db.execute({
            sql: `SELECT dl.id, dl.loja_id, dl.documento_id, dl.periodicidade_meses,
                         dl.alerta_dias, dl.ativo, dl.ciclo_atual, l.ativo AS loja_ativa,
                         dc.ativo AS catalogo_ativo
                  FROM documentos_lojas dl
                  JOIN lojas l ON l.id = dl.loja_id
                  JOIN documentos_catalogo dc ON dc.id = dl.documento_id
                  WHERE dl.id = ? AND dl.loja_id = ? LIMIT 1`,
            args: [vinculoId, lojaId],
        });
        if (!atualResult.rows.length) {
            return NextResponse.json({ success: false, message: "Vínculo não encontrado." }, { status: 404 });
        }
        const atual = atualResult.rows[0];

        const periodicidade = "periodicidade_meses" in dados ? dados.periodicidade_meses : atual.periodicidade_meses;
        const alerta = "alerta_dias" in dados ? dados.alerta_dias : atual.alerta_dias;
        const ativo = "ativo" in dados ? dados.ativo : Number(atual.ativo);
        const justificativa = typeof dados.justificativa === "string" ? dados.justificativa.trim() : "";

        if (!(periodicidade === null || (typeof periodicidade === "number" && Number.isInteger(periodicidade) && periodicidade > 0 && periodicidade <= 1200)) ||
            !(alerta === null || (typeof alerta === "number" && Number.isInteger(alerta) && alerta >= 0 && alerta <= 3650)) ||
            (ativo !== 0 && ativo !== 1) ||
            ("justificativa" in dados && (typeof dados.justificativa !== "string" || justificativa.length > 2000))) {
            return NextResponse.json({ success: false, message: "Periodicidade, alerta, situação ou justificativa inválida." }, { status: 400 });
        }
        if (Number(atual.ativo) === 1 && ativo === 0 && !justificativa) {
            return NextResponse.json({ success: false, message: "Informe a justificativa para desativar o documento." }, { status: 400 });
        }
        if (Number(atual.ativo) === 0 && ativo === 1 &&
            (Number(atual.loja_ativa) !== 1 || Number(atual.catalogo_ativo) !== 1)) {
            return NextResponse.json({ success: false, message: "Ative a loja e o tipo documental antes de reativar o vínculo." }, { status: 409 });
        }

        const reativar = Number(atual.ativo) === 0 && ativo === 1;
        const ciclo = Number(atual.ciclo_atual) + (reativar ? 1 : 0);
        const novo = {
            id: vinculoId,
            loja_id: lojaId,
            documento_id: String(atual.documento_id),
            periodicidade_meses: periodicidade,
            alerta_dias: alerta,
            ativo,
            ciclo_atual: ciclo,
        };
        const anterior = {
            id: vinculoId,
            loja_id: lojaId,
            documento_id: String(atual.documento_id),
            periodicidade_meses: atual.periodicidade_meses,
            alerta_dias: atual.alerta_dias,
            ativo: Number(atual.ativo),
            ciclo_atual: Number(atual.ciclo_atual),
        };
        if (JSON.stringify(anterior) === JSON.stringify(novo)) {
            return NextResponse.json({ success: true, message: "Nenhuma alteração necessária.", documento: novo });
        }
        const acao = reativar ? "REATIVAR" : Number(atual.ativo) === 1 && ativo === 0 ? "DESATIVAR" : "CONFIGURAR";

        await db.batch([
            {
                sql: `UPDATE documentos_lojas SET periodicidade_meses = ?, alerta_dias = ?,
                         ativo = ?, ciclo_atual = ?, atualizado_em = CURRENT_TIMESTAMP
                      WHERE id = ? AND loja_id = ?`,
                args: [periodicidade as number | null, alerta as number | null, ativo as number, ciclo, vinculoId, lojaId],
            },
            {
                sql: `INSERT INTO documentos_alteracoes
                    (id, entidade_tipo, entidade_id, acao, dados_anteriores, dados_novos, justificativa, usuario_id)
                    VALUES (?, 'DOCUMENTO_LOJA', ?, ?, ?, ?, ?, ?)`,
                args: [crypto.randomUUID(), vinculoId, acao, JSON.stringify(anterior), JSON.stringify(novo),
                    justificativa || null, acesso.usuario.id],
            },
        ], "write");

        return NextResponse.json({ success: true, message: "Configuração atualizada com sucesso.", documento: novo });
    } catch (error) {
        console.error("Erro ao atualizar documento da loja:", error);
        return NextResponse.json({ success: false, message: "Não foi possível atualizar o documento da loja." }, { status: 500 });
    }
}
