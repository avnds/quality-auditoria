import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { join, resolve, relative, isAbsolute, sep } from "node:path";

export type AreaImportacaoDesktop = {
    id: string;
    raiz: string;
    arquivos: string;
    banco: string;
};

/**
 * Prepara uma importação isolada. Não cria banco operacional,
 * não altera instalação existente e não escreve marcador de ativação.
 */
export function criarAreaImportacaoDesktop(raizDados: string): AreaImportacaoDesktop {
    if (!existsSync(raizDados) || lstatSync(raizDados).isSymbolicLink() ||
        !lstatSync(raizDados).isDirectory()) {
        throw new Error("Raiz de dados Desktop inexistente ou insegura.");
    }
    const raizReal = realpathSync(raizDados);
    const importacoes = join(raizReal, "importacoes");
    if (existsSync(importacoes)) {
        if (lstatSync(importacoes).isSymbolicLink() ||
            !lstatSync(importacoes).isDirectory() ||
            realpathSync(importacoes) !== importacoes) {
            throw new Error("Diretório de importações inseguro.");
        }
    } else {
        mkdirSync(importacoes, { mode: 0o700 });
    }
    const id = randomUUID();
    const raiz = resolve(importacoes, id);
    const trecho = relative(importacoes, raiz);
    if (!trecho || trecho === ".." || trecho.startsWith(".." + sep) ||
        isAbsolute(trecho)) throw new Error("Caminho de importação inválido.");
    mkdirSync(raiz, { mode: 0o700 });
    const arquivos = join(raiz, "arquivos");
    const banco = join(raiz, "banco");
    mkdirSync(arquivos, { mode: 0o700 });
    mkdirSync(banco, { mode: 0o700 });
    return { id, raiz, arquivos, banco };
}

/**
 * Remove somente uma área isolada identificada por UUID, nunca o diretório
 * principal nem a instalação ativa. A chamada é explícita.
 */
export function descartarAreaImportacaoDesktop(
    raizDados: string,
    area: AreaImportacaoDesktop
): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(area.id)) {
        throw new Error("Identificador de importação inválido.");
    }
    const raizReal = realpathSync(raizDados);
    const esperado = resolve(raizReal, "importacoes", area.id);
    if (resolve(area.raiz) !== esperado || !existsSync(esperado) ||
        lstatSync(esperado).isSymbolicLink() || realpathSync(esperado) !== esperado ||
        resolve(area.arquivos) !== join(esperado, "arquivos") ||
        resolve(area.banco) !== join(esperado, "banco")) {
        throw new Error("Área de importação não corresponde à raiz informada.");
    }
    rmSync(esperado, { recursive: true, force: false });
}
