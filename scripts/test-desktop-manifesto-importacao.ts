import { strict as assert } from "node:assert";
import { prepararManifestoImportacaoDesktop } from "../src/lib/desktop/manifesto-importacao";
import type { LogicalDatabaseBackup } from "../src/lib/db/backup";

function criarBackup(source: LogicalDatabaseBackup["source"]): LogicalDatabaseBackup {
    return {
        format: "quality-auditoria-logical-backup",
        formatVersion: 1,
        createdAt: "2026-11-12T12:00:00.000Z",
        source,
        schema: [],
        tables: [
            {
                name: "evidencias",
                createSql: "CREATE TABLE evidencias (id TEXT, arquivo_uri TEXT)",
                columns: ["id", "arquivo_uri"],
                rows: [["e1", "https://exemplo.invalid/e1"], ["e2", null]],
            },
            {
                name: "relatorios",
                createSql: "CREATE TABLE relatorios (id TEXT, arquivo_uri TEXT)",
                columns: ["id", "arquivo_uri"],
                rows: [["r1", "https://exemplo.invalid/r1"]],
            },
        ],
    };
}

const direto = prepararManifestoImportacaoDesktop(criarBackup("production"), "producao_direta");
assert.equal(direto.origem, "production");
assert.equal(direto.modalidade, "producao_direta");
assert.equal(direto.totalArquivos, 2);
assert.equal(direto.inventario.totalEvidencias, 1);
assert.equal(direto.inventario.totalRelatorios, 1);
console.log("OK: importação direta inventaria os arquivos da produção.");

const pacote = prepararManifestoImportacaoDesktop(criarBackup("production_offline"), "pacote_backup");
assert.equal(pacote.origem, "production_offline");
assert.equal(pacote.totalArquivos, 2);
console.log("OK: backup offline é aceito como pacote.");

assert.throws(
    () => prepararManifestoImportacaoDesktop(criarBackup("production_offline"), "producao_direta"),
    /produção online/
);
console.log("OK: importação direta rejeita origem offline.");

assert.throws(
    () => prepararManifestoImportacaoDesktop(criarBackup("development"), "pacote_backup"),
    /origem/
);
console.log("OK: backup de desenvolvimento é rejeitado.");

const incompleto = criarBackup("production");
incompleto.tables = incompleto.tables.filter((t) => t.name !== "relatorios");
assert.throws(
    () => prepararManifestoImportacaoDesktop(incompleto, "producao_direta"),
    /obrigatória/
);
console.log("OK: ausência de tabela obrigatória é rejeitada.");

console.log("OK: nenhum acesso à rede, ao Turso ou ao Blob.");
