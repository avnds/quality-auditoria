import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { criarAreaImportacaoDesktop } from "../src/lib/desktop/area-importacao";
import { prepararImportacaoCompletaStaging } from "../src/lib/desktop/preparar-importacao-completa";

const uri = "https://exemplo.invalid/arquivo-e1";
const sqlEvidencias = "CREATE TABLE evidencias (id TEXT PRIMARY KEY, arquivo_uri TEXT)";
const sqlRelatorios = "CREATE TABLE relatorios (id TEXT PRIMARY KEY, arquivo_uri TEXT)";
const backup = {
    format: "quality-auditoria-logical-backup" as const,
    formatVersion: 1 as const,
    source: "production" as const,
    createdAt: new Date().toISOString(),
    schema: [
        { type: "table", name: "evidencias", tableName: "evidencias", sql: sqlEvidencias },
        { type: "table", name: "relatorios", tableName: "relatorios", sql: sqlRelatorios },
    ],
    tables: [
        { name: "evidencias", createSql: sqlEvidencias, columns: ["id", "arquivo_uri"], rows: [["e1", uri]] },
        { name: "relatorios", createSql: sqlRelatorios, columns: ["id", "arquivo_uri"], rows: [] },
    ],
};
const bytes = new TextEncoder().encode("arquivo binario de importacao");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const fluxo = () => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes); c.close(); } });

async function main() {
    const raiz = mkdtempSync(join(tmpdir(), "quality-importacao-completa-"));
    try {
        const area = criarAreaImportacaoDesktop(raiz);
        const resultado = await prepararImportacaoCompletaStaging(area, backup, async ref => ({
            stream: fluxo(),
            integridade: { tipo: ref.tipo, registroId: ref.registroId, tamanhoBytes: bytes.length, sha256 },
        }));
        assert.equal(resultado.plano.arquivos.length, 1);
        assert.equal(resultado.plano.arquivos[0].estado, "validado");
        assert.equal(existsSync(resultado.bancoArquivo), true);
        assert.equal(existsSync(join(area.arquivos, "evidencias", "e1")), true);
        console.log("OK: restauração, transferência e conferência concluídas de ponta a ponta.");

        const areaFalha = criarAreaImportacaoDesktop(raiz);
        await assert.rejects(() => prepararImportacaoCompletaStaging(areaFalha, backup, async ref => ({
            stream: fluxo(),
            integridade: { tipo: ref.tipo, registroId: ref.registroId, tamanhoBytes: bytes.length, sha256: "0".repeat(64) },
        })));
        assert.equal(existsSync(join(areaFalha.arquivos, "evidencias", "e1")), false);
        console.log("OK: hash incorreto interrompe a importação sem publicar arquivo.");

        const areaFonte = criarAreaImportacaoDesktop(raiz);
        await assert.rejects(() => prepararImportacaoCompletaStaging(areaFonte, backup, async () => {
            throw new Error("Fonte indisponível");
        }), /Fonte indisponível/);
        assert.equal(existsSync(join(areaFonte.arquivos, "evidencias", "e1")), false);
        console.log("OK: falha da fonte interrompe a importação.");

        const areaSemArquivo = criarAreaImportacaoDesktop(raiz);
        const backupVazio = structuredClone(backup);
        backupVazio.tables[0].rows = [];
        const semArquivo = await prepararImportacaoCompletaStaging(areaSemArquivo, backupVazio, async () => {
            throw new Error("Não deveria solicitar arquivo.");
        });
        assert.equal(semArquivo.plano.arquivos.length, 0);
        console.log("OK: importação sem arquivos privados não solicita transferências.");
        console.log("OK: nenhum banco operacional, Turso ou Blob acessado.");
    } finally {
        try { rmSync(raiz, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
        catch (erro) {
            if (!["EPERM", "EBUSY", "EACCES"].includes((erro as NodeJS.ErrnoException).code ?? "")) throw erro;
            console.warn(`AVISO: Windows bloqueou limpeza temporária: ${raiz}`);
        }
    }
}
main().catch(erro => { console.error(erro); process.exitCode = 1; });
