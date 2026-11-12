import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { obterCaminhosDesktop } from "./storage";

const idValido = /^[a-zA-Z0-9_-]{1,128}$/;
export function caminhoEvidenciaLocal(id: string): string {
    if (!idValido.test(id)) throw new Error("Identificador de evidência inválido.");
    return join(obterCaminhosDesktop().root, "arquivos", "evidencias", id);
}

/** Salva a imagem em arquivo temporário e publica por rename local. */
export async function salvarEvidenciaLocal(id: string, arquivo: File): Promise<string> {
    const destino = caminhoEvidenciaLocal(id);
    const pasta = join(obterCaminhosDesktop().root, "arquivos", "evidencias");
    mkdirSync(pasta, { recursive: true });
    const temporario = join(pasta, randomUUID() + ".part");
    try {
        writeFileSync(temporario, Buffer.from(await arquivo.arrayBuffer()), { flag: "wx", mode: 0o600 });
        if (existsSync(destino)) throw new Error("Evidência local já existe.");
        renameSync(temporario, destino);
        return `desktop:evidencia:${id}`;
    } finally {
        if (existsSync(temporario)) rmSync(temporario, { force: true });
    }
}

/** Exclusão somente para arquivos da área Desktop, nunca URLs Blob. */
export function removerEvidenciaLocal(id: string): void {
    const caminho = caminhoEvidenciaLocal(id);
    if (existsSync(caminho)) rmSync(caminho, { force: true });
}

/** Substitui os bytes de uma evidência existente sem alterar seu ID. */
export async function substituirEvidenciaLocal(id: string, arquivo: File): Promise<string> {
    const destino = caminhoEvidenciaLocal(id);
    const pasta = join(obterCaminhosDesktop().root, "arquivos", "evidencias");
    mkdirSync(pasta, { recursive: true });
    const temporario = join(pasta, randomUUID() + ".part");
    try {
        writeFileSync(temporario, Buffer.from(await arquivo.arrayBuffer()), { flag: "wx", mode: 0o600 });
        renameSync(temporario, destino);
        return `desktop:evidencia:${id}`;
    } finally {
        if (existsSync(temporario)) rmSync(temporario, { force: true });
    }
}
