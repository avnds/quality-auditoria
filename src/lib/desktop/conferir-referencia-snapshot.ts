import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Confere se a referência atual do banco coincide com a do manifesto.
 * Não comprova integridade dos bytes armazenados no Blob.
 */
export function conferirReferenciaSnapshot(
    uriAtual: string,
    referenciaSha256: string
): boolean {
    if (typeof uriAtual !== "string" || typeof referenciaSha256 !== "string") {
        return false;
    }
    if (!/^[a-f0-9]{64}$/.test(referenciaSha256)) {
        return false;
    }
    const atual = createHash("sha256").update(uriAtual, "utf8").digest();
    const esperado = Buffer.from(referenciaSha256, "hex");
    return timingSafeEqual(atual, esperado);
}
