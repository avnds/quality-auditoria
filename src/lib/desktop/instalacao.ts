import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { obterCaminhosDesktop } from "./storage";

export type EstadoInstalacaoDesktop =
    | { pronta: true }
    | { pronta: false; motivo: "banco_ausente" | "importacao_pendente" | "marcador_invalido" };

/**
 * Verificação preliminar, somente leitura, da primeira instalação.
 * O marcador será criado exclusivamente após uma restauração validada.
 * Esta função não autentica usuários e não substitui a validação de
 * integridade do banco que será feita no fluxo de importação.
 */
export function verificarInstalacaoDesktop(): EstadoInstalacaoDesktop {
    const paths = obterCaminhosDesktop();
    if (!existsSync(paths.databaseFile)) {
        return { pronta: false, motivo: "banco_ausente" };
    }

    const marker = join(paths.root, "instalacao.json");
    if (!existsSync(marker)) {
        return { pronta: false, motivo: "importacao_pendente" };
    }

    try {
        const value: unknown = JSON.parse(readFileSync(marker, "utf8"));
        if (
            typeof value === "object" &&
            value !== null &&
            "format" in value &&
            value.format === "quality-desktop-installation" &&
            "version" in value &&
            value.version === 1 &&
            "importedAt" in value &&
            typeof value.importedAt === "string" &&
            !Number.isNaN(Date.parse(value.importedAt))
        ) {
            return { pronta: true };
        }
    } catch {
        // Marcador ilegível ou incompleto nunca libera o aplicativo.
    }
    return { pronta: false, motivo: "marcador_invalido" };
}
