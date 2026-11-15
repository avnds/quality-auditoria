import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import db from "@/lib/db";
import { identificarAmbienteBanco } from "@/lib/db/identificar-ambiente";
import { recuperarSnapshotBancoExportacao } from "@/lib/desktop/repositorio-snapshots-banco-exportacao";
import { recuperarManifestoExportacao } from "@/lib/desktop/repositorio-manifestos-exportacao";
import { localizarArquivoNoSnapshot } from "@/lib/desktop/localizar-arquivo-snapshot";
import { calcularIntegridadeStream } from "@/lib/desktop/calcular-integridade-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
type Contexto = { params: Promise<{ sessaoId: string; tipo: string; id: string }> };

/**
 * Mede bytes reais do Blob referenciado pelo snapshot da sessão.
 * Não altera o Blob nem garante imutabilidade entre medição e download.
 * O importador deve comparar os bytes recebidos com esta medição.
 */
export async function GET(request: Request, contexto: Contexto) {
    if (process.env.QUALITY_DESKTOP_EXPORT_SESSION_ENABLED !== "true") {
        return NextResponse.json({ success: false, message: "Integridade por sessão desativada." }, { status: 503, headers });
    }
    try {
        if (identificarAmbienteBanco() !== "production") {
            return NextResponse.json({ success: false, message: "Disponível somente na produção online." }, { status: 403, headers });
        }
        const usuario = await getCurrentUser();
        if (!usuario) return NextResponse.json({ success: false, message: "Autenticação necessária." }, { status: 401, headers });
        if (usuario.perfil !== "MASTER" && usuario.perfil !== "SUPERVISORA") {
            return NextResponse.json({ success: false, message: "Perfil não autorizado." }, { status: 403, headers });
        }
        const { sessaoId, tipo, id } = await contexto.params;
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(sessaoId) ||
            (tipo !== "evidencia" && tipo !== "relatorio") ||
            !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
            return NextResponse.json({ success: false, message: "Identificadores inválidos." }, { status: 400, headers });
        }
        const referenciaSha256 = new URL(request.url).searchParams.get("referenciaSha256");
        if (!referenciaSha256 || !/^[a-f0-9]{64}$/.test(referenciaSha256)) {
            return NextResponse.json({ success: false, message: "Referência inválida." }, { status: 400, headers });
        }
        const agora = new Date();
        const [snapshot, manifesto] = await Promise.all([
            recuperarSnapshotBancoExportacao(db, sessaoId, usuario.id, agora),
            recuperarManifestoExportacao(db, sessaoId, usuario.id, agora),
        ]);
        if (!snapshot || !manifesto || manifesto.sessaoId !== sessaoId) {
            return NextResponse.json({ success: false, message: "Sessão indisponível." }, { status: 404, headers });
        }
        const vinculo = localizarArquivoNoSnapshot(snapshot, manifesto.manifesto, tipo, id, referenciaSha256);
        if (!vinculo) {
            return NextResponse.json({ success: false, message: "Arquivo não pertence à sessão." }, { status: 404, headers });
        }
        const arquivo = await get(vinculo.uriSnapshot, { access: "private" });
        if (!arquivo || !arquivo.stream) {
            return NextResponse.json({ success: false, message: "Arquivo privado indisponível." }, { status: 404, headers });
        }
        const integridade = await calcularIntegridadeStream(arquivo.stream);
        if (integridade.tamanhoBytes <= 0 || integridade.tamanhoBytes !== arquivo.blob.size) {
            return NextResponse.json({ success: false, message: "Tamanho do Blob inconsistente." }, { status: 409, headers });
        }
        return NextResponse.json({
            success: true,
            sessaoId,
            tipo,
            registroId: id,
            referenciaSha256,
            tamanhoBytes: integridade.tamanhoBytes,
            sha256: integridade.sha256,
        }, { headers });
    } catch (error) {
        console.error("Falha ao medir integridade por sessão Desktop:", error);
        return NextResponse.json({ success: false, message: "Integridade indisponível." }, { status: 500, headers });
    }
}
