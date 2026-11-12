import { timingSafeEqual } from "node:crypto";
import type { ManifestoImportacaoDesktop } from "./manifesto-importacao";
import type { IntegridadeEsperada } from "./conferir-integridade-esperada";

/**
 * Confere que a lista de hashes de CONTEÚDO cobre exatamente os arquivos
 * identificados no manifesto congelado. Não transforma referências de URL
 * em hashes de conteúdo e não congela o Blob remoto.
 */
export function conferirCoberturaIntegridadeManifesto(
    manifesto: ManifestoImportacaoDesktop,
    integridades: readonly IntegridadeEsperada[]
): boolean {
    if (!manifesto || manifesto.formato !== "quality-desktop-import-manifest" ||
        manifesto.versao !== 1 || !Array.isArray(manifesto.inventario?.arquivos) ||
        !Array.isArray(integridades) ||
        manifesto.totalArquivos !== manifesto.inventario.arquivos.length ||
        manifesto.totalArquivos !== integridades.length) return false;

    const esperados = new Map<string, { referenciaSha256: string }>();
    let evidencias = 0;
    let relatorios = 0;
    for (const arquivo of manifesto.inventario.arquivos) {
        if ((arquivo.tipo !== "evidencia" && arquivo.tipo !== "relatorio") ||
            !/^[A-Za-z0-9_-]{1,128}$/.test(arquivo.registroId) ||
            !/^[a-f0-9]{64}$/.test(arquivo.referenciaSha256)) return false;
        const chave = `${arquivo.tipo}:${arquivo.registroId}`;
        if (esperados.has(chave)) return false;
        esperados.set(chave, { referenciaSha256: arquivo.referenciaSha256 });
        if (arquivo.tipo === "evidencia") evidencias++;
        else relatorios++;
    }
    if (evidencias !== manifesto.inventario.totalEvidencias ||
        relatorios !== manifesto.inventario.totalRelatorios) return false;

    const vistos = new Set<string>();
    for (const item of integridades) {
        if ((item.tipo !== "evidencia" && item.tipo !== "relatorio") ||
            !/^[A-Za-z0-9_-]{1,128}$/.test(item.registroId) ||
            !Number.isSafeInteger(item.tamanhoBytes) || item.tamanhoBytes <= 0 ||
            !/^[a-f0-9]{64}$/.test(item.sha256)) return false;
        const chave = `${item.tipo}:${item.registroId}`;
        if (!esperados.has(chave) || vistos.has(chave)) return false;
        vistos.add(chave);
    }
    return vistos.size === esperados.size;
}

/** Compara duas medições independentes dos mesmos bytes, sem depender da ordem. */
export function conferirMedicoesIntegridade(
    anteriores: readonly IntegridadeEsperada[],
    posteriores: readonly IntegridadeEsperada[]
): boolean {
    if (anteriores.length !== posteriores.length) return false;
    const mapa = new Map<string, IntegridadeEsperada>();
    for (const item of anteriores) {
        const chave = `${item.tipo}:${item.registroId}`;
        if (mapa.has(chave) || !/^[a-f0-9]{64}$/.test(item.sha256) ||
            !Number.isSafeInteger(item.tamanhoBytes) || item.tamanhoBytes <= 0) return false;
        mapa.set(chave, item);
    }
    const vistos = new Set<string>();
    for (const item of posteriores) {
        const chave = `${item.tipo}:${item.registroId}`;
        const anterior = mapa.get(chave);
        if (!anterior || vistos.has(chave) ||
            !/^[a-f0-9]{64}$/.test(item.sha256) ||
            item.tamanhoBytes !== anterior.tamanhoBytes) return false;
        vistos.add(chave);
        if (!timingSafeEqual(Buffer.from(anterior.sha256, "hex"), Buffer.from(item.sha256, "hex"))) return false;
    }
    return true;
}
