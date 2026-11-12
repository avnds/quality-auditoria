import type { LogicalDatabaseBackup } from "../db/backup";
import { inventariarArquivosBlob, type InventarioBlob } from "./inventario-blob";
import { validarOrigemBackupParaDesktop } from "./politica-importacao";

export type ManifestoImportacaoDesktop = {
    formato: "quality-desktop-import-manifest";
    versao: 1;
    modalidade: "producao_direta" | "pacote_backup";
    origem: "production" | "production_offline";
    criadoEm: string;
    inventario: InventarioBlob;
    totalArquivos: number;
};

/**
 * Constrói metadados a partir de um backup lógico já obtido.
 * Não faz consultas de rede nem baixa ou altera arquivos.
 * Não inclui tokens de acesso.
 */
export function prepararManifestoImportacaoDesktop(
    backup: LogicalDatabaseBackup,
    modalidade: ManifestoImportacaoDesktop["modalidade"]
): ManifestoImportacaoDesktop {
    validarOrigemBackupParaDesktop(backup);
    if (modalidade !== "producao_direta" && modalidade !== "pacote_backup") {
        throw new Error("Modalidade de importação inválida.");
    }
    if (modalidade === "producao_direta" && backup.source !== "production") {
        throw new Error("Importação direta exige origem de produção online.");
    }
    if (!Number.isFinite(Date.parse(backup.createdAt))) {
        throw new Error("Data de criação do backup inválida.");
    }
    if (backup.source !== "production" && backup.source !== "production_offline") {
        throw new Error("Origem do backup não permitida para o Desktop.");
    }
    const inventario = inventariarArquivosBlob(backup);
    return {
        formato: "quality-desktop-import-manifest",
        versao: 1,
        modalidade,
        origem: backup.source,
        criadoEm: backup.createdAt,
        inventario,
        totalArquivos: inventario.arquivos.length,
    };
}
