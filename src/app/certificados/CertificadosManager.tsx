"use client";

import { useMemo, useState } from "react";

type Certificado = {
    participanteId: string;
    clienteId: string;
    lojaId: string;
    treinamentoId: string;
    nomeColaborador: string;
    cargoColaborador: string | null;
    nomeLoja: string;
    nomeCliente: string;
    tituloTreinamento: string;
    dataRealizacao: string;
    cargaHorariaMinutos: number;
    certificadoId: string | null;
    certificadoNumero: string | null;
    emitidoEm: string | null;
};

type FiltroHistorico = "hoje" | "semana" | "mes" | "tudo" | "personalizado";

const campo = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#22365b] focus:ring-2 focus:ring-[#22365b]/10";

function dataISO(data: Date) {
    return [data.getFullYear(), String(data.getMonth() + 1).padStart(2, "0"), String(data.getDate()).padStart(2, "0")].join("-");
}

function formatarData(valor: string) {
    const [ano, mes, dia] = valor.slice(0, 10).split("-");
    return dia && mes && ano ? `${dia}-${mes}-${ano}` : valor;
}

export default function CertificadosManager({ certificados: iniciais, podeGerar }: { certificados: Certificado[]; podeGerar: boolean }) {
    const [certificados, setCertificados] = useState(iniciais);
    const [filtroHistorico, setFiltroHistorico] = useState<FiltroHistorico>("mes");
    const [dataInicial, setDataInicial] = useState("");
    const [dataFinal, setDataFinal] = useState("");
    const [clienteSelecionado, setClienteSelecionado] = useState("");
    const [lojaSelecionada, setLojaSelecionada] = useState("");

    const clientes = useMemo(() => Array.from(new Map(certificados.map((cert) => [cert.clienteId, { id: cert.clienteId, nome: cert.nomeCliente }])).values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [certificados]);
    const lojas = useMemo(() => Array.from(new Map(certificados.filter((cert) => !clienteSelecionado || cert.clienteId === clienteSelecionado).map((cert) => [cert.lojaId, { id: cert.lojaId, nome: cert.nomeLoja, cliente: cert.nomeCliente }])).values()).sort((a, b) => a.cliente.localeCompare(b.cliente, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR")), [certificados, clienteSelecionado]);
    const [emitindo, setEmitindo] = useState<string | null>(null);
    const [mensagem, setMensagem] = useState("");
    const [erro, setErro] = useState(false);

    const filtrados = useMemo(() => {
        const hoje = new Date();
        const hojeISO = dataISO(hoje);
        const inicioSemana = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        inicioSemana.setDate(inicioSemana.getDate() - (inicioSemana.getDay() + 6) % 7);
        const inicioSemanaISO = dataISO(inicioSemana);
        const inicioMesISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
        return certificados.filter((cert) => {
            if (clienteSelecionado && cert.clienteId !== clienteSelecionado) return false;
            if (lojaSelecionada && cert.lojaId !== lojaSelecionada) return false;
            const data = cert.dataRealizacao.slice(0, 10);
            if (filtroHistorico === "hoje") return data === hojeISO;
            if (filtroHistorico === "semana") return data >= inicioSemanaISO && data <= hojeISO;
            if (filtroHistorico === "mes") return data >= inicioMesISO && data <= hojeISO;
            if (filtroHistorico === "personalizado") {
                if (dataInicial && data < dataInicial) return false;
                if (dataFinal && data > dataFinal) return false;
            }
            return true;
        });
    }, [certificados, filtroHistorico, dataInicial, dataFinal, clienteSelecionado, lojaSelecionada]);

    async function emitirCertificado(cert: Certificado) {
        setEmitindo(cert.participanteId);
        setMensagem("");
        setErro(false);
        try {
            const response = await fetch(
                `/api/treinamentos/${encodeURIComponent(cert.treinamentoId)}/certificados/${encodeURIComponent(cert.participanteId)}`,
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
            const numero = response.headers.get("X-Certificado-Numero") || cert.participanteId;
            const url = URL.createObjectURL(arquivo);
            const link = document.createElement("a");
            link.href = url;
            link.download = `certificado-${numero}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            const regenerado = response.headers.get("X-Certificado-Regenerado") === "true";
            setCertificados((anteriores) => anteriores.map((item) =>
                item.participanteId === cert.participanteId
                    ? { ...item, certificadoId: item.certificadoId || "emitido", certificadoNumero: numero }
                    : item
            ));
            setMensagem(`Certificado ${numero} ${regenerado ? "regenerado" : "emitido"}. O download foi iniciado.`);
        } catch (error) {
            setErro(true);
            setMensagem(error instanceof Error ? error.message : "Erro ao emitir certificado.");
        } finally {
            setEmitindo(null);
        }
    }

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-[#12223f]">Participantes e certificados</h2>
                <p className="mt-1 text-sm text-slate-500">Emita ou gere novamente o PDF individual de cada participante.</p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="w-full sm:max-w-xs">
                        <label htmlFor="filtro-certificados" className="mb-1 block text-xs font-semibold text-slate-600">Exibir certificados</label>
                        <select id="filtro-certificados" value={filtroHistorico} onChange={(e) => setFiltroHistorico(e.target.value as FiltroHistorico)} className={campo}>
                            <option value="hoje">Hoje</option>
                            <option value="semana">Esta semana</option>
                            <option value="mes">Este mês</option>
                            <option value="tudo">Tudo</option>
                            <option value="personalizado">Personalizado</option>
                        </select>
                    </div>
                    <div className="w-full sm:max-w-xs">
                        <label htmlFor="filtro-cliente-certificados" className="mb-1 block text-xs font-semibold text-slate-600">Cliente</label>
                        <select id="filtro-cliente-certificados" value={clienteSelecionado} onChange={(e) => { setClienteSelecionado(e.target.value); setLojaSelecionada(""); }} className={campo}>
                            <option value="">Todos os clientes</option>
                            {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
                        </select>
                    </div>
                    <div className="w-full sm:max-w-xs">
                        <label htmlFor="filtro-loja-certificados" className="mb-1 block text-xs font-semibold text-slate-600">Loja</label>
                        <select id="filtro-loja-certificados" value={lojaSelecionada} onChange={(e) => setLojaSelecionada(e.target.value)} className={campo}>
                            <option value="">Todas as lojas</option>
                            {lojas.map((loja) => <option key={loja.id} value={loja.id}>{loja.nome} · {loja.cliente}</option>)}
                        </select>
                    </div>
                    {filtroHistorico === "personalizado" && (
                        <div className="grid w-full gap-3 sm:max-w-lg sm:grid-cols-2">
                            <label className="text-xs font-semibold text-slate-600">
                                Data inicial
                                <input type="date" value={dataInicial} max={dataFinal || undefined} onChange={(e) => setDataInicial(e.target.value)} className={campo} />
                            </label>
                            <label className="text-xs font-semibold text-slate-600">
                                Data final
                                <input type="date" value={dataFinal} min={dataInicial || undefined} onChange={(e) => setDataFinal(e.target.value)} className={campo} />
                            </label>
                        </div>
                    )}
                    <p className="text-xs text-slate-500 sm:whitespace-nowrap">{filtrados.length} de {certificados.length} participante(s)</p>
                </div>
                {mensagem && (
                    <p role="status" className={`mt-4 rounded-lg px-4 py-3 text-sm ${erro ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{mensagem}</p>
                )}
            </div>
            {certificados.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">Nenhum participante de treinamento encontrado.</p>
            ) : filtrados.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">Nenhum certificado encontrado para os filtros selecionados.</p>
            ) : (
                <div className="divide-y divide-slate-100">
                    {filtrados.map((cert) => (
                        <article key={cert.participanteId} className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="font-semibold text-slate-800">{cert.nomeColaborador}</p>
                                {cert.cargoColaborador && <p className="text-xs text-slate-500">{cert.cargoColaborador}</p>}
                                <p className="mt-1 text-sm text-slate-600">{cert.tituloTreinamento}</p>
                                <p className="mt-1 text-xs text-slate-500">{cert.nomeCliente} · {cert.nomeLoja}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                    Realizado em {formatarData(cert.dataRealizacao)} · {Math.floor(cert.cargaHorariaMinutos / 60)}h {cert.cargaHorariaMinutos % 60}min
                                </p>
                                <p className={`mt-1 text-xs font-semibold ${cert.certificadoId ? "text-emerald-700" : "text-slate-500"}`}>
                                    {cert.certificadoId ? `Emitido: ${cert.certificadoNumero || "certificado existente"}` : "Certificado ainda não emitido"}
                                </p>
                            </div>
                            {podeGerar ? (
                                <button type="button" onClick={() => emitirCertificado(cert)} disabled={emitindo !== null} className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#22365b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#182947] disabled:cursor-not-allowed disabled:opacity-50">
                                    {emitindo === cert.participanteId
                                        ? (cert.certificadoId ? "Regenerando..." : "Emitindo...")
                                        : (cert.certificadoId ? "Gerar novamente" : "Gerar certificado")}
                                </button>
                            ) : (
                                <span className="text-xs text-slate-500">Emissão indisponível para seu perfil</span>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
