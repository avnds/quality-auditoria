import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, lstatSync, mkdirSync, realpathSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { join, relative, resolve, sep } from "node:path";

export type RegistroCopiaRecuperacao = {
    formato: "quality-desktop-recovery-copy";
    versao: 1;
    criadaEm: string;
    arquivos: { caminho: string; tamanhoBytes: number; sha256: string }[];
};

const caminhos = ["database", "arquivos", "evidencias", "instalacao.json"] as const;
const dentro = (raiz: string, alvo: string) => {
    const rel = relative(raiz, alvo);
    return rel !== "" && rel !== ".." && !rel.startsWith(".." + sep) && !rel.startsWith("/") && !rel.startsWith("\\");
};

function listarArquivos(raiz: string, caminho: string, encontrados: string[]): void {
    const st = lstatSync(caminho);
    if (st.isSymbolicLink()) throw new Error("Links simbólicos não são aceitos na recuperação.");
    if (st.isFile()) {
        if (!dentro(raiz, caminho)) throw new Error("Arquivo fora da instalação.");
        encontrados.push(caminho);
        return;
    }
    if (!st.isDirectory()) throw new Error("Tipo de arquivo não permitido.");
    for (const nome of readdirSync(caminho)) listarArquivos(raiz, join(caminho, nome), encontrados);
}

/**
 * Copia arquivos da instalação anterior para pasta isolada, confere SHA-256
 * de origem e destino, e só então publica a cópia de recuperação.
 * Não interrompe escrita concorrente: o chamador DEVE parar o aplicativo,
 * fechar conexões SQLite e manter exclusividade até terminar a ativação.
 * Não restaura nem substitui a instalação ativa.
 */
export async function criarCopiaRecuperacaoDesktop(
    raizDados: string,
    destinoBackups: string
): Promise<{ pasta: string; registro: RegistroCopiaRecuperacao }> {
    const raiz = resolve(raizDados);
    const backups = resolve(destinoBackups);
    if (!existsSync(raiz) || lstatSync(raiz).isSymbolicLink() ||
        !lstatSync(raiz).isDirectory() || realpathSync(raiz) !== raiz) {
        throw new Error("Raiz de instalação insegura.");
    }
    if (!dentro(raiz, backups)) throw new Error("Backups devem ficar dentro da raiz controlada.");
    if (!existsSync(backups)) mkdirSync(backups, { recursive: true, mode: 0o700 });
    if (lstatSync(backups).isSymbolicLink() || realpathSync(backups) !== backups) {
        throw new Error("Diretório de backups inseguro.");
    }
    const arquivos: string[] = [];
    for (const nome of caminhos) {
        const caminho = join(raiz, nome);
        if (existsSync(caminho)) listarArquivos(raiz, caminho, arquivos);
    }
    if (!arquivos.length || !existsSync(join(raiz, "database", "quality.sqlite")) ||
        !existsSync(join(raiz, "instalacao.json"))) {
        throw new Error("Instalação anterior incompleta; recuperação automática bloqueada.");
    }
    const id = randomUUID();
    const temporario = join(backups, id + ".part");
    const definitivo = join(backups, id);
    mkdirSync(temporario, { mode: 0o700 });
    const registro: RegistroCopiaRecuperacao = {
        formato: "quality-desktop-recovery-copy", versao: 1,
        criadaEm: new Date().toISOString(), arquivos: [],
    };
    try {
        for (const origem of arquivos) {
            const rel = relative(raiz, origem);
            const destino = join(temporario, rel);
            mkdirSync(resolve(destino, ".."), { recursive: true, mode: 0o700 });
            const hashOrigem = createHash("sha256");
            let tamanho = 0;
            for await (const parte of createReadStream(origem)) {
                const bytes = parte as Buffer;
                hashOrigem.update(bytes);
                tamanho += bytes.length;
                if (!Number.isSafeInteger(tamanho)) throw new Error("Arquivo excede limite de tamanho.");
            }
            await pipeline(createReadStream(origem), createWriteStream(destino, { flags: "wx", mode: 0o600 }));
            const hashDestino = createHash("sha256");
            let tamanhoDestino = 0;
            for await (const parte of createReadStream(destino)) {
                const bytes = parte as Buffer;
                hashDestino.update(bytes);
                tamanhoDestino += bytes.length;
            }
            const sha256 = hashOrigem.digest("hex");
            if (tamanho !== tamanhoDestino || sha256 !== hashDestino.digest("hex") ||
                statSync(origem).size !== tamanho) {
                throw new Error("Arquivo mudou durante a cópia de recuperação.");
            }
            registro.arquivos.push({ caminho: rel.replaceAll("\\", "/"), tamanhoBytes: tamanho, sha256 });
        }
        writeFileSync(join(temporario, "registro-recuperacao.json"), JSON.stringify(registro, null, 2), { flag: "wx", mode: 0o600 });
        renameSync(temporario, definitivo);
        return { pasta: definitivo, registro };
    } catch (erro) {
        rmSync(temporario, { recursive: true, force: true });
        throw erro;
    }
}
