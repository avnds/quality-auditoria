/**
 * Identifica o destino real da conexão, independentemente de NODE_ENV.
 * A execução local de Next.js NÃO implica banco offline: ela pode estar
 * conectada ao Turso de produção.
 *
 * O modo Desktop exige uma configuração explícita e uma URL file:.
 * Nenhuma URL remota desconhecida é aceita como ambiente offline.
 */
export type AmbienteBanco = "development" | "production" | "production_offline";

const HOST_DEV = "quality-auditoria-dev-qualityconsultoria.aws-us-east-1.turso.io";
const HOST_PROD = "quality-auditoria-qualityconsultoria.aws-us-east-1.turso.io";

export function identificarAmbienteBanco(): AmbienteBanco {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error("TURSO_DATABASE_URL não configurada.");

    if (process.env.QUALITY_RUNTIME === "desktop") {
        if (!url.startsWith("file:") || url.length <= "file:".length) {
            throw new Error("O Quality Desktop exige um banco SQLite local (file:).");
        }
        return "production_offline";
    }

    // Proteção adicional: o modo Cloud nunca deve aceitar um banco local
    // como se fosse DEV ou produção.
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error("URL do banco de dados inválida.");
    }

    if (parsed.protocol !== "libsql:" && parsed.protocol !== "https:") {
        throw new Error("Protocolo de banco não reconhecido.");
    }

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === HOST_DEV) return "development";
    if (hostname === HOST_PROD) return "production";

    throw new Error("Banco não reconhecido. Restauração bloqueada por segurança.");
}
