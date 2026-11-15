import { createReadStream, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { identificarAmbienteBanco } from "@/lib/db/identificar-ambiente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const nomeArquivo = "Quality Desktop Setup 0.1.0.exe";
const cabecalhos = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET() {
    const usuario = await getCurrentUser();
    if (!usuario) return NextResponse.json({ success: false, message: "Autenticação necessária." }, { status: 401, headers: cabecalhos });
    if (usuario.perfil !== "MASTER" && usuario.perfil !== "SUPERVISORA") {
        return NextResponse.json({ success: false, message: "Acesso não autorizado." }, { status: 403, headers: cabecalhos });
    }
    let ambiente: ReturnType<typeof identificarAmbienteBanco>;
    try { ambiente = identificarAmbienteBanco(); }
    catch { return NextResponse.json({ success: false, message: "Ambiente não identificado." }, { status: 503, headers: cabecalhos }); }
    if (ambiente === "production_offline") {
        return NextResponse.json({ success: false, message: "Download indisponível no Desktop." }, { status: 403, headers: cabecalhos });
    }

    // Somente desenvolvimento local: jamais buscar arquivos do disco do servidor Vercel.
    if (ambiente === "development" && process.env.NODE_ENV === "development") {
        const arquivo = join(process.cwd(), "dist-desktop", "instaladores", nomeArquivo);
        if (!existsSync(arquivo)) {
            return NextResponse.json({ success: false, message: "Instalador ainda não gerado. Execute npm run desktop:dist no ambiente de desenvolvimento." }, { status: 404, headers: cabecalhos });
        }
        const info = statSync(arquivo);
        if (!info.isFile() || info.size === 0) {
            return NextResponse.json({ success: false, message: "Instalador inválido." }, { status: 503, headers: cabecalhos });
        }
        const corpo = Readable.toWeb(createReadStream(arquivo)) as ReadableStream<Uint8Array>;
        return new Response(corpo, {
            headers: {
                ...cabecalhos,
                "Content-Type": "application/octet-stream",
                "Content-Disposition": 'attachment; filename="Quality Desktop Setup 0.1.0.exe"',
                "Content-Length": String(info.size),
            },
        });
    }

    // Produção/Preview: exige publicação prévia em armazenamento HTTPS.
    const endereco = process.env.QUALITY_DESKTOP_INSTALLER_URL;
    if (endereco) {
        try {
            const url = new URL(endereco);
            if (url.protocol === "https:" && !url.username && !url.password &&
                url.hostname.endsWith(".public.blob.vercel-storage.com")) {
                return NextResponse.redirect(url, { status: 307, headers: cabecalhos });
            }
        } catch {}
    }
    return NextResponse.json({
        success: false,
        message: "Instalador ainda não publicado no armazenamento de distribuição.",
    }, { status: 503, headers: cabecalhos });
}
