import { createHash, timingSafeEqual } from "node:crypto";
import type { ManifestoImportacaoDesktop } from "./manifesto-importacao";
import type { DescritorSessaoExportacao } from "./sessao-exportacao";

/**
 * Conteúdo congelado de uma exportação. Deve ser armazenado em meio privado
 * antes de uma sessão poder ser ativada. NÃO é um snapshot de arquivos Blob.
 */
export type SnapshotManifestoExportacao = {
    formato: "quality-desktop-export-manifest-snapshot";
    versao: 1;
    sessaoId: string;
    manifesto: ManifestoImportacaoDesktop;
};

function hashManifesto(manifesto: ManifestoImportacaoDesktop): string {
    return createHash("sha256").update(JSON.stringify(manifesto), "utf8").digest("hex");
}

export function prepararSnapshotManifestoExportacao(
    descritor: DescritorSessaoExportacao,
    manifesto: ManifestoImportacaoDesktop
): SnapshotManifestoExportacao {
    if (!conferirManifestoSessao(descritor, manifesto)) {
        throw new Error("Manifesto não corresponde ao descritor da sessão.");
    }
    return {
        formato: "quality-desktop-export-manifest-snapshot",
        versao: 1,
        sessaoId: descritor.sessaoId,
        manifesto: structuredClone(manifesto),
    };
}

export function conferirManifestoSessao(
    descritor: DescritorSessaoExportacao,
    manifesto: ManifestoImportacaoDesktop
): boolean {
    if (!descritor || !manifesto ||
        descritor.formato !== "quality-desktop-export-session" ||
        descritor.versao !== 1 ||
        manifesto.formato !== "quality-desktop-import-manifest" ||
        manifesto.versao !== 1 ||
        !/^[a-f0-9]{64}$/.test(descritor.manifestoSha256)) return false;
    const recebido = Buffer.from(descritor.manifestoSha256, "hex");
    const esperado = Buffer.from(hashManifesto(manifesto), "hex");
    return timingSafeEqual(recebido, esperado);
}

export function conferirSnapshotManifestoExportacao(
    descritor: DescritorSessaoExportacao,
    snapshot: SnapshotManifestoExportacao
): boolean {
    return !!snapshot &&
        snapshot.formato === "quality-desktop-export-manifest-snapshot" &&
        snapshot.versao === 1 &&
        snapshot.sessaoId === descritor.sessaoId &&
        conferirManifestoSessao(descritor, snapshot.manifesto);
}
