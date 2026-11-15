import { createClient, type InValue } from "@libsql/client";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { LogicalDatabaseBackup } from "../db/backup";
import type { AreaImportacaoDesktop } from "./area-importacao";
import { validarBackupParaStaging } from "./validar-backup-staging";

type Valor = LogicalDatabaseBackup["tables"][number]["rows"][number][number];

function decodificar(valor: Valor): InValue {
    if (valor === null || typeof valor === "string") return valor;
    if (typeof valor === "number") {
        if (!Number.isFinite(valor)) throw new Error("Número inválido no backup.");
        return valor;
    }
    if (typeof valor === "boolean") return valor ? 1 : 0;
    if (valor.$type === "bigint" && /^-?\d+$/.test(valor.value)) return BigInt(valor.value);
    if (valor.$type === "blob" &&
        /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(valor.base64)) {
        return new Uint8Array(Buffer.from(valor.base64, "base64"));
    }
    throw new Error("Valor de backup inválido.");
}

/**
 * Restaura exclusivamente um banco novo dentro de uma área de importação.
 * Não abre, apaga nem substitui o banco operacional do Desktop.
 */
export async function restaurarBackupEmStaging(
    area: AreaImportacaoDesktop,
    backup: unknown
): Promise<{ bancoArquivo: string; totalTabelas: number; totalRegistros: number }> {
    validarBackupParaStaging(backup);
    if (!existsSync(area.raiz) || lstatSync(area.raiz).isSymbolicLink() ||
        !existsSync(area.banco) || lstatSync(area.banco).isSymbolicLink() ||
        realpathSync(area.banco) !== resolve(area.banco) ||
        resolve(area.banco) !== join(resolve(area.raiz), "banco")) {
        throw new Error("Área temporária de banco inválida.");
    }
    const bancoArquivo = join(area.banco, "quality.sqlite");
    if (existsSync(bancoArquivo) || existsSync(bancoArquivo + "-wal") ||
        existsSync(bancoArquivo + "-shm")) {
        throw new Error("O banco temporário já existe; restauração bloqueada.");
    }
    const db = createClient({ url: pathToFileURL(bancoArquivo).href });
    let totalRegistros = 0;
    try {
        await db.execute("PRAGMA foreign_keys = ON");
        const transacao = await db.transaction("write");
        try {
            await transacao.execute("PRAGMA defer_foreign_keys = ON");
            for (const tabela of backup.tables) await transacao.execute(tabela.createSql);
            for (const tabela of backup.tables) {
                const nome = '"' + tabela.name + '"';
                const colunas = tabela.columns.map(c => '"' + c + '"').join(", ");
                const parametros = tabela.columns.map(() => "?").join(", ");
                const sql = `INSERT INTO ${nome} (${colunas}) VALUES (${parametros})`;
                for (const linha of tabela.rows) {
                    await transacao.execute({ sql, args: linha.map(decodificar) });
                    totalRegistros++;
                }
            }
            for (const indice of backup.schema.filter(item => item.type === "index")) {
                await transacao.execute(indice.sql);
            }
            const chaves = await transacao.execute("PRAGMA foreign_key_check");
            if (chaves.rows.length) throw new Error("Backup contém referências estrangeiras inválidas.");
            for (const tabela of backup.tables) {
                const contagem = await transacao.execute(`SELECT COUNT(*) AS total FROM "${tabela.name}"`);
                if (Number(contagem.rows[0]?.total ?? -1) !== tabela.rows.length) {
                    throw new Error(`Contagem de registros divergente: ${tabela.name}.`);
                }
            }
            await transacao.commit();
        } catch (erro) {
            await transacao.rollback();
            throw erro;
        } finally {
            await transacao.close();
        }
        const integridade = await db.execute("PRAGMA integrity_check");
        if (integridade.rows.length !== 1 || String(integridade.rows[0]?.integrity_check) !== "ok") {
            throw new Error("Falha na integridade do banco SQLite temporário.");
        }
        return { bancoArquivo, totalTabelas: backup.tables.length, totalRegistros };
    } finally {
        await db.close();
    }
}
