"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Dados = {
    resultado: "" | "APRESENTADO" | "NAO_APRESENTADO";
    data_verificacao: string;
    data_prazo: string;
    observacao: string;
    prazo_informado_manualmente: boolean;
};
const vazio: Dados = { resultado: "", data_verificacao: "", data_prazo: "", observacao: "", prazo_informado_manualmente: false };

export default function FormularioVerificacao({
    lojaId, vinculoId, aoConfirmar,
}: { lojaId: string; vinculoId: string; aoConfirmar: () => void }) {
    const [dados, setDados] = useState<Dados>(vazio);
    const [vista, setVista] = useState<string | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [mensagem, setMensagem] = useState("");
    const [erro, setErro] = useState("");
    const [precisaRevisar, setPrecisaRevisar] = useState(false);
    const [editavel, setEditavel] = useState(true);
    const [alterado, setAlterado] = useState(false);
    const seq = useRef(0);
    const base = `/api/documentos/lojas/${encodeURIComponent(lojaId)}/${encodeURIComponent(vinculoId)}`;

    const carregar = useCallback(async () => {
        setCarregando(true);
        try {
            const resposta = await fetch(`${base}/rascunho`, { cache: "no-store" });
            const json = await resposta.json();
            if (!resposta.ok || !json.success) throw new Error(json.message ?? "Erro ao carregar rascunho.");
            setVista(json.ultima_verificacao_id ?? null);
            setEditavel(Boolean(json.editavel));
            setPrecisaRevisar(Boolean(json.precisa_revisar));
            if (json.rascunho) {
                const r = json.rascunho;
                setDados({
                    resultado: r.resultado ?? "",
                    data_verificacao: r.data_verificacao ?? "",
                    data_prazo: r.data_prazo ?? "",
                    observacao: r.observacao ?? "",
                    prazo_informado_manualmente: Number(r.prazo_informado_manualmente) === 1,
                });
            }
            setAlterado(false);
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Erro ao carregar.");
        } finally {
            setCarregando(false);
        }
    }, [base]);

    useEffect(() => { void carregar(); }, [carregar]);

    const salvar = useCallback(async (atual: Dados) => {
        if (!editavel || precisaRevisar) return false;
        setSalvando(true);
        try {
            const resposta = await fetch(`${base}/rascunho`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    resultado: atual.resultado || null,
                    data_verificacao: atual.data_verificacao || null,
                    data_prazo: atual.data_prazo || null,
                    observacao: atual.observacao,
                    prazo_informado_manualmente: atual.prazo_informado_manualmente ? 1 : 0,
                    ultima_verificacao_vista_id: vista,
                }),
            });
            const json = await resposta.json();
            if (resposta.status === 409) {
                setPrecisaRevisar(true);
                throw new Error(json.message ?? "O histórico mudou. Revise antes de continuar.");
            }
            if (!resposta.ok || !json.success) throw new Error(json.message ?? "Não foi possível salvar.");
            setMensagem("Rascunho salvo.");
            setErro("");
            return true;
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Erro ao salvar.");
            return false;
        } finally {
            setSalvando(false);
        }
    }, [base, editavel, precisaRevisar, vista]);

    useEffect(() => {
        if (!alterado || carregando || precisaRevisar || !editavel) return;
        const id = ++seq.current;
        const temporizador = setTimeout(() => {
            if (id === seq.current) void salvar(dados).then((ok) => { if (ok && id === seq.current) setAlterado(false); });
        }, 5000);
        return () => clearTimeout(temporizador);
    }, [dados, alterado, carregando, precisaRevisar, editavel, salvar]);

    function atualizar(patch: Partial<Dados>) {
        setDados((atual) => ({ ...atual, ...patch }));
        setAlterado(true);
        setMensagem("");
    }

    async function confirmar() {
        setErro("");
        if (!dados.resultado || !dados.data_verificacao) {
            setErro("Informe o resultado e a data da verificação.");
            return;
        }
        if ((dados.resultado === "NAO_APRESENTADO" || !dados.data_prazo) && !dados.observacao.trim()) {
            setErro("A observação é obrigatória quando o documento não foi apresentado ou não possui prazo.");
            return;
        }
        if (!window.confirm("Confirmar esta verificação? O registro ficará no histórico e só poderá ser corrigido por usuário autorizado.")) return;
        try {
            const resposta = await fetch(`${base}/verificacoes`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    resultado: dados.resultado, data_verificacao: dados.data_verificacao,
                    data_prazo: dados.resultado === "NAO_APRESENTADO" ? null : dados.data_prazo || null,
                    observacao: dados.observacao,
                    prazo_informado_manualmente: dados.prazo_informado_manualmente ? 1 : 0,
                    ultima_verificacao_vista_id: vista,
                }),
            });
            const json = await resposta.json();
            if (resposta.status === 409) setPrecisaRevisar(true);
            if (!resposta.ok || !json.success) throw new Error(json.message ?? "Não foi possível confirmar.");
            setMensagem("Verificação confirmada.");
            setDados(vazio);
            setAlterado(false);
            aoConfirmar();
            await carregar();
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Erro ao confirmar.");
        }
    }

    if (carregando) return <p className="mt-4 text-sm text-slate-500">Carregando formulário...</p>;
    return <div className="mt-5 space-y-4 border-t border-slate-200 pt-5">
        {precisaRevisar && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Outra verificação foi registrada. Confira o histórico antes de continuar.
            <button type="button" onClick={() => { setPrecisaRevisar(false); void carregar(); }} className="ml-2 font-bold underline">Recarregar</button>
        </div>}
        {!editavel && <p className="text-sm text-red-700">Documento inativo. Edição bloqueada.</p>}
        <fieldset disabled={!editavel || precisaRevisar} className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Resultado
                <select value={dados.resultado} onChange={(e) => atualizar({ resultado: e.target.value as Dados["resultado"], data_prazo: e.target.value === "NAO_APRESENTADO" ? "" : dados.data_prazo })} className="mt-1 w-full rounded-lg border p-2">
                    <option value="">Selecione</option><option value="APRESENTADO">Apresentado</option><option value="NAO_APRESENTADO">Não apresentado</option>
                </select>
            </label>
            <label className="text-sm font-medium text-slate-700">Data da verificação
                <input type="date" value={dados.data_verificacao} onChange={(e) => atualizar({ data_verificacao: e.target.value })} className="mt-1 w-full rounded-lg border p-2" />
            </label>
            <label className="text-sm font-medium text-slate-700">Prazo de validade ou revisão
                <input type="date" disabled={dados.resultado === "NAO_APRESENTADO"} value={dados.data_prazo} onChange={(e) => atualizar({ data_prazo: e.target.value })} className="mt-1 w-full rounded-lg border p-2" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={dados.prazo_informado_manualmente} onChange={(e) => atualizar({ prazo_informado_manualmente: e.target.checked })} />
                Prazo informado manualmente
            </label>
            <label className="sm:col-span-2 text-sm font-medium text-slate-700">Observação
                <textarea value={dados.observacao} onChange={(e) => atualizar({ observacao: e.target.value })} rows={3} maxLength={4000} className="mt-1 w-full rounded-lg border p-2" />
            </label>
        </fieldset>
        {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
        {mensagem && <p className="text-sm text-emerald-700">{mensagem}</p>}
        <div className="flex flex-wrap gap-3">
            <button type="button" disabled={!editavel || precisaRevisar || salvando} onClick={() => void salvar(dados)} className="rounded-lg border border-[#22365b] px-4 py-2 text-sm font-semibold text-[#22365b] disabled:opacity-50">{salvando ? "Salvando..." : "Salvar rascunho"}</button>
            <button type="button" disabled={!editavel || precisaRevisar || salvando} onClick={() => void confirmar()} className="rounded-lg bg-[#22365b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirmar verificação</button>
        </div>
    </div>;
}
