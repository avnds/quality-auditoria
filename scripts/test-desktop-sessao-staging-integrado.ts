import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { criarAreaImportacaoDesktop } from "../src/lib/desktop/area-importacao";
import { prepararImportacaoCompletaStaging } from "../src/lib/desktop/preparar-importacao-completa";
import { criarFonteImportacaoSessao, type TransporteSessaoDesktop } from "../src/lib/desktop/fonte-importacao-sessao";
import { prepararManifestoImportacaoDesktop } from "../src/lib/desktop/manifesto-importacao";

const sessaoId = "123e4567-e89b-42d3-a456-426614174000";
const uri = "https://exemplo.invalid/e1";
const sqlE = "CREATE TABLE evidencias (id TEXT PRIMARY KEY, arquivo_uri TEXT)";
const sqlR = "CREATE TABLE relatorios (id TEXT PRIMARY KEY, arquivo_uri TEXT)";
const backup = {
    format: "quality-auditoria-logical-backup" as const, formatVersion: 1 as const,
    source: "production" as const, createdAt: "2026-11-12T12:00:00.000Z",
    schema: [
        { type: "table", name: "evidencias", tableName: "evidencias", sql: sqlE },
        { type: "table", name: "relatorios", tableName: "relatorios", sql: sqlR },
    ],
    tables: [
        { name: "evidencias", createSql: sqlE, columns: ["id", "arquivo_uri"], rows: [["e1", uri]] },
        { name: "relatorios", createSql: sqlR, columns: ["id", "arquivo_uri"], rows: [] },
    ],
};
const manifesto = prepararManifestoImportacaoDesktop(backup, "producao_direta");
const referencia = manifesto.inventario.arquivos[0];
const bytes = new TextEncoder().encode("conteudo privado correto");
const sha = createHash("sha256").update(bytes).digest("hex");

function transporte(conteudo = bytes, hashInformado = sha): TransporteSessaoDesktop {
    return async caminho => {
        const esperado = `?referenciaSha256=${referencia.referenciaSha256}`;
        if (!caminho.endsWith(esperado)) throw new Error("Referência incorreta.");
        if (caminho.includes("/integridade/evidencia/e1")) {
            return Response.json({
                success: true, sessaoId, tipo: "evidencia", registroId: "e1",
                referenciaSha256: referencia.referenciaSha256,
                tamanhoBytes: bytes.length, sha256: hashInformado,
            });
        }
        if (caminho.includes("/arquivos/evidencia/e1")) {
            return new Response(new Uint8Array(conteudo), { status: 200 });
        }
        throw new Error("Rota inesperada: " + caminho);
    };
}

async function main() {
    const raiz = mkdtempSync(join(tmpdir(), "quality-sessao-staging-"));
    try {
        const area = criarAreaImportacaoDesktop(raiz);
        const resultado = await prepararImportacaoCompletaStaging(
            area, backup, criarFonteImportacaoSessao(sessaoId, transporte())
        );
        assert.equal(resultado.plano.arquivos[0].estado, "validado");
        assert.equal(existsSync(resultado.bancoArquivo), true);
        assert.equal(existsSync(join(area.arquivos, "evidencias", "e1")), true);
        console.log("OK: sessão simulada importada e conferida em staging.");

        const bytesAlterados = new Uint8Array(bytes);
        bytesAlterados[0] ^= 1;
        const areaAlterada = criarAreaImportacaoDesktop(raiz);
        await assert.rejects(() => prepararImportacaoCompletaStaging(
            areaAlterada, backup, criarFonteImportacaoSessao(sessaoId, transporte(bytesAlterados))
        ));
        assert.equal(existsSync(join(areaAlterada.arquivos, "evidencias", "e1")), false);
        console.log("OK: bytes alterados após medição impedem a importação.");

        const areaHash = criarAreaImportacaoDesktop(raiz);
        await assert.rejects(() => prepararImportacaoCompletaStaging(
            areaHash, backup, criarFonteImportacaoSessao(sessaoId, transporte(bytes, "0".repeat(64)))
        ));
        console.log("OK: medição SHA-256 divergente impede a importação.");

        const areaNegada = criarAreaImportacaoDesktop(raiz);
        const transporteNegado: TransporteSessaoDesktop = async () => Response.json({ success: false }, { status: 403 });
        await assert.rejects(() => prepararImportacaoCompletaStaging(
            areaNegada, backup, criarFonteImportacaoSessao(sessaoId, transporteNegado)
        ), /HTTP 403/);
        console.log("OK: sessão não autorizada interrompe a importação.");

        console.log("PASSOU: integração de sessão simulada com banco e arquivos em staging.");
        console.log("OK: sem acesso à produção e sem ativação da instalação.");
    } finally {
        try { rmSync(raiz, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
        catch (erro) {
            if (!["EPERM", "EBUSY", "EACCES"].includes((erro as NodeJS.ErrnoException).code ?? "")) throw erro;
            console.warn(`AVISO: Windows bloqueou limpeza temporária: ${raiz}`);
        }
    }
}
main().catch(erro => { console.error(erro); process.exitCode = 1; });
