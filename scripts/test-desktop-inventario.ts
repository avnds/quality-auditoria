import { strict as assert } from "node:assert";
import { inventariarArquivosBlob } from "../src/lib/desktop/inventario-blob";
import type { LogicalDatabaseBackup } from "../src/lib/db/backup";

const backup: LogicalDatabaseBackup = {
    format: "quality-auditoria-logical-backup",
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    source: "production",
    schema: [],
    tables: [
        {
            name: "evidencias",
            createSql: "CREATE TABLE evidencias (id TEXT, arquivo_uri TEXT)",
            columns: ["id", "arquivo_uri"],
            rows: [
                ["evidencia-1", "https://exemplo.invalid/arquivo-1"],
                ["evidencia-2", "https://exemplo.invalid/arquivo-2"],
            ],
        },
        {
            name: "relatorios",
            createSql: "CREATE TABLE relatorios (id TEXT, arquivo_uri TEXT)",
            columns: ["id", "arquivo_uri"],
            rows: [
                ["relatorio-1", "https://exemplo.invalid/relatorio-1"],
                ["relatorio-sem-pdf", null],
            ],
        },
    ],
};

const inventario = inventariarArquivosBlob(backup);
assert.equal(inventario.totalEvidencias, 2);
assert.equal(inventario.totalRelatorios, 1);
assert.equal(inventario.arquivos.length, 3);
assert.equal(inventario.arquivos[0].destinoRelativo, "evidencias/evidencia-1");
assert.equal(inventario.arquivos[2].destinoRelativo, "relatorios/relatorio-1");
console.log("OK: inventário identifica evidências e relatórios existentes.");

const duplicado = structuredClone(backup);
duplicado.tables[0].rows.push(["evidencia-1", "https://exemplo.invalid/outro"]);
assert.throws(() => inventariarArquivosBlob(duplicado), /duplicado/);
console.log("OK: identificadores duplicados são rejeitados.");

const semTabela = structuredClone(backup);
semTabela.tables = semTabela.tables.filter((t) => t.name !== "relatorios");
assert.throws(() => inventariarArquivosBlob(semTabela), /obrigatória/);
console.log("OK: ausência de tabela obrigatória é rejeitada.");

console.log("OK: teste não acessou rede, Turso ou Blob.");
