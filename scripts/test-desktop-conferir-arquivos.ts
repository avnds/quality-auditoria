import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { conferirArquivosTransferidos } from "../src/lib/desktop/conferir-arquivos-transferidos";
import { criarPlanoTransferencia } from "../src/lib/desktop/plano-transferencia";

async function main() {
    const staging = mkdtempSync(join(tmpdir(), "quality-desktop-verificacao-"));
    try {
        mkdirSync(join(staging, "evidencias"));
        mkdirSync(join(staging, "relatorios"));
        const dados = [
            { tipo: "evidencia" as const, registroId: "e1", destinoRelativo: "evidencias/e1", conteudo: Buffer.from("imagem-ficticia") },
            { tipo: "relatorio" as const, registroId: "r1", destinoRelativo: "relatorios/r1", conteudo: Buffer.from("pdf-ficticio") },
        ];
        const plano = criarPlanoTransferencia({
            totalEvidencias: 1,
            totalRelatorios: 1,
            arquivos: dados.map(({ conteudo: _conteudo, ...arquivo }) => ({
                ...arquivo,
                urlOriginal: "https://exemplo.invalid/arquivo",
            })),
        });
        for (let i = 0; i < dados.length; i++) {
            const arquivo = dados[i];
            writeFileSync(join(staging, arquivo.destinoRelativo), arquivo.conteudo);
            plano.arquivos[i].estado = "validado";
            plano.arquivos[i].tamanhoBytes = arquivo.conteudo.length;
            plano.arquivos[i].sha256 = createHash("sha256").update(arquivo.conteudo).digest("hex");
        }

        assert.equal(await conferirArquivosTransferidos(plano, staging), true);
        console.log("OK: arquivos existentes com tamanho e SHA-256 corretos.");

        writeFileSync(join(staging, "evidencias/e1"), Buffer.from("imagem-adulterada"));
        assert.equal(await conferirArquivosTransferidos(plano, staging), false);
        console.log("OK: conteúdo adulterado é rejeitado.");

        writeFileSync(join(staging, "evidencias/e1"), dados[0].conteudo);
        unlinkSync(join(staging, "relatorios/r1"));
        assert.equal(await conferirArquivosTransferidos(plano, staging), false);
        console.log("OK: relatório ausente é rejeitado.");

        writeFileSync(join(staging, "relatorios/r1"), dados[1].conteudo);
        plano.arquivos[0].destinoRelativo = "../fora";
        assert.equal(await conferirArquivosTransferidos(plano, staging), false);
        console.log("OK: travessia de diretório é rejeitada.");
    } finally {
        rmSync(staging, { recursive: true, force: true });
    }
    console.log("OK: teste isolado, sem Turso, Vercel Blob ou banco permanente.");
}

main().catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
});
