import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { calcularIntegridadeStream } from "../src/lib/desktop/calcular-integridade-stream";

function streamDePartes(partes: Uint8Array[]): ReadableStream<Uint8Array> {
    return new ReadableStream({
        start(controller) {
            for (const parte of partes) controller.enqueue(parte);
            controller.close();
        },
    });
}

async function main() {
    const partes = [
        new TextEncoder().encode("arquivo "),
        new TextEncoder().encode("dividido "),
        new TextEncoder().encode("em partes"),
    ];
    const completo = Buffer.concat(partes);
    const esperado = createHash("sha256").update(completo).digest("hex");
    const resultado = await calcularIntegridadeStream(streamDePartes(partes));

    assert.equal(resultado.tamanhoBytes, completo.byteLength);
    assert.equal(resultado.sha256, esperado);
    console.log("OK: tamanho e SHA-256 calculados em múltiplos blocos.");

    const vazio = await calcularIntegridadeStream(streamDePartes([]));
    assert.equal(vazio.tamanhoBytes, 0);
    assert.equal(vazio.sha256, createHash("sha256").digest("hex"));
    console.log("OK: stream vazio identificado corretamente.");

    const alterado = await calcularIntegridadeStream(streamDePartes([
        partes[0], new TextEncoder().encode("ALTERADO"), partes[2],
    ]));
    assert.notEqual(alterado.sha256, esperado);
    console.log("OK: conteúdo alterado produz SHA-256 diferente.");
    console.log("OK: teste local sem rede, Turso ou Blob.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
