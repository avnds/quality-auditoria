import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { lerDiarioPublicacaoDesktop, type DiarioPublicacaoDesktop } from "./diario-publicacao";

export type DiagnosticoPublicacaoDesktop = {
    estado: "sem_diario" | "pendente_antes_publicacao" | "publicacao_interrompida" | "verificacao_pendente" | "concluida" | "diario_invalido";
    requerIntervencao: boolean;
    liberarInstalacao: boolean;
    etapa: DiarioPublicacaoDesktop["etapa"] | null;
    copiaRecuperacaoInformada: boolean;
    bloqueioPresente: boolean;
    mensagem: string;
};

/**
 * Diagnóstico conservador, sem escrita. Não interpreta diário concluído como
 * autorização para abrir o Desktop: a instalação ainda precisa ser validada.
 * Nunca remove bloqueios, move arquivos ou inicia rollback.
 */
export function diagnosticarPublicacaoDesktop(raizDados: string): DiagnosticoPublicacaoDesktop {
    const raiz = resolve(raizDados);
    const lock = join(raiz, "controle", "ativacao.lock");
    const bloqueioPresente = existsSync(lock);
    const base = { liberarInstalacao: false, bloqueioPresente };
    let diario: DiarioPublicacaoDesktop | null;
    try {
        diario = lerDiarioPublicacaoDesktop(raiz);
    } catch {
        return {
            ...base, estado: "diario_invalido", requerIntervencao: true,
            etapa: null, copiaRecuperacaoInformada: false,
            mensagem: "Diário ausente de integridade ou ilegível; publicação bloqueada.",
        };
    }
    if (!diario) {
        return {
            ...base, estado: "sem_diario", requerIntervencao: bloqueioPresente,
            etapa: null, copiaRecuperacaoInformada: false,
            mensagem: bloqueioPresente
                ? "Bloqueio sem diário: verificar operação anterior antes de prosseguir."
                : "Nenhuma publicação pendente registrada.",
        };
    }
    const informada = typeof diario.pastaRecuperacao === "string" && diario.pastaRecuperacao.length > 0;
    if (diario.etapa === "preparada" || diario.etapa === "copia_recuperacao_validada") {
        return {
            ...base, estado: "pendente_antes_publicacao", requerIntervencao: true,
            etapa: diario.etapa, copiaRecuperacaoInformada: informada,
            mensagem: "Publicação ainda não iniciada; conferir staging e lock antes de cancelar.",
        };
    }
    if (diario.etapa === "publicacao_iniciada") {
        return {
            ...base, estado: "publicacao_interrompida", requerIntervencao: true,
            etapa: diario.etapa, copiaRecuperacaoInformada: informada,
            mensagem: "Substituição pode estar parcial. Não iniciar o aplicativo nem liberar o lock.",
        };
    }
    if (diario.etapa === "publicacao_concluida") {
        return {
            ...base, estado: "verificacao_pendente", requerIntervencao: true,
            etapa: diario.etapa, copiaRecuperacaoInformada: informada,
            mensagem: "Arquivos publicados, mas verificação final não registrada.",
        };
    }
    return {
        ...base, estado: "concluida", requerIntervencao: bloqueioPresente,
        etapa: diario.etapa, copiaRecuperacaoInformada: informada,
        mensagem: "Diário concluído; validar instalação e resolver eventual bloqueio.",
    };
}
