import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { criarAreaImportacaoDesktop } from "../src/lib/desktop/area-importacao";
import { restaurarBackupEmStaging } from "../src/lib/desktop/restaurar-backup-staging";
import { conferirConjuntoImportado } from "../src/lib/desktop/conferir-conjunto-importado";
import { criarPlanoTransferencia } from "../src/lib/desktop/plano-transferencia";
import { transferirArquivoDoPlano } from "../src/lib/desktop/executar-transferencia-plano";
import { prepararManifestoImportacaoDesktop } from "../src/lib/desktop/manifesto-importacao";

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
const bytes = new TextEncoder().encode("arquivo binario real de teste");
const esperado = { tipo: "evidencia" as const, registroId: "e1", tamanhoBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
const fluxo = () => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes); c.close(); } });

async function main() {
    const raiz = mkdtempSync(join(tmpdir(), "quality-conjunto-importado-"));
    try {
        const area = criarAreaImportacaoDesktop(raiz);
        await restaurarBackupEmStaging(area, backup);
        const manifesto = prepararManifestoImportacaoDesktop(backup, "producao_direta");
        const plano = criarPlanoTransferencia({
            arquivos: [{ tipo: "evidencia", registroId: "e1", destinoRelativo: "evidencias/e1", urlOriginal: uri }],
            totalEvidencias: 1,
            totalRelatorios: 0,
        });
        assert.equal(await conferirConjuntoImportado(area, manifesto, plano, [esperado]), false);
        console.log("OK: transferência pendente bloqueia conjunto.");

        await transferirArquivoDoPlano(plano, area.arquivos, "evidencia", "e1", fluxo(), esperado);
        assert.equal(await conferirConjuntoImportado(area, manifesto, plano, [esperado]), true);
        console.log("OK: SQLite restaurado e arquivo real íntegro conferidos juntos.");

        const manifestoDivergente = structuredClone(manifesto);
        manifestoDivergente.inventario.arquivos[0].referenciaSha256 = "0".repeat(64);
        assert.equal(await conferirConjuntoImportado(area, manifestoDivergente, plano, [esperado]), false);
        console.log("OK: referência divergente do banco rejeitada.");

        const manifestoExtra = structuredClone(manifesto);
        manifestoExtra.inventario.arquivos.push({
            tipo: "relatorio", registroId: "r1", destinoRelativo: "relatorios/r1", referenciaSha256: "a".repeat(64),
        });
        manifestoExtra.totalArquivos++;
        manifestoExtra.inventario.totalRelatorios++;
        assert.equal(await conferirConjuntoImportado(area, manifestoExtra, plano, [esperado]), false);
        console.log("OK: manifesto com arquivo extra rejeitado.");

        unlinkSync(join(area.arquivos, "evidencias", "e1"));
        assert.equal(await conferirConjuntoImportado(area, manifesto, plano, [esperado]), false);
        console.log("OK: arquivo ausente após gravação bloqueia conjunto.");

        writeFileSync(join(area.arquivos, "evidencias", "e1"), "adulterado");
        assert.equal(await conferirConjuntoImportado(area, manifesto, plano, [esperado]), false);
        console.log("OK: arquivo adulterado bloqueia conjunto.");
        console.log("OK: teste não acessou Turso, Blob nem banco operacional.");
    } finally {
        try { rmSync(raiz, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
        catch (erro) {
            if (!["EPERM", "EBUSY", "EACCES"].includes((erro as NodeJS.ErrnoException).code ?? "")) throw erro;
            console.warn(`AVISO: Windows bloqueou limpeza temporária: ${raiz}`);
        }
    }
}
main().catch(erro => { console.error(erro); process.exitCode = 1; });
