import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createWriteStream, existsSync, lstatSync, mkdirSync, realpathSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { IntegridadeEsperada } from "./conferir-integridade-esperada";

/**
 * Grava um arquivo de staging a partir de bytes recebidos, sem buffering integral.
 * Exige diretório staging pré-existente, real e não simbólico.
 * Não substitui arquivos existentes e não ativa a instalação.
 */
export async function gravarArquivoStaging(
    raizStaging: string,
    destinoRelativo: string,
    stream: ReadableStream<Uint8Array>,
    esperado: IntegridadeEsperada
): Promise<{ tamanhoBytes: number; sha256: string }> {
    const pastaEsperada = esperado.tipo === "evidencia" ? "evidencias" : "relatorios";
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(esperado.registroId) ||
        destinoRelativo !== `${pastaEsperada}/${esperado.registroId}` ||
        !Number.isSafeInteger(esperado.tamanhoBytes) || esperado.tamanhoBytes <= 0 ||
        !/^[a-f0-9]{64}$/.test(esperado.sha256)) {
        throw new Error("Destino ou integridade esperada inválidos.");
    }
    if (lstatSync(raizStaging).isSymbolicLink() || !statSync(raizStaging).isDirectory()) {
        throw new Error("Diretório de staging inválido.");
    }
    const raiz = realpathSync(raizStaging);
    const pasta = resolve(raiz, pastaEsperada);
    const trecho = relative(raiz, pasta);
    if (!trecho || trecho.startsWith(".." + sep) || isAbsolute(trecho)) {
        throw new Error("Destino fora do staging.");
    }
    if (existsSync(pasta)) {
        if (lstatSync(pasta).isSymbolicLink() || !statSync(pasta).isDirectory() ||
            realpathSync(pasta) !== pasta) throw new Error("Pasta de destino inválida.");
    } else {
        mkdirSync(pasta);
    }
    const destino = resolve(pasta, esperado.registroId);
    if (existsSync(destino)) throw new Error("Arquivo já existe no staging.");

    const temporario = resolve(pasta, `.${randomUUID()}.part`);
    const hash = createHash("sha256");
    let tamanhoBytes = 0;
    try {
        const leitor = Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0]);
        const escritor = createWriteStream(temporario, { flags: "wx", mode: 0o600 });
        await pipeline(leitor, new Writable({
            write(chunk: Buffer, _encoding, callback) {
                tamanhoBytes += chunk.length;
                if (!Number.isSafeInteger(tamanhoBytes) || tamanhoBytes > esperado.tamanhoBytes) {
                    callback(new Error("Arquivo excedeu o tamanho esperado."));
                    return;
                }
                hash.update(chunk);
                if (!escritor.write(chunk)) escritor.once("drain", callback);
                else callback();
            },
            final(callback) { escritor.end(callback); },
            destroy(erro, callback) { escritor.destroy(); callback(erro); },
        }));
        const calculado = hash.digest("hex");
        if (tamanhoBytes !== esperado.tamanhoBytes ||
            !timingSafeEqual(Buffer.from(calculado, "hex"), Buffer.from(esperado.sha256, "hex"))) {
            throw new Error("Integridade do arquivo transferido não confere.");
        }
        if (existsSync(destino)) throw new Error("Arquivo já existe no staging.");
        renameSync(temporario, destino);
        return { tamanhoBytes, sha256: calculado };
    } catch (erro) {
        throw erro;
    } finally {
        rmSync(temporario, { force: true });
    }
}
