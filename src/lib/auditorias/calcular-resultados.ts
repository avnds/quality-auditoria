export type ResultadoAuditoria =
    | "CONFORME"
    | "PARCIALMENTE_CONFORME"
    | "NAO_CONFORME"
    | "NAO_APLICAVEL";

export type RespostaParaCalculo = {
    checklist_item_id: string;
    resultado: ResultadoAuditoria | null;
};

export type ResultadoPontuacao = {
    totalItens: number;
    totalRespondidos: number;
    totalConformes: number;
    totalParcialmenteConformes: number;
    totalNaoConformes: number;
    totalNaoAplicaveis: number;
    totalPendentes: number;
    pontosObtidos: number;
    maximoAplicavel: number;
    percentual: number | null;
    alertaAbaixoDe60: boolean;
};

const RESULTADOS_VALIDOS = new Set<ResultadoAuditoria>([
    "CONFORME",
    "PARCIALMENTE_CONFORME",
    "NAO_CONFORME",
    "NAO_APLICAVEL",
]);

export function calcularResultados(
    itens: RespostaParaCalculo[]
): ResultadoPontuacao {
    let totalRespondidos = 0;
    let totalConformes = 0;
    let totalParcialmenteConformes = 0;
    let totalNaoConformes = 0;
    let totalNaoAplicaveis = 0;
    let pontosObtidos = 0;
    let maximoAplicavel = 0;

    for (const item of itens) {
        const resultado = item.resultado;

        if (
            resultado === null ||
            !RESULTADOS_VALIDOS.has(resultado)
        ) {
            continue;
        }

        totalRespondidos++;

        switch (resultado) {
            case "CONFORME":
                totalConformes++;
                pontosObtidos += 2;
                maximoAplicavel += 2;
                break;

            case "PARCIALMENTE_CONFORME":
                totalParcialmenteConformes++;
                pontosObtidos += 1;
                maximoAplicavel += 2;
                break;

            case "NAO_CONFORME":
                totalNaoConformes++;
                maximoAplicavel += 2;
                break;

            case "NAO_APLICAVEL":
                totalNaoAplicaveis++;
                break;
        }
    }

    const totalItens = itens.length;
    const totalPendentes = totalItens - totalRespondidos;

    const percentual =
        maximoAplicavel > 0
            ? (pontosObtidos / maximoAplicavel) * 100
            : null;

    return {
        totalItens,
        totalRespondidos,
        totalConformes,
        totalParcialmenteConformes,
        totalNaoConformes,
        totalNaoAplicaveis,
        totalPendentes,
        pontosObtidos,
        maximoAplicavel,
        percentual,
        alertaAbaixoDe60:
            percentual !== null && percentual < 60,
    };
}