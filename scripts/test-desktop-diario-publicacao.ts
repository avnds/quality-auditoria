import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    iniciarDiarioPublicacaoDesktop, lerDiarioPublicacaoDesktop,
    avancarDiarioPublicacaoDesktop,
} from "../src/lib/desktop/diario-publicacao";

function main() {
    const raiz = mkdtempSync(join(tmpdir(), "quality-diario-publicacao-"));
    try {
        const registro = iniciarDiarioPublicacaoDesktop(raiz, "123e4567-e89b-42d3-a456-426614174000");
        assert.equal(lerDiarioPublicacaoDesktop(raiz)?.etapa, "preparada");
        assert.throws(() => iniciarDiarioPublicacaoDesktop(raiz, registro.importacaoId), /EEXIST/);
        console.log("OK: diário inicial persistido e duplicidade bloqueada.");

        assert.throws(() => avancarDiarioPublicacaoDesktop(raiz, registro.operacaoId, "publicacao_iniciada"), /Transição/);
        assert.throws(() => avancarDiarioPublicacaoDesktop(raiz, registro.operacaoId, "copia_recuperacao_validada"), /Cópia/);
        assert.throws(() => avancarDiarioPublicacaoDesktop(raiz, "outro", "copia_recuperacao_validada", "pasta"), /não corresponde/);
        console.log("OK: saltos de etapa, falta de cópia e token incorreto são recusados.");

        avancarDiarioPublicacaoDesktop(raiz, registro.operacaoId, "copia_recuperacao_validada", "backups/seguro");
        avancarDiarioPublicacaoDesktop(raiz, registro.operacaoId, "publicacao_iniciada");
        assert.equal(lerDiarioPublicacaoDesktop(raiz)?.etapa, "publicacao_iniciada");
        assert.equal(lerDiarioPublicacaoDesktop(raiz)?.pastaRecuperacao, "backups/seguro");
        console.log("OK: interrupção durante publicação permanece registrada para recuperação.");

        avancarDiarioPublicacaoDesktop(raiz, registro.operacaoId, "publicacao_concluida");
        avancarDiarioPublicacaoDesktop(raiz, registro.operacaoId, "verificacao_final_concluida");
        assert.equal(lerDiarioPublicacaoDesktop(raiz)?.etapa, "verificacao_final_concluida");
        console.log("OK: conclusão exige sequência completa de etapas.");

        console.log("PASSOU: diário de publicação sem alteração de instalação real.");
    } finally {
        rmSync(raiz, { recursive: true, force: true });
    }
}
main();
