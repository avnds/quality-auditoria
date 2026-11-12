import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { criarCopiaRecuperacaoDesktop } from "../src/lib/desktop/copia-recuperacao";

async function main() {
    const raiz = mkdtempSync(join(tmpdir(), "quality-copia-recuperacao-"));
    try {
        const database = join(raiz, "database");
        const evidencias = join(raiz, "evidencias", "evidencias");
        const backups = join(raiz, "backups");
        mkdirSync(database, { recursive: true });
        mkdirSync(evidencias, { recursive: true });
        writeFileSync(join(database, "quality.sqlite"), "banco de teste fechado");
        writeFileSync(join(evidencias, "e1"), "evidencia de teste");
        writeFileSync(join(raiz, "instalacao.json"), JSON.stringify({
            format: "quality-desktop-installation", version: 1, importedAt: new Date().toISOString(),
        }));

        const copia = await criarCopiaRecuperacaoDesktop(raiz, backups);
        assert.equal(copia.registro.arquivos.length, 3);
        assert.equal(existsSync(join(copia.pasta, "database", "quality.sqlite")), true);
        assert.equal(existsSync(join(copia.pasta, "evidencias", "evidencias", "e1")), true);
        assert.equal(existsSync(join(copia.pasta, "instalacao.json")), true);
        assert.equal(existsSync(join(copia.pasta, "registro-recuperacao.json")), true);
        for (const item of copia.registro.arquivos) {
            const bytes = readFileSync(join(copia.pasta, ...item.caminho.split("/")));
            assert.equal(bytes.length, item.tamanhoBytes);
            assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256);
        }
        console.log("OK: cópia contém banco, arquivos e marcador com hashes válidos.");

        writeFileSync(join(database, "quality.sqlite"), "banco alterado apos copia");
        assert.equal(readFileSync(join(copia.pasta, "database", "quality.sqlite"), "utf8"), "banco de teste fechado");
        console.log("OK: alterações posteriores não modificam a cópia recuperável.");

        const raizIncompleta = mkdtempSync(join(tmpdir(), "quality-copia-incompleta-"));
        try {
            mkdirSync(join(raizIncompleta, "database"));
            writeFileSync(join(raizIncompleta, "database", "quality.sqlite"), "banco sem marcador");
            await assert.rejects(
                () => criarCopiaRecuperacaoDesktop(raizIncompleta, join(raizIncompleta, "backups")),
                /incompleta/
            );
            console.log("OK: instalação incompleta não é considerada cópia recuperável.");
        } finally {
            rmSync(raizIncompleta, { recursive: true, force: true });
        }
        console.log("PASSOU: testes da cópia de recuperação Desktop.");
        console.log("OK: nenhum banco operacional real foi alterado.");
    } finally {
        try { rmSync(raiz, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
        catch (erro) {
            if (!["EPERM", "EBUSY", "EACCES"].includes((erro as NodeJS.ErrnoException).code ?? "")) throw erro;
            console.warn(`AVISO: Windows bloqueou limpeza temporária: ${raiz}`);
        }
    }
}
main().catch(erro => { console.error(erro); process.exitCode = 1; });
