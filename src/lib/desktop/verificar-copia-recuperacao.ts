import { createHash } from "node:crypto";
import { createReadStream, existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type { RegistroCopiaRecuperacao } from "./copia-recuperacao";

export type ResultadoVerificacaoRecuperacao = {
    integra: boolean;
    motivo: string;
    totalArquivos: number;
};

function dentro(raiz: string, caminho: string): boolean {
    const rel = relative(raiz, caminho);
    return rel !== "" && rel !== ".." && !rel.startsWith(".." + sep) &&
        !rel.startsWith("/") && !rel.startsWith("\\");
}

async function hashArquivo(caminho: string): Promise<{ tamanhoBytes: number; sha256: string }> {
    const hash = createHash("sha256");
    let tamanhoBytes = 0;
    for await (const parte of createReadStream(caminho)) {
        const bytes = parte as Buffer;
        tamanhoBytes += bytes.length;
        if (!Number.isSafeInteger(tamanhoBytes)) throw new Error("Tamanho de arquivo inválido.");
        hash.update(bytes);
    }
    return { tamanhoBytes, sha256: hash.digest("hex") };
}

/**
 * Verifica a cópia de recuperação sem modificar arquivos.
 * NÃO autoriza rollback por si só: operação exige exclusividade, diário
 * consistente e aplicativo parado. Hashes no registro não autenticam origem.
 */
export async function verificarCopiaRecuperacaoDesktop(pastaCopia: string): Promise<ResultadoVerificacaoRecuperacao> {
    const falha = (motivo: string): ResultadoVerificacaoRecuperacao => ({
        integra: false, motivo, totalArquivos: 0,
    });
    try {
        const raiz = resolve(pastaCopia);
        if (!existsSync(raiz) || lstatSync(raiz).isSymbolicLink() ||
            !lstatSync(raiz).isDirectory() || realpathSync(raiz) !== raiz) {
            return falha("Diretório da cópia inseguro ou ausente.");
        }
        const registroArquivo = join(raiz, "registro-recuperacao.json");
        if (!existsSync(registroArquivo) || lstatSync(registroArquivo).isSymbolicLink()) {
            return falha("Registro de recuperação ausente ou inseguro.");
        }
        const registro = JSON.parse(readFileSync(registroArquivo, "utf8")) as RegistroCopiaRecuperacao;
        if (registro.formato !== "quality-desktop-recovery-copy" || registro.versao !== 1 ||
            !Array.isArray(registro.arquivos) || registro.arquivos.length === 0) {
            return falha("Formato de recuperação inválido.");
        }
        const vistos = new Set<string>();
        for (const item of registro.arquivos) {
            if (!item || typeof item.caminho !== "string" ||
                !/^(database|evidencias|arquivos)\/[a-zA-Z0-9_./-]+$|^instalacao\.json$/.test(item.caminho) ||
                item.caminho.split("/").some(p => p === "." || p === ".." || p === "") ||
                vistos.has(item.caminho) || !Number.isSafeInteger(item.tamanhoBytes) ||
                item.tamanhoBytes < 0 || !/^[0-9a-f]{64}$/.test(item.sha256)) {
                return falha("Entrada de recuperação inválida ou duplicada.");
            }
            vistos.add(item.caminho);
            const arquivo = resolve(raiz, ...item.caminho.split("/"));
            if (!dentro(raiz, arquivo) || !existsSync(arquivo)) return falha("Arquivo recuperável ausente.");
            let atual = arquivo;
            while (atual !== raiz) {
                if (lstatSync(atual).isSymbolicLink()) return falha("Link simbólico detectado.");
                atual = resolve(atual, "..");
            }
            if (!lstatSync(arquivo).isFile()) return falha("Arquivo recuperável inválido.");
            const hash = await hashArquivo(arquivo);
            if (hash.tamanhoBytes !== item.tamanhoBytes || hash.sha256 !== item.sha256) {
                return falha("Arquivo recuperável alterado ou corrompido.");
            }
        }
        if (!vistos.has("database/quality.sqlite") || !vistos.has("instalacao.json")) {
            return falha("Banco ou marcador não estão presentes na cópia.");
        }
        return { integra: true, motivo: "Cópia recuperável íntegra.", totalArquivos: vistos.size };
    } catch {
        return falha("Falha ao ler ou verificar a cópia recuperável.");
    }
}
