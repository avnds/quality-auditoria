import { createReadStream, existsSync, lstatSync, realpathSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { obterCaminhosDesktop } from "./storage";

export type TipoArquivoDesktop = "evidencia" | "relatorio";
const idValido = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * Serve cópias importadas do disco local, sem acessar Vercel Blob.
 * Estrutura definitiva prevista: QualityDesktop/arquivos/{evidencias|relatorios}/{id}.
 * A publicação da importação deverá copiar a árvore staging/arquivos para
 * essa estrutura antes de criar o marcador de instalação.
 */
export function abrirArquivoDesktop(tipo: TipoArquivoDesktop, registroId: string): Response | null {
    if (!idValido.test(registroId)) return null;
    const root = obterCaminhosDesktop().root;
    const base = resolve(root, "arquivos", tipo === "evidencia" ? "evidencias" : "relatorios");
    const arquivo = resolve(base, registroId);
    if (!arquivo.startsWith(base + sep) || !existsSync(arquivo)) return null;
    try {
        if (lstatSync(arquivo).isSymbolicLink() || !lstatSync(arquivo).isFile() ||
            realpathSync(arquivo) !== arquivo) return null;
        const tamanho = statSync(arquivo).size;
        const nodeStream = createReadStream(arquivo);
        return new Response(Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>, {
            status: 200,
            headers: {
                "Content-Type": tipo === "relatorio" ? "application/pdf" : "application/octet-stream",
                "Content-Length": String(tamanho),
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch {
        return null;
    }
}
