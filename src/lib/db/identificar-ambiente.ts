/**
 * Identifica o destino real da conexão, independentemente de NODE_ENV.
 * Uma execução local pode estar conectada ao banco de produção.
 *
 * Política conservadora: somente os dois bancos conhecidos são aceitos.
 * Qualquer URL desconhecida bloqueia operações de restauração.
 */
export type AmbienteBanco = "development" | "production";

const HOST_DEV = "quality-auditoria-dev-qualityconsultoria.aws-us-east-1.turso.io";
const HOST_PROD = "quality-auditoria-qualityconsultoria.aws-us-east-1.turso.io";

export function identificarAmbienteBanco(): AmbienteBanco {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error("TURSO_DATABASE_URL não configurada.");

    let hostname: string;
    try {
        hostname = new URL(url).hostname.toLowerCase();
    } catch {
        throw new Error("URL do banco de dados inválida.");
    }

    if (hostname === HOST_DEV) return "development";
    if (hostname === HOST_PROD) return "production";

    throw new Error("Banco não reconhecido. Restauração bloqueada por segurança.");
}
