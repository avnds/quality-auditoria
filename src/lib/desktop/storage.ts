import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export type DesktopDataPaths = {
    root: string;
    databaseDir: string;
    databaseFile: string;
    evidenciasDir: string;
    backupsDir: string;
};

/**
 * Diretórios persistentes do Quality Desktop no Windows.
 * Esta função apenas calcula caminhos: não cria pastas nem acessa bancos.
 */
export function obterCaminhosDesktop(): DesktopDataPaths {
    if (process.platform !== "win32") {
        throw new Error("O armazenamento Desktop está configurado apenas para Windows.");
    }

    const localAppData = process.env.LOCALAPPDATA;
    if (!localAppData) {
        throw new Error("LOCALAPPDATA não está definido. Não é seguro escolher outro diretório.");
    }

    const root = join(localAppData, "QualityDesktop");
    const databaseDir = join(root, "database");
    return {
        root,
        databaseDir,
        databaseFile: join(databaseDir, "quality.sqlite"),
        evidenciasDir: join(root, "evidencias"),
        backupsDir: join(root, "backups"),
    };
}

/** Cria somente os diretórios; não cria banco, tabelas ou registros. */
export function prepararDiretoriosDesktop(): DesktopDataPaths {
    const paths = obterCaminhosDesktop();
    for (const dir of [paths.databaseDir, paths.evidenciasDir, paths.backupsDir]) {
        mkdirSync(dir, { recursive: true });
    }
    return paths;
}

export function obterUrlBancoDesktop(): string {
    return pathToFileURL(obterCaminhosDesktop().databaseFile).href;
}
