import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/auth/auth-response";

type Contexto = { params: Promise<{ lojaId: string }> };

export async function POST(request: Request, context: Contexto) {
    try {
        const acesso = await requirePermission("documentos.gerenciar_lojas");
        if (!acesso.autorizado) return acesso.motivo === "NAO_AUTENTICADO" ? unauthorizedResponse() : forbiddenResponse();
        if (!["MASTER", "SUPERVISORA"].includes(acesso.usuario.perfil)) return forbiddenResponse();
        const { lojaId } = await context.params;
        const body: unknown = await request.json();
        if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ success: false, message: "Dados inválidos." }, { status: 400 });
        const ids = (body as { documento_ids?: unknown }).documento_ids;
        if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || ids.some((id) => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length) {
            return NextResponse.json({ success: false, message: "Selecione entre 1 e 100 documentos distintos." }, { status: 400 });
        }
        const loja = await db.execute({ sql: "SELECT id FROM lojas WHERE id = ? AND ativo = 1 LIMIT 1", args: [lojaId] });
        if (!loja.rows.length) return NextResponse.json({ success: false, message: "Loja inexistente ou inativa." }, { status: 404 });
        const placeholders = ids.map(() => "?").join(",");
        const catalogo = await db.execute({ sql: `SELECT id FROM documentos_catalogo WHERE ativo = 1 AND id IN (${placeholders})`, args: ids });
        if (catalogo.rows.length !== ids.length) return NextResponse.json({ success: false, message: "Um ou mais documentos não estão ativos no catálogo." }, { status: 400 });
        const existentes = await db.execute({ sql: `SELECT documento_id FROM documentos_lojas WHERE loja_id = ? AND documento_id IN (${placeholders})`, args: [lojaId, ...ids] });
        if (existentes.rows.length) return NextResponse.json({ success: false, message: "Há documentos já vinculados. Atualize a lista e selecione apenas os disponíveis." }, { status: 409 });
        const statements: { sql: string; args: (string | number | null)[] }[] = [];
        for (const documentoId of ids as string[]) {
            const id = crypto.randomUUID();
            const novo = { id, loja_id: lojaId, documento_id: documentoId, periodicidade_meses: null, alerta_dias: null, ativo: 1, ciclo_atual: 1 };
            statements.push({ sql: "INSERT INTO documentos_lojas (id, loja_id, documento_id, periodicidade_meses, alerta_dias, ativo, ciclo_atual, criado_por) VALUES (?, ?, ?, NULL, NULL, 1, 1, ?)", args: [id, lojaId, documentoId, acesso.usuario.id] });
            statements.push({ sql: "INSERT INTO documentos_alteracoes (id, entidade_tipo, entidade_id, acao, dados_novos, usuario_id) VALUES (?, 'DOCUMENTO_LOJA', ?, 'VINCULAR', ?, ?)", args: [crypto.randomUUID(), id, JSON.stringify(novo), acesso.usuario.id] });
        }
        await db.batch(statements, "write");
        return NextResponse.json({ success: true, quantidade: ids.length }, { status: 201 });
    } catch (error) {
        console.error("Erro ao vincular documentos em lote:", error);
        return NextResponse.json({ success: false, message: "Não foi possível vincular os documentos." }, { status: 500 });
    }
}
