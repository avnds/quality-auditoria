import type { IntegridadeEsperada } from "./conferir-integridade-esperada";
import { conferirIntegridadeEsperada } from "./conferir-integridade-esperada";
import { conferirArquivosTransferidos } from "./conferir-arquivos-transferidos";
import { gravarArquivoStaging } from "./gravar-arquivo-staging";
import type { PlanoTransferencia } from "./plano-transferencia";

/**
 * Orquestra somente a transferência local, nunca a ativação da instalação.
 * Uma falha marca o arquivo como falhou e impede a conclusão do plano.
 */
export async function transferirArquivoDoPlano(
    plano: PlanoTransferencia,
    raizStaging: string,
    tipo: IntegridadeEsperada["tipo"],
    registroId: string,
    stream: ReadableStream<Uint8Array>,
    esperado: IntegridadeEsperada
): Promise<void> {
    const encontrados = plano.arquivos.filter((item) =>
        item.tipo === tipo && item.registroId === registroId
    );
    if (plano.versao !== 1 || encontrados.length !== 1 ||
        esperado.tipo !== tipo || esperado.registroId !== registroId) {
        throw new Error("Arquivo não pertence ao plano de transferência.");
    }
    const arquivo = encontrados[0];
    if (arquivo.estado !== "pendente") {
        throw new Error("Arquivo já iniciado ou concluído.");
    }
    arquivo.estado = "baixando";
    arquivo.tamanhoBytes = null;
    arquivo.sha256 = null;
    try {
        const resultado = await gravarArquivoStaging(
            raizStaging, arquivo.destinoRelativo, stream, esperado
        );
        arquivo.tamanhoBytes = resultado.tamanhoBytes;
        arquivo.sha256 = resultado.sha256;
        arquivo.estado = "validado";
    } catch (erro) {
        arquivo.estado = "falhou";
        arquivo.tamanhoBytes = null;
        arquivo.sha256 = null;
        throw erro;
    }
}

/**
 * Confere tanto os metadados de origem quanto os bytes reais gravados.
 * Não ativa o Desktop e não altera banco de dados.
 */
export async function concluirTransferenciaDoPlano(
    plano: PlanoTransferencia,
    raizStaging: string,
    esperados: readonly IntegridadeEsperada[]
): Promise<boolean> {
    if (!conferirIntegridadeEsperada(plano, esperados)) return false;
    return conferirArquivosTransferidos(plano, raizStaging);
}
