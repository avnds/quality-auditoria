import { createHash, randomUUID } from "node:crypto";
import type { ManifestoImportacaoDesktop } from "./manifesto-importacao";

export type DescritorSessaoExportacao = {
    formato: "quality-desktop-export-session";
    versao: 1;
    sessaoId: string;
    criadaEm: string;
    expiraEm: string;
    manifestoSha256: string;
};

/**
 * Identidade e prazo de uma exportação, vinculados ao manifesto exato.
 * Apenas descritor: não concede acesso e não cria snapshot imutável.
 * A validação de autorização e o armazenamento da sessão virão depois.
 */
export function criarDescritorSessaoExportacao(
    manifesto: ManifestoImportacaoDesktop,
    agora = new Date(),
    duracaoMinutos = 30
): DescritorSessaoExportacao {
    if (manifesto.formato !== "quality-desktop-import-manifest" || manifesto.versao !== 1 ||
        !Number.isFinite(agora.getTime()) ||
        !Number.isSafeInteger(duracaoMinutos) || duracaoMinutos < 1 || duracaoMinutos > 60) {
        throw new Error("Parâmetros de sessão inválidos.");
    }
    const expira = agora.getTime() + duracaoMinutos * 60_000;
    return {
        formato: "quality-desktop-export-session",
        versao: 1,
        sessaoId: randomUUID(),
        criadaEm: agora.toISOString(),
        expiraEm: new Date(expira).toISOString(),
        manifestoSha256: createHash("sha256").update(JSON.stringify(manifesto), "utf8").digest("hex"),
    };
}

export function validarDescritorSessaoExportacao(
    sessao: DescritorSessaoExportacao,
    manifesto: ManifestoImportacaoDesktop,
    agora = new Date()
): boolean {
    if (sessao.formato !== "quality-desktop-export-session" || sessao.versao !== 1 ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(sessao.sessaoId) ||
        !/^[a-f0-9]{64}$/.test(sessao.manifestoSha256) ||
        !Number.isFinite(agora.getTime())) return false;
    const inicio = Date.parse(sessao.criadaEm);
    const fim = Date.parse(sessao.expiraEm);
    if (!Number.isFinite(inicio) || !Number.isFinite(fim) ||
        inicio > agora.getTime() || fim <= agora.getTime() ||
        fim - inicio < 60_000 || fim - inicio > 3_600_000) return false;
    const esperado = createHash("sha256").update(JSON.stringify(manifesto), "utf8").digest("hex");
    return sessao.manifestoSha256 === esperado;
}
