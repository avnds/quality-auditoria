import { randomUUID } from "node:crypto";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type BloqueioAtivacaoDesktop = {
    arquivo: string;
    identificador: string;
    criadoEm: string;
};

/**
 * Exclusividade cooperativa para o processo de ativação.
 * Não encerra processos nem fecha conexões SQLite: o orquestrador
 * precisa garantir isso separadamente. Locks antigos não são removidos
 * automaticamente, para não assumir que uma operação em curso terminou.
 */
export function adquirirBloqueioAtivacaoDesktop(raizDados: string): BloqueioAtivacaoDesktop {
    const raiz = resolve(raizDados);
    if (!existsSync(raiz) || lstatSync(raiz).isSymbolicLink() ||
        !lstatSync(raiz).isDirectory() || realpathSync(raiz) !== raiz) {
        throw new Error("Diretório de dados Desktop inválido.");
    }
    const controle = join(raiz, "controle");
    if (!existsSync(controle)) mkdirSync(controle, { mode: 0o700 });
    if (lstatSync(controle).isSymbolicLink() || !lstatSync(controle).isDirectory() ||
        realpathSync(controle) !== controle) {
        throw new Error("Diretório de controle inseguro.");
    }
    const arquivo = join(controle, "ativacao.lock");
    const bloqueio: BloqueioAtivacaoDesktop = {
        arquivo, identificador: randomUUID(), criadoEm: new Date().toISOString(),
    };
    let fd: number;
    try {
        fd = openSync(arquivo, "wx", 0o600);
    } catch (erro) {
        if ((erro as NodeJS.ErrnoException).code === "EEXIST") {
            throw new Error("Já existe uma ativação em andamento ou pendente de recuperação.");
        }
        throw erro;
    }
    try {
        writeFileSync(fd, JSON.stringify({ identificador: bloqueio.identificador, criadoEm: bloqueio.criadoEm }), "utf8");
    } catch (erro) {
        closeSync(fd);
        throw erro;
    }
    closeSync(fd);
    return bloqueio;
}

/**
 * Libera apenas o lock cujo identificador coincide com o token adquirido.
 * Nunca apaga um lock de outra operação. O arquivo pode exigir recuperação
 * manual após falha do processo; não remover sem verificar o estado.
 */
export function liberarBloqueioAtivacaoDesktop(bloqueio: BloqueioAtivacaoDesktop): void {
    if (!existsSync(bloqueio.arquivo) || lstatSync(bloqueio.arquivo).isSymbolicLink()) {
        throw new Error("Bloqueio de ativação ausente ou inseguro.");
    }
    let registro: unknown;
    try { registro = JSON.parse(readFileSync(bloqueio.arquivo, "utf8")); }
    catch { throw new Error("Registro de bloqueio inválido."); }
    if (!registro || typeof registro !== "object" ||
        !("identificador" in registro) || registro.identificador !== bloqueio.identificador) {
        throw new Error("Bloqueio pertence a outra operação.");
    }
    unlinkSync(bloqueio.arquivo);
}
