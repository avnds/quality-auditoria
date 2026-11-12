import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { criarCopiaRecuperacaoDesktop } from "../src/lib/desktop/copia-recuperacao";
import { verificarCopiaRecuperacaoDesktop } from "../src/lib/desktop/verificar-copia-recuperacao";

async function main() {
    const raiz = mkdtempSync(join(tmpdir(), "quality-verificar-recuperacao-"));
    try {
        mkdirSync(join(raiz, "database"));
        mkdirSync(join(raiz, "evidencias"));
        writeFileSync(join(raiz, "database", "quality.sqlite"), "banco local fechado");
        writeFileSync(join(raiz, "evidencias", "foto"), "foto");
        writeFileSync(join(raiz, "instalacao.json"), JSON.stringify({
            format: "quality-desktop-installation", version: 1, importedAt: new Date().toISOString(),
        }));
        const copia = await criarCopiaRecuperacaoDesktop(raiz, join(raiz, "backups"));
        const integra = await verificarCopiaRecuperacaoDesktop(copia.pasta);
        assert.equal(integra.integra, true);
        assert.equal(integra.totalArquivos, 3);
        console.log("OK: cópia íntegra verificada independentemente.");

        writeFileSync(join(copia.pasta, "evidencias", "foto"), "foto alterada");
        const alterada = await verificarCopiaRecuperacaoDesktop(copia.pasta);
        assert.equal(alterada.integra, false);
        console.log("OK: alteração de bytes impede recuperação.");

        const semRegistro = await verificarCopiaRecuperacaoDesktop(join(raiz, "nao-existe"));
        assert.equal(semRegistro.integra, false);
        console.log("OK: cópia ausente é recusada.");

        console.log("PASSOU: verificação de cópia recuperável sem rollback.");
    } finally {
        rmSync(raiz, { recursive: true, force: true });
    }
}
main().catch(erro => { console.error(erro); process.exitCode = 1; });
