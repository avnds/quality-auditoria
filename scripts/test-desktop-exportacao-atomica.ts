import { strict as assert } from "node:assert";
import { createClient } from "@libsql/client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LogicalDatabaseBackup } from "../src/lib/db/backup";
import { SQL_CRIAR_TABELA_SESSOES_EXPORTACAO } from "../src/lib/desktop/schema-sessoes-exportacao";
import { SQL_CRIAR_TABELA_MANIFESTOS_EXPORTACAO } from "../src/lib/desktop/repositorio-manifestos-exportacao";
import { SQL_CRIAR_TABELA_SNAPSHOTS_BANCO_EXPORTACAO, recuperarSnapshotBancoExportacao } from "../src/lib/desktop/repositorio-snapshots-banco-exportacao";
import { recuperarManifestoExportacao } from "../src/lib/desktop/repositorio-manifestos-exportacao";
import { registrarExportacaoCompleta } from "../src/lib/desktop/registrar-exportacao-completa";
import { criarDescritorSessaoExportacao } from "../src/lib/desktop/sessao-exportacao";
import { prepararManifestoImportacaoDesktop } from "../src/lib/desktop/manifesto-importacao";

async function main() {
    const pasta = mkdtempSync(join(tmpdir(), "quality-exportacao-atomica-"));
    const db = createClient({ url: `file:${join(pasta, "teste.sqlite")}` });
    try {
        await db.execute(SQL_CRIAR_TABELA_SESSOES_EXPORTACAO);
        await db.execute(SQL_CRIAR_TABELA_MANIFESTOS_EXPORTACAO);
        await db.execute(SQL_CRIAR_TABELA_SNAPSHOTS_BANCO_EXPORTACAO);
        const agora = new Date("2026-11-12T12:00:00.000Z");
        const evidencias = "CREATE TABLE evidencias (id TEXT PRIMARY KEY, arquivo_uri TEXT)";
        const relatorios = "CREATE TABLE relatorios (id TEXT PRIMARY KEY, arquivo_uri TEXT)";
        const backup: LogicalDatabaseBackup = {
            format: "quality-auditoria-logical-backup", formatVersion: 1,
            source: "production", createdAt: agora.toISOString(),
            schema: [
                { type: "table", name: "evidencias", tableName: "evidencias", sql: evidencias },
                { type: "table", name: "relatorios", tableName: "relatorios", sql: relatorios },
            ],
            tables: [
                { name: "evidencias", createSql: evidencias, columns: ["id", "arquivo_uri"], rows: [] },
                { name: "relatorios", createSql: relatorios, columns: ["id", "arquivo_uri"], rows: [] },
            ],
        };
        const manifesto = prepararManifestoImportacaoDesktop(backup, "producao_direta");
        const descritor = criarDescritorSessaoExportacao(manifesto, agora);
        const registro = { descritor, usuarioId: "supervisora1", perfilNaCriacao: "SUPERVISORA" as const };
        await registrarExportacaoCompleta(db, registro, backup, agora);
        assert.deepEqual(await recuperarSnapshotBancoExportacao(db, descritor.sessaoId, registro.usuarioId, agora), backup);
        assert.equal((await recuperarManifestoExportacao(db, descritor.sessaoId, registro.usuarioId, agora))?.manifesto.totalArquivos, 0);
        console.log("OK: sessão, manifesto e snapshot persistidos em conjunto.");

        await assert.rejects(() => registrarExportacaoCompleta(db, registro, backup, agora));
        for (const tabela of ["desktop_export_sessions", "desktop_export_manifests", "desktop_export_database_snapshots"]) {
            const resultado = await db.execute(`SELECT count(*) AS total FROM ${tabela}`);
            assert.equal(Number(resultado.rows[0].total), 1);
        }
        console.log("OK: sessão duplicada não altera registros existentes.");

        const descritorFalha = criarDescritorSessaoExportacao(manifesto, agora);
        const registroFalha = { ...registro, descritor: descritorFalha };
        await db.execute({ sql: `CREATE TRIGGER impedir_snapshot BEFORE INSERT ON desktop_export_database_snapshots
              BEGIN SELECT RAISE(ABORT, 'falha simulada'); END` });
        await assert.rejects(() => registrarExportacaoCompleta(db, registroFalha, backup, agora));
        for (const tabela of ["desktop_export_sessions", "desktop_export_manifests", "desktop_export_database_snapshots"]) {
            const resultado = await db.execute({ sql: `SELECT count(*) AS total FROM ${tabela} WHERE sessao_id = ?`, args: [descritorFalha.sessaoId] });
            assert.equal(Number(resultado.rows[0].total), 0);
        }
        console.log("OK: falha na terceira gravação reverte sessão e manifesto.");

        const backupDivergente = structuredClone(backup);
        backupDivergente.tables[0].rows.push(["e1", "https://exemplo.invalid/e1"]);
        await assert.rejects(() => registrarExportacaoCompleta(db, { ...registro, descritor: criarDescritorSessaoExportacao(manifesto, agora) }, backupDivergente, agora));
        console.log("OK: divergência entre backup e manifesto rejeitada.");
        console.log("OK: somente SQLite local, sem Turso ou Blob.");
    } finally {
        try { await db.close(); } finally {
            try { rmSync(pasta, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
            catch (erro) {
                if (!["EPERM", "EBUSY", "EACCES"].includes((erro as NodeJS.ErrnoException).code ?? "")) throw erro;
                console.warn(`AVISO: limpeza temporária bloqueada pelo Windows: ${pasta}`);
            }
        }
    }
}
main().catch(erro => { console.error(erro); process.exitCode = 1; });
