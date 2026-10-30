"use client";

import { useCallback, useEffect, useState } from "react";

type Colaborador = {
    id: string;
    nome: string;
    cargo: string | null;
    email: string | null;
    telefone: string | null;
    ativo: number;
};

type Props = { lojaId: string; lojaNome: string };

const campo =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#22365b] focus:ring-2 focus:ring-[#22365b]/10";

export default function ColaboradoresManager({ lojaId, lojaNome }: Props) {
    const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [mensagem, setMensagem] = useState("");
    const [editando, setEditando] = useState<string | null>(null);
    const [nome, setNome] = useState("");
    const [cargo, setCargo] = useState("");
    const [email, setEmail] = useState("");
    const [telefone, setTelefone] = useState("");

    const carregar = useCallback(async () => {
        try {
            const response = await fetch(`/api/lojas/${lojaId}/colaboradores`);
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Falha ao carregar.");
            setColaboradores(data.colaboradores);
        } catch (error) {
            setMensagem(error instanceof Error ? error.message : "Erro ao carregar colaboradores.");
        } finally {
            setCarregando(false);
        }
    }, [lojaId]);

    useEffect(() => {
        let ativo = true;

        fetch(`/api/lojas/${lojaId}/colaboradores`)
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.message || "Falha ao carregar.");
                }
                return data.colaboradores as Colaborador[];
            })
            .then((lista) => {
                if (ativo) {
                    setColaboradores(lista);
                }
            })
            .catch((error: unknown) => {
                if (ativo) {
                    setMensagem(error instanceof Error ? error.message : "Erro ao carregar colaboradores.");
                }
            })
            .finally(() => {
                if (ativo) {
                    setCarregando(false);
                }
            });

        return () => {
            ativo = false;
        };
    }, [lojaId]);

    function limparFormulario() {
        setEditando(null);
        setNome("");
        setCargo("");
        setEmail("");
        setTelefone("");
    }

    function iniciarEdicao(colaborador: Colaborador) {
        setEditando(colaborador.id);
        setNome(colaborador.nome);
        setCargo(colaborador.cargo || "");
        setEmail(colaborador.email || "");
        setTelefone(colaborador.telefone || "");
        setMensagem("");
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    async function salvar(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSalvando(true);
        setMensagem("");
        try {
            const url = editando
                ? `/api/colaboradores/${editando}`
                : `/api/lojas/${lojaId}/colaboradores`;
            const response = await fetch(url, {
                method: editando ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome, cargo, email, telefone }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Não foi possível salvar.");
            setMensagem(data.message);
            limparFormulario();
            await carregar();
        } catch (error) {
            setMensagem(error instanceof Error ? error.message : "Erro ao salvar colaborador.");
        } finally {
            setSalvando(false);
        }
    }

    async function alterarStatus(colaborador: Colaborador) {
        const ativo = colaborador.ativo !== 1;
        const confirmado = window.confirm(
            ativo
                ? `Deseja reativar ${colaborador.nome}?`
                : `Deseja inativar ${colaborador.nome}? Os certificados já emitidos serão preservados.`
        );
        if (!confirmado) return;

        try {
            const response = await fetch(`/api/colaboradores/${colaborador.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ativo }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || "Não foi possível alterar o status.");
            setMensagem(data.message);
            await carregar();
        } catch (error) {
            setMensagem(error instanceof Error ? error.message : "Erro ao alterar status.");
        }
    }

    return (
        <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-[#12223f]">
                    {editando ? "Editar colaborador" : "Cadastrar colaborador"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                    Cadastro vinculado exclusivamente à loja {lojaNome}.
                </p>

                <form onSubmit={salvar} className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                        Nome completo *
                        <input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={180} />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                        Cargo / função
                        <input className={campo} value={cargo} onChange={(e) => setCargo(e.target.value)} maxLength={120} />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                        Telefone
                        <input className={campo} value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={30} />
                    </label>
                    <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                        E-mail
                        <input className={campo} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={180} />
                    </label>

                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                        <button
                            type="submit"
                            disabled={salvando}
                            className="rounded-lg bg-[#22365b] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#182947] disabled:opacity-60"
                        >
                            {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Cadastrar colaborador"}
                        </button>
                        {editando && (
                            <button type="button" onClick={limparFormulario} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                Cancelar edição
                            </button>
                        )}
                    </div>
                </form>
                {mensagem && <p role="status" className="mt-4 text-sm text-slate-700">{mensagem}</p>}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-4">
                    <h2 className="text-xl font-semibold text-[#12223f]">Colaboradores cadastrados</h2>
                    <p className="mt-1 text-sm text-slate-500">Colaboradores inativos permanecem no histórico e não poderão ser selecionados em novos treinamentos.</p>
                </div>

                {carregando ? (
                    <p className="p-6 text-sm text-slate-500">Carregando colaboradores...</p>
                ) : colaboradores.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-500">Nenhum colaborador cadastrado nesta loja.</p>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {colaboradores.map((colaborador) => (
                            <div key={colaborador.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="font-semibold text-slate-800">{colaborador.nome}</p>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {[colaborador.cargo, colaborador.email, colaborador.telefone].filter(Boolean).join(" • ") || "Sem informações adicionais"}
                                    </p>
                                    <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${colaborador.ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                        {colaborador.ativo ? "Ativo" : "Inativo"}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => iniciarEdicao(colaborador)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                        Editar
                                    </button>
                                    <button type="button" onClick={() => alterarStatus(colaborador)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                        {colaborador.ativo ? "Inativar" : "Reativar"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
