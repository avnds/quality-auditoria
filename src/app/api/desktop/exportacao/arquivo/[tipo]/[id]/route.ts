import { createHash, timingSafeEqual } from "node:crypto";
import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import db from "@/lib/db";
import { identificarAmbienteBanco } from "@/lib/db/identificar-ambiente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ tipo: string; id: string }> };
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

/**
 * Download somente leitura, por identificador interno.
 * Confere a referência persistida com o hash fornecido pelo manifesto.
 * Isso detecta troca de URI, mas NÃO comprova integridade dos bytes do Blob
 * nem constitui uma sessão de snapshot imutável. A ativação permanece bloqueada.
 */
export async function GET(request: Request, context: Context) {
    try {
        if (identificarAmbienteBanco() !== "production") {
            return NextResponse.json({ success: false, message: "Exportação disponível apenas na produção online." }, { status: 403, headers });
        }

        const usuario = await getCurrentUser();
        if (!usuario) {
            return NextResponse.json({ success: false, message: "Autenticação necessária." }, { status: 401, headers });
        }
        if (usuario.perfil !== "MASTER" && usuario.perfil !== "SUPERVISORA") {
            return NextResponse.json({ success: false, message: "Acesso não autorizado." }, { status: 403, headers });
        }

        const { tipo, id } = await context.params;
        if ((tipo !== "evidencia" && tipo !== "relatorio") || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
            return NextResponse.json({ success: false, message: "Identificador de arquivo inválido." }, { status: 400, headers });
        }

        const referenciaSha256 = new URL(request.url).searchParams.get("referenciaSha256");
        if (!referenciaSha256 || !/^[a-f0-9]{64}$/.test(referenciaSha256)) {
            return NextResponse.json({ success: false, message: "Referência do snapshot obrigatória." }, { status: 400, headers });
        }

        const tabela = tipo === "evidencia" ? "evidencias" : "relatorios";
        // Tabela é escolhida exclusivamente entre dois nomes constantes.
        // O identificador do cliente é sempre um parâmetro SQL.
        const result = await db.execute({
            sql: `SELECT arquivo_uri FROM ${tabela} WHERE id = ? AND arquivo_uri IS NOT NULL LIMIT 1`,
            args: [id],
        });
        if (result.rows.length === 0 || typeof result.rows[0].arquivo_uri !== "string") {
            return NextResponse.json({ success: false, message: "Arquivo não encontrado." }, { status: 404, headers });
        }

        const uri = String(result.rows[0].arquivo_uri);
        const hashAtual = createHash("sha256").update(uri, "utf8").digest();
        const hashEsperado = Buffer.from(referenciaSha256, "hex");
        if (!timingSafeEqual(hashAtual, hashEsperado)) {
            return NextResponse.json({ success: false, message: "Arquivo alterado desde a geração do snapshot. Reinicie a exportação." }, { status: 409, headers });
        }
        // Somente referências persistidas no banco são usadas.
        // Nenhum URL, caminho ou token é aceito como entrada do cliente.
        const arquivo = await get(uri, { access: "private" });
        if (!arquivo) {
            return NextResponse.json({ success: false, message: "Arquivo privado indisponível." }, { status: 404, headers });
        }

        return new Response(arquivo.stream, {
            status: 200,
            headers: {
                ...headers,
                "Content-Type": arquivo.blob.contentType ?? "application/octet-stream",
                "Content-Length": String(arquivo.blob.size),
                "Content-Disposition": `attachment; filename="${tipo}-${id}"`,
            },
        });
    } catch (error) {
        console.error("Falha ao transferir arquivo privado para Desktop:", error);
        return NextResponse.json({ success: false, message: "Falha na transferência do arquivo." }, { status: 500, headers });
    }
}
