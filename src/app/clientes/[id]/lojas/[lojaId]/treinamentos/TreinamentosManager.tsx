"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Colaborador = {
    id: string;
    nome: string;
    cargo: string | null;
    ativo: number;
};

type Treinamento = {
    id: string;
    titulo: string;
    data_realizacao: string;
    validade_meses: number | null;
    carga_horaria_minutos: number;
    conteudo_programatico: string | null;
    ministrante: string;
    total_participantes: number;
    participantes: string | null;
    participantesDetalhados: {
        id: string;
        nome: string;
        cargo: string | null;
        certificadoId: string | null;
        certificadoNumero: string | null;
    }[];
};

type Props = { lojaId: string };

type FiltroHistorico = "hoje" | "semana" | "mes" | "tudo" | "personalizado";

const campo =
    "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#22365b] focus:ring-2 focus:ring-[#22365b]/10";

function formatarData(data: string) {
    const [ano, mes, dia] = data.slice(0, 10).split("-");
    return dia && mes && ano ? `${dia}-${mes}-${ano}` : data;
}

function calcularVencimento(data: string, meses: number) {
    const [ano, mes, dia] = data.slice(0, 10).split("-").map(Number);
    const dataBase = new Date(Date.UTC(ano, mes - 1, 1));
    const mesDestino = dataBase.getUTCMonth() + meses;
    const anoDestino = dataBase.getUTCFullYear() + Math.floor(mesDestino / 12);
    const numeroMes = ((mesDestino % 12) + 12) % 12;
    const ultimoDia = new Date(Date.UTC(anoDestino, numeroMes + 1, 0)).getUTCDate();
    const vencimento = new Date(Date.UTC(anoDestino, numeroMes, Math.min(dia, ultimoDia)));
    return vencimento.toISOString().slice(0, 10);
}

function formatarCargaHoraria(minutos: number) {
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    if (horas && resto) return `${horas}h ${resto}min`;
    if (horas) return `${horas}h`;
    return `${resto}min`;
}

export default function TreinamentosManager({ lojaId }: Props) {
    const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
    const [treinamentos, setTreinamentos] = useState<Treinamento[]>([]);
    const [selecionados, setSelecionados] = useState<string[]>([]);
    const [titulo, setTitulo] = useState("Treinamento de Boas Práticas");
    const [dataRealizacao, setDataRealizacao] = useState(() => {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, "0");
        const dia = String(hoje.getDate()).padStart(2, "0");
        return `${ano}-${mes}-${dia}`;
    });
    const [cargaHoraria, setCargaHoraria] = useState("4");
    const [validadeMeses, setValidadeMeses] = useState("12");
    const [conteudoProgramatico, setConteudoProgramatico] = useState("");
    const [ministrante, setMinistrante] = useState("");
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [mensagem, setMensagem] = useState("");
    const [erro, setErro] = useState(false);
    const [emitindo, setEmitindo] = useState<string | null>(null);
    const [filtroHistorico, setFiltroHistorico] = useState<FiltroHistorico>("mes");
    const [dataInicial, setDataInicial] = useState("");
    const [dataFinal, setDataFinal] = useState("");

    const carregar = useCallback(async () => {
        const [colaboradoresResponse, treinamentosResponse] = await Promise.all([
            fetch(`/api/lojas/${lojaId}/colaboradores`),
            fetch(`/api/lojas/${lojaId}/treinamentos`),
        ]);
        const [colaboradoresData, treinamentosData] = await Promise.all([
            colaboradoresResponse.json(),
            treinamentosResponse.json(),
        ]);

        if (!colaboradoresResponse.ok || !colaboradoresData.success) {
            throw new Error(colaboradoresData.message || "Não foi possível carregar os colaboradores.");
        }
        if (!treinamentosResponse.ok || !treinamentosData.success) {
            throw new Error(treinamentosData.message || "Não foi possível carregar os treinamentos.");
        }

        setColaboradores(colaboradoresData.colaboradores);
        setTreinamentos(treinamentosData.treinamentos);
    }, [lojaId]);

    useEffect(() => {
        let ativo = true;
        carregar()
            .catch((error: unknown) => {
                if (ativo) {
                    setErro(true);
                    setMensagem(error instanceof Error ? error.message : "Erro ao carregar os dados.");
                }
            })
            .finally(() => {
                if (ativo) setCarregando(false);
            });
        return () => {
            ativo = false;
        };
    }, [carregar]);

    function alternarColaborador(id: string) {
        setSelecionados((atuais) =>
            atuais.includes(id)
                ? atuais.filter((item) => item !== id)
                : [...atuais, id]
        );
    }

    async function salvar(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSalvando(true);
        setMensagem("");
        setErro(false);

        try {
            const minutos = Math.round(Number(cargaHoraria.replace(",", ".")) * 60);
            if (!Number.isFinite(minutos) || minutos <= 0) {
                throw new Error("Informe uma carga horária válida.");
            }

            const response = await fetch(`/api/lojas/${lojaId}/treinamentos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    titulo,
                    dataRealizacao,
                    validadeMeses: Number(validadeMeses),
                    cargaHorariaMinutos: minutos,
                    conteudoProgramatico,
                    ministrante,
                    colaboradorIds: selecionados,
                }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Não foi possível registrar o treinamento.");
            }

            setMensagem(data.message);
            setTitulo("Treinamento de Boas Práticas");
            setCargaHoraria("4");
            setValidadeMeses("12");
            setConteudoProgramatico("");
            setSelecionados([]);
            await carregar();
        } catch (error) {
            setErro(true);
            setMensagem(error instanceof Error ? error.message : "Erro ao registrar treinamento.");
        } finally {
            setSalvando(false);
        }
    }

    async function emitirCertificado(treinamentoId: string, participanteId: string) {
        setEmitindo(participanteId);
        setMensagem("");
        setErro(false);
        try {
            const response = await fetch(
                `/api/treinamentos/${treinamentoId}/certificados/${participanteId}`,
                { method: "POST" }
            );
            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || "Não foi possível emitir o certificado.");
            }

            const arquivo = await response.blob();
            if (arquivo.type !== "application/pdf" || arquivo.size === 0) {
                throw new Error("A emissão não retornou um PDF válido.");
            }

            const url = URL.createObjectURL(arquivo);
            const link = document.createElement("a");
            link.href = url;
            link.download = `certificado-${response.headers.get("X-Certificado-Numero") || participanteId}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            const numero = response.headers.get("X-Certificado-Numero") || "";
            const nome = decodeURIComponent(response.headers.get("X-Certificado-Nome") || "");
            const regenerado = response.headers.get("X-Certificado-Regenerado") === "true";
            setMensagem(
                `Certificado ${numero} ${regenerado ? "regenerado" : "emitido"}${nome ? ` para ${nome}` : ""}. O download foi iniciado.`
            );
            await carregar();
        } catch (error) {
            setErro(true);
            setMensagem(error instanceof Error ? error.message : "Erro ao emitir certificado.");
        } finally {
            setEmitindo(null);
        }
    }

    const ativos = colaboradores.filter((colaborador) => colaborador.ativo === 1);

    const treinamentosFiltrados = useMemo(() => {
        const hoje = new Date();
        const hojeISO = [
            hoje.getFullYear(),
            String(hoje.getMonth() + 1).padStart(2, "0"),
            String(hoje.getDate()).padStart(2, "0"),
        ].join("-");
        const inicioSemana = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        const diaSemana = (inicioSemana.getDay() + 6) % 7;
        inicioSemana.setDate(inicioSemana.getDate() - diaSemana);
        const inicioSemanaISO = [
            inicioSemana.getFullYear(),
            String(inicioSemana.getMonth() + 1).padStart(2, "0"),
            String(inicioSemana.getDate()).padStart(2, "0"),
        ].join("-");
        const inicioMesISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;

        return treinamentos.filter((treinamento) => {
            const data = treinamento.data_realizacao.slice(0, 10);
            if (filtroHistorico === "hoje") return data === hojeISO;
            if (filtroHistorico === "semana") return data >= inicioSemanaISO && data <= hojeISO;
            if (filtroHistorico === "mes") return data >= inicioMesISO && data <= hojeISO;
            if (filtroHistorico === "personalizado") {
                if (dataInicial && data < dataInicial) return false;
                if (dataFinal && data > dataFinal) return false;
            }
            return true;
        });
    }, [treinamentos, filtroHistorico, dataInicial, dataFinal]);

    return (
        <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                    <h2 className="text-xl font-semibold text-[#12223f]">Registrar treinamento</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Informe os dados da capacitação e marque os colaboradores que participaram.
                    </p>
                </div>

                <form onSubmit={salvar} className="mt-6 space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                            Título do treinamento *
                            <input className={campo} value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={180} />
                        </label>

                        <label className="text-sm font-medium text-slate-700">
                            Data de realização *
                            <input className={campo} type="date" value={dataRealizacao} onChange={(e) => setDataRealizacao(e.target.value)} required />
                        </label>

                        <label className="text-sm font-medium text-slate-700">
                            Validade do treinamento (meses) *
                            <input className={campo} type="number" min="1" max="120" step="1" value={validadeMeses} onChange={(e) => setValidadeMeses(e.target.value)} required />
                        </label>

                        <label className="text-sm font-medium text-slate-700">
                            Carga horária (horas) *
                            <input className={campo} type="number" min="0.25" max="24" step="0.25" value={cargaHoraria} onChange={(e) => setCargaHoraria(e.target.value)} required />
                        </label>

                        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                            Ministrante *
                            <input className={campo} value={ministrante} onChange={(e) => setMinistrante(e.target.value)} required maxLength={180} placeholder="Nome do responsável pelo treinamento" />
                        </label>

                        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                            Conteúdo programático
                            <textarea className={campo} rows={4} value={conteudoProgramatico} onChange={(e) => setConteudoProgramatico(e.target.value)} maxLength={5000} placeholder="Descreva os assuntos abordados no treinamento..." />
                        </label>
                    </div>

                    <div className="rounded-xl border border-slate-200">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                            <div>
                                <h3 className="font-semibold text-[#12223f]">Participantes *</h3>
                                <p className="text-xs text-slate-500">Somente colaboradores ativos desta loja.</p>
                            </div>
                            <span className="rounded-full bg-[#22365b]/10 px-3 py-1 text-xs font-semibold text-[#22365b]">
                                {selecionados.length} selecionado(s)
                            </span>
                        </div>

                        {ativos.length === 0 ? (
                            <p className="p-5 text-sm text-slate-500">
                                Não há colaboradores ativos cadastrados. Cadastre ou reative colaboradores antes de registrar o treinamento.
                            </p>
                        ) : (
                            <div className="grid gap-1 p-3 sm:grid-cols-2">
                                {ativos.map((colaborador) => (
                                    <label key={colaborador.id} className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-3 transition hover:bg-slate-50">
                                        <input
                                            type="checkbox"
                                            checked={selecionados.includes(colaborador.id)}
                                            onChange={() => alternarColaborador(colaborador.id)}
                                            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#22365b]"
                                        />
                                        <span>
                                            <span className="block text-sm font-semibold text-slate-800">{colaborador.nome}</span>
                                            {colaborador.cargo && <span className="block text-xs text-slate-500">{colaborador.cargo}</span>}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="submit"
                            disabled={salvando || ativos.length === 0 || selecionados.length === 0}
                            className="rounded-lg bg-[#22365b] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#182947] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {salvando ? "Registrando..." : "Registrar treinamento"}
                        </button>
                        <span className="text-xs text-slate-500">Após registrar, os participantes ficam vinculados ao histórico desta capacitação.</span>
                    </div>
                </form>

                {mensagem && (
                    <p role="status" className={`mt-4 rounded-lg px-4 py-3 text-sm ${erro ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {mensagem}
                    </p>
                )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-4">
                    <h2 className="text-xl font-semibold text-[#12223f]">Histórico de treinamentos</h2>
                    <p className="mt-1 text-sm text-slate-500">Registros anteriores e respectivos participantes.</p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div className="w-full sm:max-w-xs">
                            <label htmlFor="filtro-historico" className="mb-1 block text-xs font-semibold text-slate-600">Exibir treinamentos</label>
                            <select
                                id="filtro-historico"
                                value={filtroHistorico}
                                onChange={(e) => setFiltroHistorico(e.target.value as FiltroHistorico)}
                                className={campo}
                            >
                                <option value="hoje">Hoje</option>
                                <option value="semana">Esta semana</option>
                                <option value="mes">Este mês</option>
                                <option value="tudo">Tudo</option>
                                <option value="personalizado">Personalizado</option>
                            </select>
                        </div>
                        {filtroHistorico === "personalizado" && (
                            <div className="grid w-full gap-3 sm:max-w-lg sm:grid-cols-2">
                                <label className="text-xs font-semibold text-slate-600">
                                    Data inicial
                                    <input
                                        type="date"
                                        value={dataInicial}
                                        max={dataFinal || undefined}
                                        onChange={(e) => setDataInicial(e.target.value)}
                                        className={campo}
                                    />
                                </label>
                                <label className="text-xs font-semibold text-slate-600">
                                    Data final
                                    <input
                                        type="date"
                                        value={dataFinal}
                                        min={dataInicial || undefined}
                                        onChange={(e) => setDataFinal(e.target.value)}
                                        className={campo}
                                    />
                                </label>
                            </div>
                        )}
                        <p className="text-xs text-slate-500 sm:whitespace-nowrap">
                            {treinamentosFiltrados.length} de {treinamentos.length} treinamento(s)
                        </p>
                    </div>
                </div>

                {carregando ? (
                    <p className="p-6 text-sm text-slate-500">Carregando histórico...</p>
                ) : treinamentos.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-500">Nenhum treinamento registrado para esta loja.</p>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {treinamentos.map((treinamento) => (
                            <article key={treinamento.id} className="px-6 py-5">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <h3 className="font-semibold text-slate-800">{treinamento.titulo}</h3>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {formatarData(treinamento.data_realizacao)} · {formatarCargaHoraria(Number(treinamento.carga_horaria_minutos))} · Ministrante: {treinamento.ministrante}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Validade: {treinamento.validade_meses ? `${treinamento.validade_meses} meses · vence em ${formatarData(calcularVencimento(treinamento.data_realizacao, treinamento.validade_meses))}` : "Não informada para este registro"}
                                        </p>
                                    </div>
                                    <span className="w-fit rounded-full bg-[#22365b]/10 px-3 py-1 text-xs font-semibold text-[#22365b]">
                                        {Number(treinamento.total_participantes)} participante(s)
                                    </span>
                                </div>
                                {treinamento.conteudo_programatico && (
                                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{treinamento.conteudo_programatico}</p>
                                )}
                                <div className="mt-4">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Participantes e certificados</p>
                                    {treinamento.participantesDetalhados.length === 0 ? (
                                        <p className="text-sm text-slate-500">Nenhum participante informado.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {treinamento.participantesDetalhados.map((participante) => (
                                                <div key={participante.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-800">{participante.nome}</p>
                                                        {participante.cargo && <p className="text-xs text-slate-500">{participante.cargo}</p>}
                                                        {participante.certificadoNumero && (
                                                            <p className="mt-1 text-xs font-semibold text-emerald-700">Emitido: {participante.certificadoNumero}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {participante.certificadoId && (
                                                            <span className="text-xs font-semibold text-emerald-700">Certificado emitido</span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => emitirCertificado(treinamento.id, participante.id)}
                                                            disabled={emitindo !== null}
                                                            className="rounded-lg bg-[#22365b] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#182947] disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            {emitindo === participante.id
                                                                ? (participante.certificadoId ? "Regenerando..." : "Emitindo...")
                                                                : (participante.certificadoId ? "Gerar novamente" : "Gerar certificado")}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

