import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import type { LogicalDatabaseBackup } from "../src/lib/db/backup";
import { prepararManifestoImportacaoDesktop } from "../src/lib/desktop/manifesto-importacao";
import { localizarArquivoNoSnapshot } from "../src/lib/desktop/localizar-arquivo-snapshot";

process.env.QUALITY_RUNTIME = "desktop";

const uri = "https://example.public.blob.vercel-storage.com/evidencia-1.jpg";
const backup: LogicalDatabaseBackup = {
    format: "quality-auditoria-logical-backup",
    formatVersion: 1,
    createdAt: "2026-11-12T12:00:00.000Z",
    source: "production",
    schema: [],
    tables: [
        { name: "evidencias", createSql: "CREATE TABLE evidencias (id TEXT, arquivo_uri TEXT)", columns: ["id", "arquivo_uri"], rows: [["e1", uri]] },
        { name: "relatorios", createSql: "CREATE TABLE relatorios (id TEXT, arquivo_uri TEXT)", columns: ["id", "arquivo_uri"], rows: [] },
    ],
};
const manifesto = prepararManifestoImportacaoDesktop(backup, "producao_direta");
const hash = createHash("sha256").update(uri).digest("hex");

const encontrado = localizarArquivoNoSnapshot(backup, manifesto, "evidencia", "e1", hash);
assert.equal(encontrado?.uriSnapshot, uri);
assert.equal(encontrado?.registroId, "e1");
console.log("OK: URI obtida do banco congelado.");

assert.equal(localizarArquivoNoSnapshot(backup, manifesto, "evidencia", "e1", "0".repeat(64)), null);
assert.equal(localizarArquivoNoSnapshot(backup, manifesto, "evidencia", "inexistente", hash), null);
console.log("OK: hash incorreto e ID ausente são recusados.");

const manifestoAlterado = structuredClone(manifesto);
manifestoAlterado.inventario.arquivos[0].destinoRelativo = "outro/caminho";
assert.throws(() => localizarArquivoNoSnapshot(backup, manifestoAlterado, "evidencia", "e1", hash));
console.log("OK: manifesto divergente é recusado.");

const backupAlterado = structuredClone(backup);
backupAlterado.tables[0].rows[0][1] = "https://example.com/novo.jpg";
assert.throws(() => localizarArquivoNoSnapshot(backupAlterado, manifesto, "evidencia", "e1", hash));
console.log("OK: alteração da referência no snapshot é detectada.");

console.log("PASSOU: testes de vínculo dos arquivos ao snapshot.");
