import { createHash } from "node:crypto";

export type IntegridadeStream = {
    tamanhoBytes: number;
    sha256: string;
};

/**
 * Calcula a integridade de bytes em streaming sem reter o arquivo completo.
 * Consome o stream recebido. Não faz chamadas de rede nem acessa o banco.
 * Não substitui a verificação independente do arquivo salvo no staging.
 */
export async function calcularIntegridadeStream(
    stream: ReadableStream<Uint8Array>
): Promise<IntegridadeStream> {
    const reader = stream.getReader();
    const hash = createHash("sha256");
    let tamanhoBytes = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!(value instanceof Uint8Array)) {
                throw new Error("Conteúdo de arquivo inválido.");
            }
            tamanhoBytes += value.byteLength;
            if (!Number.isSafeInteger(tamanhoBytes)) {
                throw new Error("Tamanho de arquivo fora do limite seguro.");
            }
            hash.update(value);
        }
    } finally {
        reader.releaseLock();
    }
    return { tamanhoBytes, sha256: hash.digest("hex") };
}
