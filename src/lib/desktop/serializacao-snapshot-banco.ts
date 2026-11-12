import { createHash, timingSafeEqual } from "node:crypto";
import type { LogicalDatabaseBackup } from "../db/backup";
import type { DescritorSessaoExportacao } from "./sessao-exportacao";
import type { ManifestoImportacaoDesktop } from "./manifesto-importacao";
import { prepararManifestoImportacaoDesktop } from "./manifesto-importacao";
import { validarDescritorSessaoExportacao } from "./sessao-exportacao";

/**
 * Snapshot lógico congelado para uma sessão. Contém dados potencialmente
 * sensíveis e URLs privadas: somente armazenamento protegido no servidor.
 * SHA-256 verifica integridade, não substitui autenticação nem criptografia.
 */
export type EnvelopeSnapshotBancoExportacao = {
    formato: "quality-desktop-database-snapshot";
    versao: 1;
    sessaoId: string;
    conteudoJson: string;
    conteudoSha256: string;
};

export function serializarSnapshotBancoExportacao(
    descritor: DescritorSessaoExportacao,
    backup: LogicalDatabaseBackup
): EnvelopeSnapshotBancoExportacao {
    const manifesto = prepararManifestoImportacaoDesktop(backup, "producao_direta");
    if (!validarDescritorSessaoExportacao(descritor, manifesto, new Date(descritor.criadaEm))) {
        throw new Error("Backup não corresponde ao manifesto da sessão.");
    }
    const conteudoJson = JSON.stringify(backup);
    return {
        formato: "quality-desktop-database-snapshot",
        versao: 1,
        sessaoId: descritor.sessaoId,
        conteudoJson,
        conteudoSha256: createHash("sha256").update(conteudoJson, "utf8").digest("hex"),
    };
}

export function desserializarSnapshotBancoExportacao(
    descritor: DescritorSessaoExportacao,
    envelope: EnvelopeSnapshotBancoExportacao,
    agora = new Date()
): LogicalDatabaseBackup {
    if (!envelope || envelope.formato !== "quality-desktop-database-snapshot" ||
        envelope.versao !== 1 || envelope.sessaoId !== descritor.sessaoId ||
        typeof envelope.conteudoJson !== "string" ||
        !/^[a-f0-9]{64}$/.test(envelope.conteudoSha256)) {
        throw new Error("Envelope de snapshot inválido.");
    }
    const digest = createHash("sha256").update(envelope.conteudoJson, "utf8").digest();
    if (!timingSafeEqual(digest, Buffer.from(envelope.conteudoSha256, "hex"))) {
        throw new Error("Snapshot persistido apresenta divergência de integridade.");
    }
    let backup: LogicalDatabaseBackup;
    try {
        backup = JSON.parse(envelope.conteudoJson) as LogicalDatabaseBackup;
    } catch {
        throw new Error("Snapshot persistido não é JSON válido.");
    }
    const manifesto: ManifestoImportacaoDesktop = prepararManifestoImportacaoDesktop(backup, "producao_direta");
    if (!validarDescritorSessaoExportacao(descritor, manifesto, agora)) {
        throw new Error("Snapshot não corresponde à sessão ativa.");
    }
    return backup;
}
