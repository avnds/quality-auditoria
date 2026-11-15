import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { criarPlanoTransferencia } from "../src/lib/desktop/plano-transferencia";
import { concluirTransferenciaDoPlano, transferirArquivoDoPlano } from "../src/lib/desktop/executar-transferencia-plano";

const dados = new TextEncoder().encode("evidencia para importar offline");
const sha256 = createHash("sha256").update(dados).digest("hex");
const esperado = { tipo: "evidencia" as const, registroId: "ev1", tamanhoBytes: dados.length, sha256 };
const stream = () => new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(dados); controller.close(); },
});

async function main() {
    const pasta = mkdtempSync(join(tmpdir(), "quality-plano-integrado-"));
    try {
        const plano = criarPlanoTransferencia({
            arquivos: [{ tipo: "evidencia", registroId: "ev1", destinoRelativo: "evidencias/ev1", urlOriginal: "https://exemplo.invalid/ev1" }],
            totalEvidencias: 1,
            totalRelatorios: 0,
        });
        assert.equal(await concluirTransferenciaDoPlano(plano, pasta, [esperado]), false);
        await transferirArquivoDoPlano(plano, pasta, "evidencia", "ev1", stream(), esperado);
        assert.equal(plano.arquivos[0].estado, "validado");
        assert.equal(await concluirTransferenciaDoPlano(plano, pasta, [esperado]), true);
        console.log("OK: pendente não conclui; gravação íntegra conclui o plano.");

        await assert.rejects(() => transferirArquivoDoPlano(plano, pasta, "evidencia", "ev1", stream(), esperado));
        console.log("OK: transferência duplicada rejeitada.");

        writeFileSync(join(pasta, "evidencias/ev1"), "conteudo adulterado");
        assert.equal(await concluirTransferenciaDoPlano(plano, pasta, [esperado]), false);
        console.log("OK: alteração no disco após validação bloqueia conclusão.");

        const outro = criarPlanoTransferencia({
            arquivos: [{ tipo: "evidencia", registroId: "ev2", destinoRelativo: "evidencias/ev2", urlOriginal: "https://exemplo.invalid/ev2" }],
            totalEvidencias: 1,
            totalRelatorios: 0,
        });
        const outroEsperado = { ...esperado, registroId: "ev2" };
        await assert.rejects(() => transferirArquivoDoPlano(outro, pasta, "evidencia", "ev2",
            new ReadableStream<Uint8Array>({ start(c) { c.error(new Error("interrompido")); } }), outroEsperado));
        assert.equal(outro.arquivos[0].estado, "falhou");
        assert.equal(existsSync(join(pasta, "evidencias/ev2")), false);
        assert.equal(await concluirTransferenciaDoPlano(outro, pasta, [outroEsperado]), false);
        console.log("OK: falha marca estado e impede conclusão.");
        console.log("OK: teste local sem Turso ou Blob.");
    } finally {
        try { rmSync(pasta, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
        catch (erro) {
            if (!["EPERM", "EBUSY", "EACCES"].includes((erro as NodeJS.ErrnoException).code ?? "")) throw erro;
            console.warn(`AVISO: limpeza temporária bloqueada pelo Windows: ${pasta}`);
        }
    }
}
main().catch((erro) => { console.error(erro); process.exitCode = 1; });
