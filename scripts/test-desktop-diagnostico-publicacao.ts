import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { adquirirBloqueioAtivacaoDesktop, liberarBloqueioAtivacaoDesktop } from "../src/lib/desktop/bloqueio-ativacao";
import { iniciarDiarioPublicacaoDesktop, avancarDiarioPublicacaoDesktop } from "../src/lib/desktop/diario-publicacao";
import { diagnosticarPublicacaoDesktop } from "../src/lib/desktop/diagnosticar-publicacao";

function main() {
    const raiz = mkdtempSync(join(tmpdir(), "quality-diagnostico-publicacao-"));
    try {
        assert.equal(diagnosticarPublicacaoDesktop(raiz).estado, "sem_diario");
        console.log("OK: ausência de diário identificada.");
        const lock = adquirirBloqueioAtivacaoDesktop(raiz);
        const semDiario = diagnosticarPublicacaoDesktop(raiz);
        assert.equal(semDiario.estado, "sem_diario");
        assert.equal(semDiario.requerIntervencao, true);
        console.log("OK: bloqueio órfão exige intervenção.");

        const diario = iniciarDiarioPublicacaoDesktop(raiz, "123e4567-e89b-42d3-a456-426614174000");
        assert.equal(diagnosticarPublicacaoDesktop(raiz).estado, "pendente_antes_publicacao");
        avancarDiarioPublicacaoDesktop(raiz, diario.operacaoId, "copia_recuperacao_validada", "backups/teste");
        assert.equal(diagnosticarPublicacaoDesktop(raiz).copiaRecuperacaoInformada, true);
        avancarDiarioPublicacaoDesktop(raiz, diario.operacaoId, "publicacao_iniciada");
        const interrompida = diagnosticarPublicacaoDesktop(raiz);
        assert.equal(interrompida.estado, "publicacao_interrompida");
        assert.equal(interrompida.liberarInstalacao, false);
        assert.equal(interrompida.requerIntervencao, true);
        console.log("OK: interrupção durante publicação bloqueia liberação.");

        avancarDiarioPublicacaoDesktop(raiz, diario.operacaoId, "publicacao_concluida");
        assert.equal(diagnosticarPublicacaoDesktop(raiz).estado, "verificacao_pendente");
        avancarDiarioPublicacaoDesktop(raiz, diario.operacaoId, "verificacao_final_concluida");
        assert.equal(diagnosticarPublicacaoDesktop(raiz).estado, "concluida");
        assert.equal(diagnosticarPublicacaoDesktop(raiz).liberarInstalacao, false);
        liberarBloqueioAtivacaoDesktop(lock);
        assert.equal(diagnosticarPublicacaoDesktop(raiz).requerIntervencao, false);
        console.log("OK: conclusão não libera instalação automaticamente.");

        console.log("PASSOU: diagnóstico de publicação somente leitura.");
    } finally {
        rmSync(raiz, { recursive: true, force: true });
    }
}
main();
