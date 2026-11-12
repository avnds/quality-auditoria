import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, openSync, closeSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type EtapaPublicacaoDesktop =
    | "preparada"
    | "copia_recuperacao_validada"
    | "publicacao_iniciada"
    | "publicacao_concluida"
    | "verificacao_final_concluida";

export type DiarioPublicacaoDesktop = {
    formato: "quality-desktop-publication-journal";
    versao: 1;
    operacaoId: string;
    importacaoId: string;
    etapa: EtapaPublicacaoDesktop;
    atualizadoEm: string;
    pastaRecuperacao: string | null;
};

const etapas: EtapaPublicacaoDesktop[] = [
    "preparada", "copia_recuperacao_validada", "publicacao_iniciada",
    "publicacao_concluida", "verificacao_final_concluida",
];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function caminhoDiario(raizDados: string): string {
    const raiz = resolve(raizDados);
    if (!existsSync(raiz) || lstatSync(raiz).isSymbolicLink() ||
        !lstatSync(raiz).isDirectory() || realpathSync(raiz) !== raiz) {
        throw new Error("Raiz Desktop insegura.");
    }
    const controle = join(raiz, "controle");
    if (!existsSync(controle)) mkdirSync(controle, { mode: 0o700 });
    if (lstatSync(controle).isSymbolicLink() || !lstatSync(controle).isDirectory() ||
        realpathSync(controle) !== controle) throw new Error("Diretório de controle inseguro.");
    return join(controle, "publicacao.json");
}

function validar(dado: unknown): DiarioPublicacaoDesktop {
    if (!dado || typeof dado !== "object") throw new Error("Diário inválido.");
    const d = dado as Record<string, unknown>;
    if (d.formato !== "quality-desktop-publication-journal" || d.versao !== 1 ||
        typeof d.operacaoId !== "string" || !uuid.test(d.operacaoId) ||
        typeof d.importacaoId !== "string" || !uuid.test(d.importacaoId) ||
        !etapas.includes(d.etapa as EtapaPublicacaoDesktop) ||
        typeof d.atualizadoEm !== "string" || !Number.isFinite(Date.parse(d.atualizadoEm)) ||
        !(d.pastaRecuperacao === null || typeof d.pastaRecuperacao === "string")) {
        throw new Error("Diário de publicação inválido.");
    }
    return d as DiarioPublicacaoDesktop;
}

/** Um diário pendente bloqueia o início de outra publicação. */
export function iniciarDiarioPublicacaoDesktop(raizDados: string, importacaoId: string): DiarioPublicacaoDesktop {
    if (!uuid.test(importacaoId)) throw new Error("Importação inválida.");
    const arquivo = caminhoDiario(raizDados);
    const registro: DiarioPublicacaoDesktop = {
        formato: "quality-desktop-publication-journal", versao: 1,
        operacaoId: randomUUID(), importacaoId, etapa: "preparada",
        atualizadoEm: new Date().toISOString(), pastaRecuperacao: null,
    };
    const fd = openSync(arquivo, "wx", 0o600);
    try { writeFileSync(fd, JSON.stringify(registro)); }
    finally { closeSync(fd); }
    return registro;
}

export function lerDiarioPublicacaoDesktop(raizDados: string): DiarioPublicacaoDesktop | null {
    const arquivo = caminhoDiario(raizDados);
    if (!existsSync(arquivo)) return null;
    if (lstatSync(arquivo).isSymbolicLink()) throw new Error("Diário inseguro.");
    return validar(JSON.parse(readFileSync(arquivo, "utf8")));
}

/**
 * Avança uma etapa sem saltos nem regressões, usando substituição por rename
 * no mesmo diretório. Exige exclusividade externa pelo lock de ativação.
 * Não executa publicação, rollback ou restauração.
 */
export function avancarDiarioPublicacaoDesktop(
    raizDados: string, operacaoId: string, etapa: EtapaPublicacaoDesktop,
    pastaRecuperacao?: string
): DiarioPublicacaoDesktop {
    const arquivo = caminhoDiario(raizDados);
    const atual = lerDiarioPublicacaoDesktop(raizDados);
    if (!atual || atual.operacaoId !== operacaoId) throw new Error("Operação do diário não corresponde.");
    if (etapas.indexOf(etapa) !== etapas.indexOf(atual.etapa) + 1) {
        throw new Error("Transição de publicação inválida.");
    }
    if (etapa === "copia_recuperacao_validada" && !pastaRecuperacao) {
        throw new Error("Cópia recuperável obrigatória nesta etapa.");
    }
    const proximo: DiarioPublicacaoDesktop = {
        ...atual, etapa, atualizadoEm: new Date().toISOString(),
        pastaRecuperacao: pastaRecuperacao ?? atual.pastaRecuperacao,
    };
    const temporario = arquivo + "." + randomUUID() + ".part";
    try {
        const fd = openSync(temporario, "wx", 0o600);
        try { writeFileSync(fd, JSON.stringify(proximo)); }
        finally { closeSync(fd); }
        renameSync(temporario, arquivo);
    } finally {
        if (existsSync(temporario)) rmSync(temporario, { force: true });
    }
    return proximo;
}
