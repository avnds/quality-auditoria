import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { criarAreaImportacaoDesktop } from "../src/lib/desktop/area-importacao";
import { prepararImportacaoCompletaStaging } from "../src/lib/desktop/preparar-importacao-completa";
import { verificarPreAtivacaoDesktop } from "../src/lib/desktop/verificar-pre-ativacao";

const uri = "https://exemplo.invalid/arquivo";
const sqlE = "CREATE TABLE evidencias (id TEXT PRIMARY KEY, arquivo_uri TEXT)";
const sqlR = "CREATE TABLE relatorios (id TEXT PRIMARY KEY, arquivo_uri TEXT)";
const backup = {
    format: "quality-auditoria-logical-backup" as const, formatVersion: 1 as const,
    source: "production" as const, createdAt: new Date().toISOString(),
    schema: [
        { type: "table", name: "evidencias", tableName: "evidencias", sql: sqlE },
        { type: "table", name: "relatorios", tableName: "relatorios", sql: sqlR },
    ],
    tables: [
        { name: "evidencias", createSql: sqlE, columns: ["id", "arquivo_uri"], rows: [["e1", uri]] },
        { name: "relatorios", createSql: sqlR, columns: ["id", "arquivo_uri"], rows: [] },
    ],
};
const bytes = new TextEncoder().encode("evidencia original");
const sha256 = createHash("sha256").update(bytes).digest("hex");

async function main() {
    const raiz = mkdtempSync(join(tmpdir(), "quality-pre-ativacao-"));
    try {
        const area = criarAreaImportacaoDesktop(raiz);
        const resultado = await prepararImportacaoCompletaStaging(area, backup, async ref => ({
            stream: new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes); c.close(); } }),
            integridade: { tipo: ref.tipo, registroId: ref.registroId, tamanhoBytes: bytes.length, sha256 },
        }));
        const verificar = () => verificarPreAtivacaoDesktop(
            area, resultado.manifesto, resultado.plano, resultado.integridades
        );
        assert.equal((await verificar()).aprovada, true);
        console.log("OK: conjunto íntegro aprovado para etapa posterior.");

        assert.equal((await verificarPreAtivacaoDesktop(
            area, resultado.manifesto, resultado.plano, []
        )).aprovada, false);
        console.log("OK: lista de integridades incompleta é recusada.");

        const arquivo = join(area.arquivos, "evidencias", "e1");
        assert.equal(existsSync(arquivo), true);
        writeFileSync(arquivo, "conteudo alterado");
        assert.equal((await verificar()).aprovada, false);
        console.log("OK: adulteração do arquivo após importação é recusada.");

        assert.equal(existsSync(join(raiz, "instalacao.json")), false);
        assert.equal(existsSync(join(raiz, "database", "quality.sqlite")), false);
        console.log("OK: nenhuma instalação operacional foi publicada.");
        console.log("PASSOU: testes de pré-ativação Desktop.");
    } finally {
        try { rmSync(raiz, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
        catch (erro) {
            if (!["EPERM", "EBUSY", "EACCES"].includes((erro as NodeJS.ErrnoException).code ?? "")) throw erro;
            console.warn(`AVISO: Windows bloqueou limpeza temporária: ${raiz}`);
        }
    }
}
main().catch(erro => { console.error(erro); process.exitCode = 1; });
