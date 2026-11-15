import { createHash } from "node:crypto";
import { createReadStream, lstatSync, realpathSync, statSync } from "node:fs";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";
import type { PlanoTransferencia } from "./plano-transferencia";
import { transferenciaCompleta } from "./plano-transferencia";

/**
 * Confere arquivos reais em um diretório de staging controlado pelo importador.
 * Nunca aceita caminhos absolutos, travessia ou links simbólicos.
 * Não acessa rede, Turso ou Blob.
 */
export async function conferirArquivosTransferidos(
    plano: PlanoTransferencia,
    diretorioStaging: string
): Promise<boolean> {
    if (!transferenciaCompleta(plano)) return false;

    try {
        const raiz = realpathSync(diretorioStaging);
        if (!statSync(raiz).isDirectory()) return false;
        const destinos = new Set<string>();

        for (const arquivo of plano.arquivos) {
            const relativo = arquivo.destinoRelativo;
            if (!/^(evidencias|relatorios)\/[A-Za-z0-9_-]{1,128}$/.test(relativo)) return false;
            if ((arquivo.tipo === "evidencia" && !relativo.startsWith("evidencias/")) ||
                (arquivo.tipo === "relatorio" && !relativo.startsWith("relatorios/"))) return false;
            if (destinos.has(relativo)) return false;
            destinos.add(relativo);

            const destino = resolve(raiz, relativo);
            const trecho = relative(raiz, destino);
            if (!trecho || trecho.startsWith(".." + sep) || trecho === ".." || isAbsolute(trecho)) return false;

            const pasta = resolve(raiz, relativo.split("/")[0]);
            if (lstatSync(pasta).isSymbolicLink() || !statSync(pasta).isDirectory()) return false;
            if (realpathSync(pasta) !== pasta) return false;
            if (lstatSync(destino).isSymbolicLink() || !statSync(destino).isFile()) return false;
            if (realpathSync(destino) !== destino) return false;

            const tamanho = statSync(destino).size;
            if (tamanho !== arquivo.tamanhoBytes) return false;

            const hash = createHash("sha256");
            await pipeline(
                createReadStream(destino),
                new Writable({
                    write(chunk: Buffer, _encoding, callback) {
                        hash.update(chunk);
                        callback();
                    },
                })
            );
            if (hash.digest("hex") !== arquivo.sha256) return false;
        }
        return true;
    } catch {
        return false;
    }
}
