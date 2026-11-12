import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import db from "@/lib/db";
import { identificarAmbienteBanco } from "@/lib/db/identificar-ambiente";
import { conferirReferenciaSnapshot } from "@/lib/desktop/conferir-referencia-snapshot";
import { calcularIntegridadeStream } from "@/lib/desktop/calcular-integridade-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ tipo: string; id: string }> };
const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
};

/**
 * Metadados calculados a partir dos bytes reais do Blob, somente leitura.
 * Ainda não cria sessão de snapshot imutável nem autoriza ativação offline.
 */
export async function GET(request: Request, context: Context) {
    try {
        if (identificarAmbienteBanco() !== "production") {
            return NextResponse.json({ success: false, message: "Disponível apenas na produção online." }, { status: 403, headers });
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
            return NextResponse.json({ success: false, message: "Identificador inválido." }, { status: 400, headers });
        }

        const referenciaSha256 = new URL(request.url).searchParams.get("referenciaSha256");
        if (!referenciaSha256 || !/^[a-f0-9]{64}$/.test(referenciaSha256)) {
            return NextResponse.json({ success: false, message: "Referência do snapshot obrigatória." }, { status: 400, headers });
        }

        const tabela = tipo === "evidencia" ? "evidencias" : "relatorios";
        const resultado = await db.execute({
            sql: `SELECT arquivo_uri FROM ${tabela} WHERE id = ? AND arquivo_uri IS NOT NULL LIMIT 1`,
            args: [id],
        });
        const uri = resultado.rows[0]?.arquivo_uri;
        if (typeof uri !== "string") {
            return NextResponse.json({ success: false, message: "Arquivo não encontrado." }, { status: 404, headers });
        }
        if (!conferirReferenciaSnapshot(uri, referenciaSha256)) {
            return NextResponse.json({ success: false, message: "Referência alterada desde o snapshot." }, { status: 409, headers });
        }

        const blob = await get(uri, { access: "private" });
        if (!blob) {
            return NextResponse.json({ success: false, message: "Arquivo privado indisponível." }, { status: 404, headers });
        }

        const integridade = await calcularIntegridadeStream(blob.stream);
        if (integridade.tamanhoBytes <= 0 || integridade.tamanhoBytes !== blob.blob.size) {
            return NextResponse.json({ success: false, message: "Tamanho do Blob inconsistente." }, { status: 409, headers });
        }

        return NextResponse.json({
            success: true,
            tipo,
            registroId: id,
            referenciaSha256,
            tamanhoBytes: integridade.tamanhoBytes,
            sha256: integridade.sha256,
        }, { headers });
    } catch (error) {
        console.error("Falha ao calcular integridade de arquivo privado:", error);
        return NextResponse.json({ success: false, message: "Não foi possível verificar o arquivo." }, { status: 500, headers });
    }
}
