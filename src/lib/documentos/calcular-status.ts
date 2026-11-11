export type TipoControleDocumento = "VALIDADE" | "REVISAO";
export type ResultadoVerificacaoDocumento = "APRESENTADO" | "NAO_APRESENTADO";

export type StatusDocumento =
    | "NAO_VERIFICADO"
    | "NAO_APRESENTADO"
    | "PRAZO_NAO_INFORMADO"
    | "EM_DIA"
    | "PROXIMO_VENCIMENTO"
    | "VENCE_HOJE"
    | "VENCIDO"
    | "PROXIMA_REVISAO"
    | "REVISAO_HOJE"
    | "REVISAO_ATRASADA";

export type VerificacaoParaStatus = {
    resultado: ResultadoVerificacaoDocumento;
    data_prazo: string | null;
};

export type EntradaStatusDocumento = {
    tipo_controle: TipoControleDocumento;
    alerta_dias: number;
    verificacao: VerificacaoParaStatus | null;
    hoje?: string;
};

export type ResultadoStatusDocumento = {
    status: StatusDocumento;
    dias_restantes: number | null;
    data_prazo: string | null;
    exige_atencao: boolean;
};

function converterDia(data: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
    const instante = Date.parse(data + "T12:00:00Z");
    if (!Number.isFinite(instante) || new Date(instante).toISOString().slice(0, 10) !== data) {
        return null;
    }
    return Math.floor(instante / 86400000);
}

export function dataAtualFortaleza(): string {
    const partes = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Fortaleza",
        year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const parte = (tipo: string) => partes.find((item) => item.type === tipo)?.value ?? "";
    return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

export function calcularStatusDocumento(entrada: EntradaStatusDocumento): ResultadoStatusDocumento {
    const verificacao = entrada.verificacao;
    if (!verificacao) {
        return { status: "NAO_VERIFICADO", dias_restantes: null, data_prazo: null, exige_atencao: true };
    }
    if (verificacao.resultado === "NAO_APRESENTADO") {
        return { status: "NAO_APRESENTADO", dias_restantes: null, data_prazo: null, exige_atencao: true };
    }
    if (!verificacao.data_prazo) {
        return { status: "PRAZO_NAO_INFORMADO", dias_restantes: null, data_prazo: null, exige_atencao: true };
    }

    const hoje = converterDia(entrada.hoje ?? dataAtualFortaleza());
    const prazo = converterDia(verificacao.data_prazo);
    if (hoje === null || prazo === null) {
        return { status: "PRAZO_NAO_INFORMADO", dias_restantes: null, data_prazo: verificacao.data_prazo, exige_atencao: true };
    }
    const dias = prazo - hoje;
    const revisao = entrada.tipo_controle === "REVISAO";
    const alerta = Math.max(0, Math.trunc(entrada.alerta_dias));
    let status: StatusDocumento;
    if (dias < 0) {
        status = revisao ? "REVISAO_ATRASADA" : "VENCIDO";
    } else if (dias === 0) {
        status = revisao ? "REVISAO_HOJE" : "VENCE_HOJE";
    } else if (dias <= alerta) {
        status = revisao ? "PROXIMA_REVISAO" : "PROXIMO_VENCIMENTO";
    } else {
        status = "EM_DIA";
    }
    return {
        status, dias_restantes: dias, data_prazo: verificacao.data_prazo,
        exige_atencao: status !== "EM_DIA",
    };
}
