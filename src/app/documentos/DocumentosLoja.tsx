"use client";

import { useEffect, useState } from "react";
import FormularioVerificacao from "./FormularioVerificacao";
import GerenciarDocumentos from "./GerenciarDocumentos";

type Documento = {
    id: string; nome: string; modalidade: "LOJA" | "COLABORADOR";
    tipo_controle: "VALIDADE" | "REVISAO"; ativo: number;
    periodicidade_meses: number | null; alerta_dias: number | null;
    periodicidade_padrao: number | null; alerta_padrao: number;
};
type Status = {
    documento_loja_id: string; instancia_id: string | null;
    colaborador_nome: string | null; status: string; dias_restantes: number | null;
    data_prazo: string | null; verificacao_id: string | null;
};
type Colaborador = { colaborador_id: string; nome: string; cargo: string | null; colaborador_ativo: number; instancia_id: string | null; instancia_ativa: number | null };
type Resumo = { total: number; verificados: number; exigem_atencao: number };
const rotulos: Record<string, string> = {
    NAO_VERIFICADO: "Não verificado", NAO_APRESENTADO: "Não apresentado",
    PRAZO_NAO_INFORMADO: "Prazo não informado", EM_DIA: "Em dia",
    PROXIMO_VENCIMENTO: "Próximo do vencimento", VENCE_HOJE: "Vence hoje",
    VENCIDO: "Vencido", PROXIMA_REVISAO: "Próximo da revisão",
    REVISAO_HOJE: "Revisão hoje", REVISAO_ATRASADA: "Revisão atrasada",
};
function StatusEtiqueta({ status }: { status: string }) {
    const cor = status === "EM_DIA"
        ? "bg-emerald-50 text-emerald-800"
        : status === "NAO_VERIFICADO" ? "bg-slate-100 text-slate-700"
        : "bg-amber-50 text-amber-900";
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cor}`}>
        {rotulos[status] ?? status}
    </span>;
}

export default function DocumentosLoja({ lojaId, podeGerenciarInstancias, podeGerenciarLojas }: { lojaId: string; podeGerenciarInstancias: boolean; podeGerenciarLojas: boolean }) {
    const [documentos, setDocumentos] = useState<Documento[]>([]);
    const [status, setStatus] = useState<Status[]>([]);
    const [resumo, setResumo] = useState<Resumo | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [carregado, setCarregado] = useState(false);
    const [erro, setErro] = useState("");
    const [aberto, setAberto] = useState<string | null>(null);
    const [revisao, setRevisao] = useState(0);
    const [colaboradores, setColaboradores] = useState<Record<string, Colaborador[]>>({});
    const [buscas, setBuscas] = useState<Record<string, string>>({});
    const [erroASO, setErroASO] = useState("");
    const [operandoASO, setOperandoASO] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        async function carregar() {
            setCarregando(true);
            setErro("");
            try {
                const [lista, situacao] = await Promise.all([
                    fetch(`/api/documentos/lojas/${encodeURIComponent(lojaId)}`, { signal: controller.signal }),
                    fetch(`/api/documentos/lojas/${encodeURIComponent(lojaId)}/status`, { signal: controller.signal }),
                ]);
                if (!lista.ok || !situacao.ok) throw new Error("Não foi possível consultar os documentos.");
                const dadosLista = await lista.json();
                const dadosStatus = await situacao.json();
                if (!dadosLista.success || !dadosStatus.success) throw new Error("Não foi possível carregar a documentação.");
                setDocumentos(dadosLista.documentos);
                setStatus(dadosStatus.documentos);
                setResumo(dadosStatus.resumo);
                setCarregado(true);
            } catch (error) {
                if (!controller.signal.aborted) setErro(error instanceof Error ? error.message : "Erro ao carregar.");
            } finally {
                if (!controller.signal.aborted) setCarregando(false);
            }
        }
        void carregar();
        return () => controller.abort();
    }, [lojaId, revisao]);

    async function abrirASO(docId: string) {
        if (aberto === docId) { setAberto(null); return; }
        setErroASO("");
        setAberto(docId);
        try {
            const resposta = await fetch(`/api/documentos/lojas/${encodeURIComponent(lojaId)}/${encodeURIComponent(docId)}/instancias`);
            const json = await resposta.json();
            if (!resposta.ok || !json.success) throw new Error(json.message ?? "Não foi possível carregar os colaboradores.");
            setColaboradores((atual) => ({ ...atual, [docId]: json.colaboradores }));
        } catch (e) {
            setErroASO(e instanceof Error ? e.message : "Erro ao consultar colaboradores.");
        }
    }

    async function atualizarASO(docId: string, colaborador: Colaborador) {
        const acao = !colaborador.instancia_id ? "cadastrar" : "reativar";
        if (!window.confirm(`Deseja ${acao} o ASO de ${colaborador.nome}?`)) return;
        const base = `/api/documentos/lojas/${encodeURIComponent(lojaId)}/${encodeURIComponent(docId)}/instancias`;
        setOperandoASO(colaborador.colaborador_id);
        setErroASO("");
        try {
            const resposta = await fetch(
                colaborador.instancia_id ? `${base}/${encodeURIComponent(colaborador.instancia_id)}` : base,
                {
                    method: colaborador.instancia_id ? "PATCH" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(colaborador.instancia_id
                        ? { ativo: true }
                        : { colaborador_id: colaborador.colaborador_id }),
                },
            );
            const json = await resposta.json();
            if (!resposta.ok || !json.success) throw new Error(json.message ?? "Não foi possível atualizar o ASO.");
            const atualizada = await fetch(base, { cache: "no-store" });
            const lista = await atualizada.json();
            if (!atualizada.ok || !lista.success) throw new Error(lista.message ?? "Não foi possível atualizar a lista.");
            setColaboradores((atual) => ({ ...atual, [docId]: lista.colaboradores }));
            setRevisao((valor) => valor + 1);
        } catch (e) {
            setErroASO(e instanceof Error ? e.message : "Erro ao atualizar ASO.");
        } finally {
            setOperandoASO(null);
        }
    }

    if (carregando && !carregado) return <div className="rounded-xl bg-white p-8 text-slate-600">Carregando documentos...</div>;
    if (erro && !carregado) return <div role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-red-700">{erro}</div>;

    return (
        <div className="space-y-6">
            {erro && <p role="alert" className="rounded-lg border border-red-200 bg-white p-3 text-sm text-red-700">{erro}</p>}
            {podeGerenciarLojas && <GerenciarDocumentos lojaId={lojaId} documentos={documentos} aoAtualizar={() => setRevisao((valor) => valor + 1)} />}
            {resumo && <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Documentos e ASOs</p><p className="mt-1 text-2xl font-bold text-[#22365b]">{resumo.total}</p></div>
                <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Verificados</p><p className="mt-1 text-2xl font-bold text-[#22365b]">{resumo.verificados}</p></div>
                <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Exigem atenção</p><p className="mt-1 text-2xl font-bold text-[#c22a2e]">{resumo.exigem_atencao}</p></div>
            </div>}
            {documentos.length === 0 ? (
                <div className="rounded-xl border bg-white p-8 text-slate-600">Nenhum documento vinculado a esta loja.</div>
            ) : (
                <div className="space-y-3">
                    {documentos.map((doc) => {
                        const registros = status.filter((item) => item.documento_loja_id === doc.id);
                        const loja = registros.find((item) => item.instancia_id === null);
                        return <section key={doc.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h2 className="font-semibold text-[#12223f]">{doc.nome}</h2>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {doc.modalidade === "COLABORADOR" ? "Individual por colaborador" : doc.tipo_controle === "REVISAO" ? "Controle por revisão" : "Controle por validade"}
                                        {Number(doc.ativo) !== 1 ? " • Vínculo inativo" : ""}
                                    </p>
                                </div>
                                {doc.modalidade === "LOJA" && Number(doc.ativo) === 1 && loja
                                    ? <StatusEtiqueta status={loja.status} />
                                    : null}
                            </div>
                            {doc.modalidade === "LOJA" && loja?.data_prazo && (
                                <p className="mt-3 text-sm text-slate-600">Prazo: {loja.data_prazo.split("-").reverse().join("/")}</p>
                            )}
                            {doc.modalidade === "LOJA" && Number(doc.ativo) === 1 && (
                                <div className="mt-4">
                                    <button type="button" onClick={() => setAberto(aberto === doc.id ? null : doc.id)}
                                        className="rounded-lg border border-[#22365b] px-4 py-2 text-sm font-semibold text-[#22365b]">
                                        {aberto === doc.id ? "Fechar formulário" : "Registrar verificação"}
                                    </button>
                                    {aberto === doc.id && <FormularioVerificacao lojaId={lojaId} vinculoId={doc.id}
                                        aoConfirmar={() => { setAberto(null); setRevisao((valor) => valor + 1); }} />}
                                </div>
                            )}
                            {doc.modalidade === "COLABORADOR" && (
                                <div className="mt-4 border-t pt-4">
                                    <button type="button" onClick={() => void abrirASO(doc.id)}
                                        className="rounded-lg border border-[#22365b] px-4 py-2 text-sm font-semibold text-[#22365b]">
                                        {aberto === doc.id ? "Ocultar colaboradores" : "Ver ASOs por colaborador"}
                                    </button>
                                    {aberto === doc.id && (
                                        <div className="mt-4 space-y-3">
                                            {erroASO && <p role="alert" className="text-sm text-red-700">{erroASO}</p>}
                                            <input type="search" placeholder="Buscar colaborador..."
                                                value={buscas[doc.id] ?? ""}
                                                onChange={(e) => setBuscas((atual) => ({ ...atual, [doc.id]: e.target.value }))}
                                                className="w-full rounded-lg border p-2 text-sm" />
                                            {(colaboradores[doc.id] ?? []).filter((c) => Number(c.colaborador_ativo) === 1
                                                && c.nome.toLocaleLowerCase("pt-BR").includes((buscas[doc.id] ?? "").toLocaleLowerCase("pt-BR")))
                                                .map((c) => {
                                                    const item = registros.find((r) => r.instancia_id === c.instancia_id);
                                                    return <div key={c.colaborador_id} className="rounded-lg border border-slate-200 p-4">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div><p className="font-semibold text-slate-800">{c.nome}</p>
                                                                <p className="text-xs text-slate-500">{c.cargo ?? "Cargo não informado"}</p></div>
                                                            <StatusEtiqueta status={item?.status ?? "NAO_VERIFICADO"} />
                                                        </div>
                                                        {!c.instancia_id && <p className="mt-2 text-sm text-amber-800">ASO ainda não cadastrado para este colaborador.</p>}
                                                        {podeGerenciarInstancias && Number(doc.ativo) === 1 &&
                                                            (!c.instancia_id || Number(c.instancia_ativa) !== 1) && (
                                                                <button type="button" disabled={operandoASO !== null}
                                                                    onClick={() => void atualizarASO(doc.id, c)}
                                                                    className="mt-3 rounded-lg bg-[#22365b] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                                                                    {operandoASO === c.colaborador_id ? "Aguarde..." : c.instancia_id ? "Reativar ASO" : "Cadastrar ASO"}
                                                                </button>
                                                            )}
                                                        {c.instancia_id && Number(c.instancia_ativa) === 1 && Number(doc.ativo) === 1 && (
                                                            <FormularioVerificacao key={c.instancia_id} lojaId={lojaId}
                                                                vinculoId={doc.id} instanciaId={c.instancia_id}
                                                                aoConfirmar={() => { setRevisao((valor) => valor + 1); }} />
                                                        )}
                                                        {c.instancia_id && Number(c.instancia_ativa) !== 1 && <p className="mt-2 text-sm text-red-700">ASO individual inativo.</p>}
                                                    </div>;
                                                })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>;
                    })}
                </div>
            )}
        </div>
    );
}
