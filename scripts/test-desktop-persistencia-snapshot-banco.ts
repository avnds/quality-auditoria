import { strict as assert } from "node:assert";
import { createClient } from "@libsql/client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQL_CRIAR_TABELA_SESSOES_EXPORTACAO } from "../src/lib/desktop/schema-sessoes-exportacao";
import {
    SQL_CRIAR_TABELA_SNAPSHOTS_BANCO_EXPORTACAO,
    guardarSnapshotBancoExportacao,
    recuperarSnapshotBancoExportacao,
} from "../src/lib/desktop/repositorio-snapshots-banco-exportacao";
import { registrarSessaoExportacao, revogarSessaoExportacao } from "../src/lib/desktop/repositorio-sessoes-exportacao";
import { criarDescritorSessaoExportacao } from "../src/lib/desktop/sessao-exportacao";
import { prepararManifestoImportacaoDesktop } from "../src/lib/desktop/manifesto-importacao";
import type { LogicalDatabaseBackup } from "../src/lib/db/backup";

async function main() {
    const pasta = mkdtempSync(join(tmpdir(), "quality-snapshot-banco-teste-"));
    const db = createClient({ url: `file:${join(pasta, "teste.sqlite")}` });
    try {
        await db.execute(SQL_CRIAR_TABELA_SESSOES_EXPORTACAO);
        await db.execute(SQL_CRIAR_TABELA_SNAPSHOTS_BANCO_EXPORTACAO);
        const agora = new Date("2026-11-12T12:00:00.000Z");
        const sqlEvidencias = "CREATE TABLE evidencias (id TEXT PRIMARY KEY, arquivo_uri TEXT)";
        const sqlRelatorios = "CREATE TABLE relatorios (id TEXT PRIMARY KEY, arquivo_uri TEXT)";
        const backup: LogicalDatabaseBackup = {
            format: "quality-auditoria-logical-backup",
            formatVersion: 1,
            source: "production",
            createdAt: agora.toISOString(),
            schema: [
                { type: "table", name: "evidencias", tableName: "evidencias", sql: sqlEvidencias },
                { type: "table", name: "relatorios", tableName: "relatorios", sql: sqlRelatorios },
            ],
            tables: [
                { name: "evidencias", createSql: sqlEvidencias, columns: ["id", "arquivo_uri"], rows: [["e1", "https://exemplo.invalid/e1"]] },
                { name: "relatorios", createSql: sqlRelatorios, columns: ["id", "arquivo_uri"], rows: [] },
            ],
        };
        const manifesto = prepararManifestoImportacaoDesktop(backup, "producao_direta");
        const descritor = criarDescritorSessaoExportacao(manifesto, agora);
        const registro = { descritor, usuarioId: "supervisora1", perfilNaCriacao: "SUPERVISORA" as const };
        await registrarSessaoExportacao(db, registro);
        await guardarSnapshotBancoExportacao(db, registro, backup, agora);
        assert.deepEqual(await recuperarSnapshotBancoExportacao(db, descritor.sessaoId, registro.usuarioId, agora), backup);
        console.log("OK: snapshot de banco gravado e recuperado.");

        assert.equal(await recuperarSnapshotBancoExportacao(db, descritor.sessaoId, "outro", agora), null);
        console.log("OK: usuário diferente não recupera snapshot.");

        assert.equal(await recuperarSnapshotBancoExportacao(db, descritor.sessaoId, registro.usuarioId, new Date(agora.getTime() + 30 * 60_000)), null);
        console.log("OK: sessão expirada não recupera snapshot.");

        await assert.rejects(() => guardarSnapshotBancoExportacao(db, registro, backup, agora));
        console.log("OK: gravação duplicada rejeitada.");

        const outroBackup = structuredClone(backup);
        outroBackup.tables[0].rows[0][1] = "https://exemplo.invalid/alterado";
        await assert.rejects(() => guardarSnapshotBancoExportacao(db, {
            ...registro, descritor: { ...descritor, sessaoId: "00000000-0000-4000-8000-000000000000" },
        }, outroBackup, agora));
        console.log("OK: sessão não registrada rejeitada.");

        await db.execute({
            sql: "UPDATE desktop_export_database_snapshots SET conteudo_json = ? WHERE sessao_id = ?",
            args: ["{}", descritor.sessaoId],
        });
        await assert.rejects(() => recuperarSnapshotBancoExportacao(db, descritor.sessaoId, registro.usuarioId, agora));
        console.log("OK: adulteração do conteúdo persistido detectada.");

        assert.equal(await revogarSessaoExportacao(db, descritor.sessaoId, registro.usuarioId, agora), true);
        assert.equal(await recuperarSnapshotBancoExportacao(db, descritor.sessaoId, registro.usuarioId, agora), null);
        console.log("OK: sessão revogada impede recuperação.");
        console.log("OK: teste somente SQLite local; sem Turso, Blob ou produção.");
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
