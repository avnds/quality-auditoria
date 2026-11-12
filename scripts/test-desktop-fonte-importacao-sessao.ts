import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { criarFonteImportacaoSessao, type TransporteSessaoDesktop } from "../src/lib/desktop/fonte-importacao-sessao";
import { calcularIntegridadeStream } from "../src/lib/desktop/calcular-integridade-stream";

const sessaoId = "123e4567-e89b-42d3-a456-426614174000";
const tipo = "evidencia" as const;
const registroId = "evidencia-1";
const referenciaSha256 = "a".repeat(64);
const bytes = new TextEncoder().encode("conteudo autentico de evidencia");
const hash = createHash("sha256").update(bytes).digest("hex");
const parametro = { tipo, registroId, referenciaSha256 };
const base = `/api/desktop/exportacao/sessoes/${sessaoId}`;
const integridadePath = `${base}/integridade/${tipo}/${registroId}?referenciaSha256=${referenciaSha256}`;
const arquivoPath = `${base}/arquivos/${tipo}/${registroId}?referenciaSha256=${referenciaSha256}`;

function respostaIntegridade(alteracoes: Record<string, unknown> = {}) {
    return Response.json({
        success: true, sessaoId, tipo, registroId, referenciaSha256,
        tamanhoBytes: bytes.length, sha256: hash, ...alteracoes,
    });
}
function respostaArquivo(conteudo = bytes, tamanho = String(conteudo.length)) {
    return new Response(new Uint8Array(conteudo), {
        status: 200, headers: { "Content-Length": tamanho },
    });
}
function transporte(integridade: Response, arquivo: Response, requisicoes: string[] = []): TransporteSessaoDesktop {
    return async caminho => {
        requisicoes.push(caminho);
        if (caminho === integridadePath) return integridade;
        if (caminho === arquivoPath) return arquivo;
        throw new Error("Caminho inesperado: " + caminho);
    };
}
async function deveFalhar(t: TransporteSessaoDesktop, mensagem: RegExp) {
    await assert.rejects(() => criarFonteImportacaoSessao(sessaoId, t)(parametro), mensagem);
}

async function main() {
    const requisicoes: string[] = [];
    const fonte = criarFonteImportacaoSessao(sessaoId, transporte(respostaIntegridade(), respostaArquivo(), requisicoes));
    const { stream, integridade } = await fonte(parametro);
    assert.deepEqual(requisicoes, [integridadePath, arquivoPath]);
    assert.deepEqual(await calcularIntegridadeStream(stream), {
        tamanhoBytes: integridade.tamanhoBytes, sha256: integridade.sha256,
    });
    console.log("OK: medição e transferência correspondem aos mesmos bytes.");

    await deveFalhar(transporte(Response.json({ success: false }, { status: 403 }), respostaArquivo()), /HTTP 403/);
    console.log("OK: medição não autorizada é recusada.");

    await deveFalhar(transporte(respostaIntegridade({ sessaoId: "outra-sessao" }), respostaArquivo()), /não corresponde/);
    await deveFalhar(transporte(respostaIntegridade({ sha256: "invalido" }), respostaArquivo()), /não corresponde/);
    console.log("OK: identidade e hash da medição são conferidos.");

    await deveFalhar(transporte(respostaIntegridade(), Response.json({ success: false }, { status: 404 })), /HTTP 404/);
    await deveFalhar(transporte(respostaIntegridade(), respostaArquivo(bytes, String(bytes.length + 1))), /Tamanho declarado diverge/);
    console.log("OK: download recusado e tamanho declarado divergente são detectados.");

    const diferente = new Uint8Array(bytes);
    diferente[0] ^= 1;
    const resultado = await criarFonteImportacaoSessao(
        sessaoId, transporte(respostaIntegridade(), respostaArquivo(diferente))
    )(parametro);
    const calculado = await calcularIntegridadeStream(resultado.stream);
    assert.notEqual(calculado.sha256, resultado.integridade.sha256);
    console.log("OK: conteúdo alterado após medição é detectável na conferência de bytes.");

    assert.throws(() => criarFonteImportacaoSessao("sessao-invalida", transporte(respostaIntegridade(), respostaArquivo())), /inválido/);
    console.log("OK: identificador de sessão inválido é recusado.");

    console.log("PASSOU: testes do transporte de sessão com respostas simuladas.");
}
main().catch(erro => { console.error(erro); process.exitCode = 1; });
