import type { FonteArquivoImportacao } from "./preparar-importacao-completa";
import type { IntegridadeEsperada } from "./conferir-integridade-esperada";

/**
 * Transporte HTTP autenticado fornecido pelo aplicativo chamador.
 * A função deve preservar a sessão autenticada, aplicar timeout e validar TLS.
 * Nenhuma credencial é armazenada neste módulo.
 */
export type TransporteSessaoDesktop = (caminho: string) => Promise<Response>;

export function criarFonteImportacaoSessao(
    sessaoId: string,
    transporte: TransporteSessaoDesktop
): FonteArquivoImportacao {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(sessaoId)) {
        throw new Error("Identificador de sessão inválido.");
    }
    return async ({ tipo, registroId, referenciaSha256 }) => {
        if ((tipo !== "evidencia" && tipo !== "relatorio") ||
            !/^[A-Za-z0-9_-]{1,128}$/.test(registroId) ||
            !/^[a-f0-9]{64}$/.test(referenciaSha256)) {
            throw new Error("Identificador ou referência de arquivo inválido.");
        }
        const base = `/api/desktop/exportacao/sessoes/${sessaoId}`;
        const arquivo = `${encodeURIComponent(tipo)}/${encodeURIComponent(registroId)}`;
        const query = `?referenciaSha256=${referenciaSha256}`;
        const respostaIntegridade = await transporte(`${base}/integridade/${arquivo}${query}`);
        if (!respostaIntegridade.ok) {
            throw new Error(`Medição de integridade recusada (HTTP ${respostaIntegridade.status}).`);
        }
        const dados: unknown = await respostaIntegridade.json();
        if (!dados || typeof dados !== "object") {
            throw new Error("Resposta de integridade inválida.");
        }
        const m = dados as Record<string, unknown>;
        if (m.success !== true || m.sessaoId !== sessaoId ||
            m.tipo !== tipo || m.registroId !== registroId ||
            m.referenciaSha256 !== referenciaSha256 ||
            !Number.isSafeInteger(m.tamanhoBytes) || (m.tamanhoBytes as number) <= 0 ||
            typeof m.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(m.sha256)) {
            throw new Error("Integridade não corresponde à sessão e ao arquivo solicitados.");
        }
        const integridade: IntegridadeEsperada = {
            tipo, registroId, tamanhoBytes: m.tamanhoBytes as number, sha256: m.sha256,
        };
        const respostaArquivo = await transporte(`${base}/arquivos/${arquivo}${query}`);
        if (!respostaArquivo.ok || !respostaArquivo.body) {
            throw new Error(`Transferência recusada (HTTP ${respostaArquivo.status}).`);
        }
        const tamanhoDeclarado = respostaArquivo.headers.get("content-length");
        if (tamanhoDeclarado !== null &&
            (!/^\d+$/.test(tamanhoDeclarado) || Number(tamanhoDeclarado) !== integridade.tamanhoBytes)) {
            await respostaArquivo.body.cancel();
            throw new Error("Tamanho declarado diverge da medição de integridade.");
        }
        return { stream: respostaArquivo.body, integridade };
    };
}
