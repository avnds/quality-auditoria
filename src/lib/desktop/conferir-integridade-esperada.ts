import { timingSafeEqual } from "node:crypto";
import type { PlanoTransferencia } from "./plano-transferencia";

export type IntegridadeEsperada = {
    tipo: "evidencia" | "relatorio";
    registroId: string;
    tamanhoBytes: number;
    sha256: string;
};

/**
 * Confere os metadados do plano contra valores esperados independentes,
 * obtidos de uma exportação autenticada e confiável.
 * Não substitui a leitura e o hash dos arquivos reais no staging.
 */
export function conferirIntegridadeEsperada(
    plano: PlanoTransferencia,
    esperados: readonly IntegridadeEsperada[]
): boolean {
    if (plano.versao !== 1 || plano.arquivos.length !== esperados.length) return false;

    const mapa = new Map<string, IntegridadeEsperada>();
    for (const item of esperados) {
        if ((item.tipo !== "evidencia" && item.tipo !== "relatorio") ||
            !/^[A-Za-z0-9_-]{1,128}$/.test(item.registroId) ||
            !Number.isSafeInteger(item.tamanhoBytes) || item.tamanhoBytes <= 0 ||
            !/^[a-f0-9]{64}$/.test(item.sha256)) return false;
        const chave = `${item.tipo}:${item.registroId}`;
        if (mapa.has(chave)) return false;
        mapa.set(chave, item);
    }

    const vistos = new Set<string>();
    for (const arquivo of plano.arquivos) {
        const chave = `${arquivo.tipo}:${arquivo.registroId}`;
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        const esperado = mapa.get(chave);
        if (!esperado || arquivo.estado !== "validado" ||
            arquivo.tamanhoBytes !== esperado.tamanhoBytes ||
            typeof arquivo.sha256 !== "string" ||
            !/^[a-f0-9]{64}$/.test(arquivo.sha256)) return false;
        if (!timingSafeEqual(Buffer.from(arquivo.sha256, "hex"), Buffer.from(esperado.sha256, "hex"))) return false;
    }
    return true;
}
