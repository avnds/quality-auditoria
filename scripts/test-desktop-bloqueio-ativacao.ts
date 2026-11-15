import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { adquirirBloqueioAtivacaoDesktop, liberarBloqueioAtivacaoDesktop } from "../src/lib/desktop/bloqueio-ativacao";

function main() {
    const raiz = mkdtempSync(join(tmpdir(), "quality-bloqueio-ativacao-"));
    try {
        const primeiro = adquirirBloqueioAtivacaoDesktop(raiz);
        assert.equal(existsSync(primeiro.arquivo), true);
        assert.throws(() => adquirirBloqueioAtivacaoDesktop(raiz), /Já existe uma ativação/);
        console.log("OK: segunda ativação simultânea recusada.");

        const original = readFileSync(primeiro.arquivo, "utf8");
        assert.throws(() => liberarBloqueioAtivacaoDesktop({ ...primeiro, identificador: "outro-token" }), /outra operação/);
        assert.equal(readFileSync(primeiro.arquivo, "utf8"), original);
        console.log("OK: token diferente não libera bloqueio.");

        liberarBloqueioAtivacaoDesktop(primeiro);
        assert.equal(existsSync(primeiro.arquivo), false);
        const segundo = adquirirBloqueioAtivacaoDesktop(raiz);
        console.log("OK: bloqueio pode ser adquirido após liberação correta.");

        writeFileSync(segundo.arquivo, "{registro-interrompido");
        assert.throws(() => liberarBloqueioAtivacaoDesktop(segundo), /inválido/);
        assert.throws(() => adquirirBloqueioAtivacaoDesktop(raiz), /Já existe uma ativação/);
        console.log("OK: bloqueio corrompido permanece para recuperação, sem remoção automática.");

        console.log("PASSOU: testes de exclusividade da ativação Desktop.");
        console.log("OK: nenhuma instalação ativa foi modificada.");
    } finally {
        rmSync(raiz, { recursive: true, force: true });
    }
}
main();
