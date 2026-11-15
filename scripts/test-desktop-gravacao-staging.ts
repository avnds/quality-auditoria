import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gravarArquivoStaging } from "../src/lib/desktop/gravar-arquivo-staging";
import type { IntegridadeEsperada } from "../src/lib/desktop/conferir-integridade-esperada";

const bytes = (texto: string) => new TextEncoder().encode(texto);
const hash = (dados: Uint8Array) => createHash("sha256").update(dados).digest("hex");
const fluxo = (dados: Uint8Array) => new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(dados); controller.close(); },
});
const esperado = (registroId: string, dados: Uint8Array): IntegridadeEsperada => ({
    tipo: "evidencia", registroId, tamanhoBytes: dados.byteLength, sha256: hash(dados),
});
const semPartes = (pasta: string) =>
    !existsSync(join(pasta, "evidencias")) ||
    readdirSync(join(pasta, "evidencias")).every((nome) => !nome.endsWith(".part"));

async function main() {
    const pasta = mkdtempSync(join(tmpdir(), "quality-staging-teste-"));
    try {
        const original = bytes("conteudo de evidencia valido");
        const destino = "evidencias/arquivo1";
        const resultado = await gravarArquivoStaging(pasta, destino, fluxo(original), esperado("arquivo1", original));
        assert.equal(resultado.tamanhoBytes, original.length);
        assert.equal(resultado.sha256, hash(original));
        assert.deepEqual(readFileSync(join(pasta, destino)), Buffer.from(original));
        assert.ok(semPartes(pasta));
        console.log("OK: arquivo íntegro gravado e publicado no staging.");

        await assert.rejects(() =>
            gravarArquivoStaging(pasta, destino, fluxo(original), esperado("arquivo1", original)));
        console.log("OK: arquivo existente não é substituído.");

        const parcial = bytes("curto");
        await assert.rejects(() =>
            gravarArquivoStaging(pasta, "evidencias/arquivo2", fluxo(parcial), esperado("arquivo2", original)));
        assert.equal(existsSync(join(pasta, "evidencias/arquivo2")), false);
        assert.ok(semPartes(pasta));
        console.log("OK: transferência incompleta rejeitada sem arquivo parcial.");

        const adulterado = bytes("conteudo de evidencia errado");
        await assert.rejects(() =>
            gravarArquivoStaging(pasta, "evidencias/arquivo3", fluxo(adulterado), esperado("arquivo3", original)));
        assert.equal(existsSync(join(pasta, "evidencias/arquivo3")), false);
        assert.ok(semPartes(pasta));
        console.log("OK: hash ou tamanho divergente rejeitado.");

        const grande = bytes("conteudo muito maior que o permitido para o arquivo");
        await assert.rejects(() =>
            gravarArquivoStaging(pasta, "evidencias/arquivo4", fluxo(grande), esperado("arquivo4", parcial)));
        assert.equal(existsSync(join(pasta, "evidencias/arquivo4")), false);
        assert.ok(semPartes(pasta));
        console.log("OK: tamanho excedido interrompe a gravação.");

        const interrompido = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(bytes("inicio"));
                controller.error(new Error("conexao interrompida"));
            },
        });
        await assert.rejects(() =>
            gravarArquivoStaging(pasta, "evidencias/arquivo5", interrompido, esperado("arquivo5", original)));
        assert.equal(existsSync(join(pasta, "evidencias/arquivo5")), false);
        assert.ok(semPartes(pasta));
        console.log("OK: falha de stream não deixa arquivo final ou parcial.");

        await assert.rejects(() =>
            gravarArquivoStaging(pasta, "../arquivo6", fluxo(original), esperado("arquivo6", original)));
        console.log("OK: destino fora do staging rejeitado.");
        console.log("OK: testes locais sem Turso, Blob ou rede.");
    } finally {
        try { rmSync(pasta, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
        catch (erro) {
            if (!["EPERM", "EBUSY", "EACCES"].includes((erro as NodeJS.ErrnoException).code ?? "")) throw erro;
            console.warn(`AVISO: Windows impediu limpeza da pasta temporária: ${pasta}`);
        }
    }
}
main().catch((erro) => { console.error(erro); process.exitCode = 1; });
