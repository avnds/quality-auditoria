import type { InventarioBlob } from "./inventario-blob";

export type EstadoTransferencia = "pendente" | "baixando" | "validado" | "falhou";

export type ArquivoTransferencia = InventarioBlob["arquivos"][number] & {
    estado: EstadoTransferencia;
    tamanhoBytes: number | null;
    sha256: string | null;
};

export type PlanoTransferencia = {
    versao: 1;
    arquivos: ArquivoTransferencia[];
};

/**
 * Cria um plano em memória. Nenhum arquivo é considerado transferido
 * até que seu conteúdo seja verificado pelo fluxo de importação.
 */
export function criarPlanoTransferencia(inventario: InventarioBlob): PlanoTransferencia {
    return {
        versao: 1,
        arquivos: inventario.arquivos.map((arquivo) => ({
            ...arquivo,
            estado: "pendente",
            tamanhoBytes: null,
            sha256: null,
        })),
    };
}

/**
 * Política rigorosa: qualquer arquivo pendente, baixando ou com falha
 * impede a ativação da instalação.
 */
export function transferenciaCompleta(plano: PlanoTransferencia): boolean {
    return plano.versao === 1 &&
        plano.arquivos.every((arquivo) =>
            arquivo.estado === "validado" &&
            Number.isSafeInteger(arquivo.tamanhoBytes) &&
            arquivo.tamanhoBytes !== null &&
            arquivo.tamanhoBytes > 0 &&
            typeof arquivo.sha256 === "string" &&
            /^[a-f0-9]{64}$/.test(arquivo.sha256)
        );
}
