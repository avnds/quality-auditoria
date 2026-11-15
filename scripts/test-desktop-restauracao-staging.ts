import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { criarAreaImportacaoDesktop } from "../src/lib/desktop/area-importacao";
import { restaurarBackupEmStaging } from "../src/lib/desktop/restaurar-backup-staging";

const backup = {
    format: "quality-auditoria-logical-backup" as const,
    formatVersion: 1 as const,
    source: "production" as const,
    createdAt: new Date().toISOString(),
    schema: [
        { type: "table", name: "lojas", tableName: "lojas", sql: "CREATE TABLE lojas (id TEXT PRIMARY KEY, nome TEXT NOT NULL)" },
        { type: "table", name: "evidencias", tableName: "evidencias", sql: "CREATE TABLE evidencias (id TEXT PRIMARY KEY, loja_id TEXT REFERENCES lojas(id), arquivo_uri TEXT)" },
        { type: "table", name: "relatorios", tableName: "relatorios", sql: "CREATE TABLE relatorios (id TEXT PRIMARY KEY, loja_id TEXT REFERENCES lojas(id), arquivo_uri TEXT)" },
        { type: "index", name: "idx_evidencias_loja", tableName: "evidencias", sql: "CREATE INDEX idx_evidencias_loja ON evidencias (loja_id)" },
    ],
    tables: [
        { name: "lojas", createSql: "CREATE TABLE lojas (id TEXT PRIMARY KEY, nome TEXT NOT NULL)", columns: ["id", "nome"], rows: [["l1", "Loja teste"]] },
        { name: "evidencias", createSql: "CREATE TABLE evidencias (id TEXT PRIMARY KEY, loja_id TEXT REFERENCES lojas(id), arquivo_uri TEXT)", columns: ["id", "loja_id", "arquivo_uri"], rows: [["e1", "l1", "blob://e1"]] },
        { name: "relatorios", createSql: "CREATE TABLE relatorios (id TEXT PRIMARY KEY, loja_id TEXT REFERENCES lojas(id), arquivo_uri TEXT)", columns: ["id", "loja_id", "arquivo_uri"], rows: [["r1", "l1", "blob://r1"]] },
    ],
};

async function main() {
    const raiz = mkdtempSync(join(tmpdir(), "quality-restauracao-staging-"));
    try {
        const area = criarAreaImportacaoDesktop(raiz);
        const resultado = await restaurarBackupEmStaging(area, backup);
        assert.equal(resultado.totalTabelas, 3);
        assert.equal(resultado.totalRegistros, 3);
        assert.equal(existsSync(resultado.bancoArquivo), true);
        const db = createClient({ url: pathToFileURL(resultado.bancoArquivo).href });
        try {
            const lojas = await db.execute("SELECT nome FROM lojas WHERE id = 'l1'");
            assert.equal(lojas.rows[0]?.nome, "Loja teste");
            const indices = await db.execute("SELECT name FROM sqlite_schema WHERE type = 'index' AND name = 'idx_evidencias_loja'");
            assert.equal(indices.rows.length, 1);
            const fk = await db.execute("PRAGMA foreign_key_check");
            assert.equal(fk.rows.length, 0);
        } finally { await db.close(); }
        console.log("OK: backup fictício restaurado em SQLite temporário, com dados, índice e integridade.");

        await assert.rejects(() => restaurarBackupEmStaging(area, backup), /já existe/);
        console.log("OK: restauração não sobrescreve banco temporário existente.");

        const areaInvalida = criarAreaImportacaoDesktop(raiz);
        const invalido = structuredClone(backup);
        invalido.tables[1].rows[0][1] = "loja-inexistente";
        await assert.rejects(() => restaurarBackupEmStaging(areaInvalida, invalido), /referências estrangeiras|FOREIGN KEY/);
        console.log("OK: referências estrangeiras inválidas impedem restauração.");

        const areaSemTabela = criarAreaImportacaoDesktop(raiz);
        const semTabela = structuredClone(backup);
        semTabela.tables = semTabela.tables.filter(t => t.name !== "relatorios");
        await assert.rejects(() => restaurarBackupEmStaging(areaSemTabela, semTabela), /Tabelas ausentes|Tabela obrigatória/);
        console.log("OK: backup incompleto rejeitado antes de restaurar.");
        console.log("OK: nenhuma conexão com Turso, Blob ou produção.");
    } finally {
        try { rmSync(raiz, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
        catch (erro) {
            if (!["EPERM", "EBUSY", "EACCES"].includes((erro as NodeJS.ErrnoException).code ?? "")) throw erro;
            console.warn(`AVISO: Windows bloqueou limpeza temporária: ${raiz}`);
        }
    }
}
main().catch(erro => { console.error(erro); process.exitCode = 1; });
