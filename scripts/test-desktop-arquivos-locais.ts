import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abrirArquivoDesktop } from "../src/lib/desktop/abrir-arquivo-local";

async function main() {
    if (process.platform !== "win32") throw new Error("Teste Desktop exige Windows.");
    const anterior = process.env.LOCALAPPDATA;
    const temporario = mkdtempSync(join(tmpdir(), "quality-arquivos-offline-"));
    process.env.LOCALAPPDATA = temporario;
    try {
        const raiz = join(temporario, "QualityDesktop", "arquivos");
        mkdirSync(join(raiz, "evidencias"), { recursive: true });
        mkdirSync(join(raiz, "relatorios"), { recursive: true });
        writeFileSync(join(raiz, "evidencias", "e1"), "imagem offline");
        writeFileSync(join(raiz, "relatorios", "r1"), "%PDF-1.4 teste");
        const imagem = abrirArquivoDesktop("evidencia", "e1");
        assert.equal(imagem?.status, 200);
        assert.equal(await imagem?.text(), "imagem offline");
        console.log("OK: evidência servida do disco sem Blob.");

        const pdf = abrirArquivoDesktop("relatorio", "r1");
        assert.equal(pdf?.headers.get("content-type"), "application/pdf");
        assert.equal(await pdf?.text(), "%PDF-1.4 teste");
        console.log("OK: relatório PDF servido do disco.");

        assert.equal(abrirArquivoDesktop("evidencia", "../r1"), null);
        assert.equal(abrirArquivoDesktop("relatorio", "nao-existe"), null);
        console.log("OK: caminho inválido e arquivo ausente recusados.");
        console.log("PASSOU: leitura local de evidências e relatórios.");
    } finally {
        if (anterior === undefined) delete process.env.LOCALAPPDATA;
        else process.env.LOCALAPPDATA = anterior;
        rmSync(temporario, { recursive: true, force: true });
    }
}
main().catch(erro => { console.error(erro); process.exitCode = 1; });
