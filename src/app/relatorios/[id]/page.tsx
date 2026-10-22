"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type ResultadoPontuacao = {
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

type Evidencia = {
    id: string;
    ordem: number;
};

type RespostaItem = {
    id: string;
    resultado: string | null;
    observacao: string | null;
    respondido_em: string | null;
    evidencias: Evidencia[];
};

type ItemAuditoria = {
    id: string;
    texto: string;
    orientacao: string | null;
    ordem: number;
    item_vencimento: number | null;
    resposta: RespostaItem | null;
};

type SecaoAuditoria = {
    id: string;
    nome: string;
    descricao: string | null;
    ordem: number;
    itens: ItemAuditoria[];
};

type SetorAuditoria = {
    id: string;
    setor_id: string;
    nome: string;
    checklist_nome: string;
    checklist_versao_numero: number;
    ordem: number;
    secoes: SecaoAuditoria[];
    resultados: ResultadoPontuacao;
};

type Auditoria = {
    id: string;
    cliente_nome: string;
    loja_id: string;
    loja_nome: string;
    auditor_id: string;
    auditor_nome: string;
    gerente_loja_nome: string | null;
    encarregado_nome: string | null;
    gerente_setor_nome: string | null;
    criada_em: string;
    versao: {
        id: string;
        numero: number;
        status: string;
        criada_em: string;
    };
    podeGerar: boolean;
    podeBaixar: boolean;
    pdfDisponivel: boolean;
    pdfGeradoEm: string | null;
    setores: SetorAuditoria[];
    resultados: ResultadoPontuacao;
};

type ApiResponse = {
    success: boolean;
    message?: string;
    auditoria?: Auditoria;
};

type AcaoResponse = {
    success?: boolean;
    message?: string;
};

function formatarData(valor?: string | null) {
    if (!valor) return "Não informada";

    const data = new Date(valor);

    if (Number.isNaN(data.getTime())) return valor;

    return data.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "America/Fortaleza",
    });
}

function formatarDataHora(valor?: string | null) {
    if (!valor) return "Não informado";

    const data = new Date(valor);

    if (Number.isNaN(data.getTime())) return valor;

    return data.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Fortaleza",
    });
}

function formatarPercentual(valor: number | null | undefined) {
    if (valor == null) return "Não disponível";

    return `${valor.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    })}%`;
}

function nomeResultado(resultado: string | null) {
    switch (resultado) {
        case "CONFORME":
            return "Conforme";
        case "PARCIALMENTE_CONFORME":
            return "Parcialmente conforme";
        case "NAO_CONFORME":
            return "Não conforme";
        case "NAO_APLICAVEL":
            return "Não aplicável";
        default:
            return "Pendente";
    }
}

function corResultado(resultado: string | null) {
    switch (resultado) {
        case "CONFORME":
            return "bg-green-50 text-green-800";
        case "PARCIALMENTE_CONFORME":
            return "bg-amber-50 text-amber-800";
        case "NAO_CONFORME":
            return "bg-red-50 text-red-800";
        case "NAO_APLICAVEL":
            return "bg-slate-100 text-slate-700";
        default:
            return "bg-slate-100 text-slate-500";
    }
}

export default function RelatorioPreviewPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const id = params.id;

    const [auditoria, setAuditoria] = useState<Auditoria | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [gerando, setGerando] = useState(false);

    const carregarRelatorio = useCallback(async () => {
        setErro("");

        try {
            const resposta = await fetch(`/api/relatorios/${id}`, {
                method: "GET",
                cache: "no-store",
            });

            const dados = (await resposta.json()) as ApiResponse;

            if (!resposta.ok || !dados.success || !dados.auditoria) {
                setErro(
                    dados.message ??
                    "Não foi possível carregar a pré-visualização."
                );
                return false;
            }

            setAuditoria(dados.auditoria);
            return true;
        } catch {
            setErro("Erro de comunicação ao carregar o relatório.");
            return false;
        } finally {
            setCarregando(false);
        }
    }, [id]);

    useEffect(() => {
        let ativo = true;

        async function carregar() {
            try {
                const resposta = await fetch(`/api/relatorios/${id}`, {
                    method: "GET",
                    cache: "no-store",
                });

                const dados = (await resposta.json()) as ApiResponse;

                if (!resposta.ok || !dados.success || !dados.auditoria) {
                    if (ativo) {
                        setErro(
                            dados.message ??
                            "Não foi possível carregar a pré-visualização."
                        );
                    }
                    return;
                }

                if (ativo) {
                    setAuditoria(dados.auditoria);
                    setErro("");
                }
            } catch {
                if (ativo) {
                    setErro("Erro de comunicação ao carregar o relatório.");
                }
            } finally {
                if (ativo) {
                    setCarregando(false);
                }
            }
        }

        void carregar();

        return () => {
            ativo = false;
        };
    }, [id]);

    async function gerarRelatorio() {
        if (!auditoria?.podeGerar || gerando) return;

        setGerando(true);
        setErro("");

        try {
            const resposta = await fetch(
                `/api/relatorios/${id}/gerar`,
                { method: "POST" }
            );

            const dados = (await resposta.json()) as AcaoResponse;

            if (!resposta.ok || !dados.success) {
                setErro(
                    dados.message ?? "Não foi possível gerar o PDF."
                );
                return;
            }

            const atualizado = await carregarRelatorio();

            if (atualizado) {
                window.alert("Relatório PDF gerado com sucesso.");
            }
        } catch {
            setErro("Erro de comunicação ao gerar o relatório.");
        } finally {
            setGerando(false);
        }
    }

    function baixarPdf() {
        if (!auditoria?.podeBaixar || !auditoria.pdfDisponivel) return;

        window.location.assign(`/api/relatorios/${id}/pdf`);
    }

    if (carregando) {
        return (
            <main className="mx-auto max-w-6xl p-6">
                <p className="text-sm text-slate-600">
                    Carregando pré-visualização...
                </p>
            </main>
        );
    }

    if (!auditoria) {
        return (
            <main className="mx-auto max-w-6xl space-y-4 p-6">
                <button
                    type="button"
                    onClick={() => router.push("/relatorios")}
                    className="text-sm font-medium text-blue-800 hover:underline"
                >
                    ← Voltar para relatórios
                </button>

                <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                >
                    {erro || "Não foi possível carregar esta auditoria."}
                </div>

                <button
                    type="button"
                    onClick={() => void carregarRelatorio()}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                    Tentar novamente
                </button>
            </main>
        );
    }

    const resultados = auditoria.resultados;

    return (
        <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={() => router.push("/relatorios")}
                    className="text-sm font-medium text-blue-800 hover:underline"
                >
                    ← Voltar para relatórios
                </button>

                <div className="flex flex-wrap items-center gap-2">
                    {auditoria.podeBaixar && auditoria.pdfDisponivel && (
                        <button
                            type="button"
                            onClick={baixarPdf}
                            className="rounded-lg border border-[#002B5C] px-5 py-3 text-sm font-semibold text-[#002B5C] hover:bg-slate-50"
                        >
                            Baixar PDF
                        </button>
                    )}

                    {auditoria.podeGerar && (
                        <button
                            type="button"
                            onClick={() => void gerarRelatorio()}
                            disabled={gerando}
                            className="rounded-lg bg-[#002B5C] px-5 py-3 text-sm font-semibold text-white hover:bg-[#003d80] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {gerando
                                ? "Gerando relatório..."
                                : auditoria.pdfDisponivel
                                    ? "Gerar PDF novamente"
                                    : "Gerar relatório PDF"}
                        </button>
                    )}
                </div>
            </div>

            {erro && (
                <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                >
                    {erro}
                </div>
            )}

            {auditoria.pdfDisponivel && (
                <p className="text-sm text-slate-600">
                    PDF disponível.
                    {auditoria.pdfGeradoEm
                        ? ` Última geração: ${formatarDataHora(auditoria.pdfGeradoEm)}.`
                        : ""}
                </p>
            )}

            {!auditoria.pdfDisponivel && !auditoria.podeGerar && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    O PDF ainda não foi gerado. Você não tem permissão para
                    gerá-lo; solicite a geração a uma supervisora.
                </p>
            )}

            <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-[#c22a2e]">
                    Pré-visualização do relatório
                </p>

                <h1 className="mt-2 text-2xl font-bold text-[#12223f]">
                    {auditoria.cliente_nome}
                </h1>

                <p className="mt-1 text-lg text-slate-700">
                    {auditoria.loja_nome}
                </p>

                <div className="mt-5 grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                        <p className="text-xs text-slate-500">Auditor</p>
                        <p className="mt-1 font-medium text-slate-900">
                            {auditoria.auditor_nome}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs text-slate-500">Gerente da Loja</p>
                        <p className="mt-1 font-medium text-slate-900">
                            {auditoria.gerente_loja_nome || "Não informado"}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs text-slate-500">Encarregado do Setor</p>
                        <p className="mt-1 font-medium text-slate-900">
                            {auditoria.encarregado_nome || "Não informado"}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs text-slate-500">Gerente do Setor</p>
                        <p className="mt-1 font-medium text-slate-900">
                            {auditoria.gerente_setor_nome || "Não informado"}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs text-slate-500">Data da auditoria</p>
                        <p className="mt-1 font-medium text-slate-900">
                            {formatarData(auditoria.criada_em)}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs text-slate-500">Versão</p>
                        <p className="mt-1 font-medium text-slate-900">
                            {auditoria.versao.numero}
                        </p>
                    </div>
                </div>
            </header>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-[#12223f]">
                    Resultado geral
                </h2>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">Pontuação</p>
                        <p className="mt-2 text-2xl font-bold text-[#12223f]">
                            {formatarPercentual(resultados.percentual)}
                        </p>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">Pontos obtidos</p>
                        <p className="mt-2 text-2xl font-bold text-[#12223f]">
                            {resultados.pontosObtidos}
                        </p>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">
                            Itens respondidos
                        </p>
                        <p className="mt-2 text-2xl font-bold text-[#12223f]">
                            {resultados.totalRespondidos}
                        </p>
                    </div>

                    <div className="rounded-lg bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">
                            Não conformidades
                        </p>
                        <p className="mt-2 text-2xl font-bold text-red-700">
                            {resultados.totalNaoConformes}
                        </p>
                    </div>
                </div>
            </section>

            <section className="space-y-4">
                <h2 className="text-xl font-bold text-[#12223f]">
                    Resultados por setor
                </h2>

                {auditoria.setores.map((setor) => (
                    <article
                        key={setor.id}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
                            <div>
                                <h3 className="text-lg font-semibold text-[#12223f]">
                                    {setor.nome}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    {setor.checklist_nome} — versão{" "}
                                    {setor.checklist_versao_numero}
                                </p>
                            </div>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800">
                                {formatarPercentual(
                                    setor.resultados.percentual
                                )}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
                            <div>
                                <p className="text-xs text-slate-500">
                                    Pontos obtidos
                                </p>
                                <p className="font-semibold">
                                    {setor.resultados.pontosObtidos}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-slate-500">
                                    Máximo aplicável
                                </p>
                                <p className="font-semibold">
                                    {setor.resultados.maximoAplicavel}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-slate-500">
                                    Conformes
                                </p>
                                <p className="font-semibold text-green-700">
                                    {setor.resultados.totalConformes}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-slate-500">
                                    Não conformes
                                </p>
                                <p className="font-semibold text-red-700">
                                    {setor.resultados.totalNaoConformes}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-5 p-4">
                            {setor.secoes.map((secao) => (
                                <section
                                    key={secao.id}
                                    className="space-y-3"
                                >
                                    <div>
                                        <h4 className="font-semibold text-slate-900">
                                            {secao.nome}
                                        </h4>

                                        {secao.descricao && (
                                            <p className="mt-1 text-sm text-slate-500">
                                                {secao.descricao}
                                            </p>
                                        )}
                                    </div>

                                    {secao.itens.map((item) => {
                                        const resposta = item.resposta;
                                        const resultado =
                                            resposta?.resultado ?? null;

                                        return (
                                            <div
                                                key={item.id}
                                                className="rounded-lg border border-slate-200 p-3"
                                            >
                                                <div className="flex flex-wrap items-start justify-between gap-2">
                                                    <p className="font-medium text-slate-900">
                                                        {item.texto}
                                                    </p>

                                                    <span
                                                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${corResultado(resultado)}`}
                                                    >
                                                        {nomeResultado(resultado)}
                                                    </span>
                                                </div>

                                                {item.orientacao && (
                                                    <p className="mt-2 text-sm text-slate-500">
                                                        Orientação:{" "}
                                                        {item.orientacao}
                                                    </p>
                                                )}

                                                {resposta?.observacao && (
                                                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                                        <strong>
                                                            Observação:
                                                        </strong>{" "}
                                                        {resposta.observacao}
                                                    </p>
                                                )}

                                                {resposta?.evidencias &&
                                                    resposta.evidencias.length > 0 && (
                                                        <p className="mt-2 text-xs text-slate-500">
                                                            {resposta.evidencias.length}{" "}
                                                            evidência(s) anexada(s).
                                                            As imagens serão
                                                            incorporadas ao PDF
                                                            na geração.
                                                        </p>
                                                    )}
                                            </div>
                                        );
                                    })}
                                </section>
                            ))}
                        </div>
                    </article>
                ))}
            </section>

            <footer className="border-t border-slate-200 py-4 text-xs text-slate-500">
                Pré-visualização da auditoria finalizada. O PDF é gerado
                somente quando uma pessoa autorizada solicita a geração.
            </footer>
        </main>
    );
}