import { createHash, timingSafeEqual } from "node:crypto";
import type { DescritorSessaoExportacao } from "./sessao-exportacao";
import type { SnapshotManifestoExportacao } from "./snapshot-manifesto-exportacao";
import { conferirSnapshotManifestoExportacao } from "./snapshot-manifesto-exportacao";

/**
 * Envelope para persistência privada posterior. Não grava dados nem autoriza
 * requisições. O SHA-256 detecta corrupção acidental, não autentica a origem.
 */
export type EnvelopeSnapshotManifesto = {
    formato: "quality-desktop-manifest-storage";
    versao: 1;
    sessaoId: string;
    conteudoJson: string;
    conteudoSha256: string;
};

export function serializarSnapshotManifesto(
    descritor: DescritorSessaoExportacao,
    snapshot: SnapshotManifestoExportacao
): EnvelopeSnapshotManifesto {
    if (!conferirSnapshotManifestoExportacao(descritor, snapshot)) {
        throw new Error("Snapshot incompatível com a sessão.");
    }
    const conteudoJson = JSON.stringify(snapshot);
    return {
        formato: "quality-desktop-manifest-storage",
        versao: 1,
        sessaoId: descritor.sessaoId,
        conteudoJson,
        conteudoSha256: createHash("sha256").update(conteudoJson, "utf8").digest("hex"),
    };
}

export function desserializarSnapshotManifesto(
    descritor: DescritorSessaoExportacao,
    envelope: EnvelopeSnapshotManifesto
): SnapshotManifestoExportacao {
    if (!envelope ||
        envelope.formato !== "quality-desktop-manifest-storage" ||
        envelope.versao !== 1 ||
        envelope.sessaoId !== descritor.sessaoId ||
        typeof envelope.conteudoJson !== "string" ||
        typeof envelope.conteudoSha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(envelope.conteudoSha256)) {
        throw new Error("Envelope de manifesto inválido.");
    }
    const calculado = createHash("sha256").update(envelope.conteudoJson, "utf8").digest();
    if (!timingSafeEqual(calculado, Buffer.from(envelope.conteudoSha256, "hex"))) {
        throw new Error("Conteúdo persistido não confere com o hash.");
    }
    let snapshot: SnapshotManifestoExportacao;
    try {
        snapshot = JSON.parse(envelope.conteudoJson) as SnapshotManifestoExportacao;
    } catch {
        throw new Error("Conteúdo persistido não é JSON válido.");
    }
    if (!conferirSnapshotManifestoExportacao(descritor, snapshot)) {
        throw new Error("Manifesto persistido não corresponde à sessão.");
    }
    return snapshot;
}
