"use client";

import { useState } from "react";

type Setor = {
    id: string;
    nome: string;
};

type NovoChecklistButtonProps = {
    setores: Setor[];
};

export default function NovoChecklistButton({
    setores,
}: NovoChecklistButtonProps) {
    const [aberto, setAberto] = useState(false);
    const [nome, setNome] = useState("");
    const [descricao, setDescricao] = useState("");
    const [setorId, setSetorId] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");

    function fechar() {
        if (salvando) return;

        setAberto(false);
        setNome("");
        setDescricao("");
        setSetorId("");
        setErro("");
    }

    async function salvar(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setErro("");

        const nomeNormalizado = nome.trim();
        const setorNormalizado = setorId.trim();

        if (!nomeNormalizado) {
            setErro("O nome do checklist é obrigatório.");
            return;
        }

        if (!setorNormalizado) {
            setErro("Selecione um setor.");
            return;
        }

        try {
            setSalvando(true);

            const response = await fetch("/api/checklists", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    nome: nomeNormalizado,
                    descricao: descricao.trim(),
                    setor_id: setorNormalizado,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setErro(
                    typeof data.message === "string"
                        ? data.message
                        : "Não foi possível criar o checklist."
                );
                return;
            }

            fechar();
            window.location.reload();
        } catch (error) {
            console.error("Erro ao criar checklist:", error);
            setErro("Não foi possível criar o checklist.");
        } finally {
            setSalvando(false);
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setAberto(true)}
                className="inline-flex items-center justify-center rounded-xl bg-[#22365b] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1b2d4c] focus:outline-none focus:ring-2 focus:ring-[#22365b]/30"
            >
                + Novo Checklist
            </button>

            {aberto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div
                        className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="novo-checklist-titulo"
                    >
                        <div className="border-b border-slate-200 px-6 py-5">
                            <h2
                                id="novo-checklist-titulo"
                                className="text-xl font-bold text-[#12223f]"
                            >
                                Novo Checklist
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Cadastre um checklist vinculado a um setor.
                            </p>
                        </div>

                        <form onSubmit={salvar}>
                            <div className="space-y-5 px-6 py-6">
                                {erro && (
                                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                        {erro}
                                    </div>
                                )}

                                <div>
                                    <label
                                        htmlFor="checklist-nome"
                                        className="mb-2 block text-sm font-medium text-slate-700"
                                    >
                                        Nome
                                    </label>

                                    <input
                                        id="checklist-nome"
                                        type="text"
                                        value={nome}
                                        onChange={(event) =>
                                            setNome(event.target.value)
                                        }
                                        maxLength={200}
                                        placeholder="Ex.: Boas Práticas de Manipulação"
                                        disabled={salvando}
                                        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#22365b] focus:ring-2 focus:ring-[#22365b]/10 disabled:bg-slate-100"
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="checklist-setor"
                                        className="mb-2 block text-sm font-medium text-slate-700"
                                    >
                                        Setor
                                    </label>

                                    <select
                                        id="checklist-setor"
                                        value={setorId}
                                        onChange={(event) =>
                                            setSetorId(event.target.value)
                                        }
                                        disabled={salvando}
                                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#22365b] focus:ring-2 focus:ring-[#22365b]/10 disabled:bg-slate-100"
                                    >
                                        <option value="">
                                            Selecione um setor
                                        </option>

                                        {setores.map((setor) => (
                                            <option
                                                key={setor.id}
                                                value={setor.id}
                                            >
                                                {setor.nome}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label
                                        htmlFor="checklist-descricao"
                                        className="mb-2 block text-sm font-medium text-slate-700"
                                    >
                                        Descrição
                                    </label>

                                    <textarea
                                        id="checklist-descricao"
                                        value={descricao}
                                        onChange={(event) =>
                                            setDescricao(event.target.value)
                                        }
                                        maxLength={1000}
                                        rows={4}
                                        placeholder="Descrição opcional do checklist."
                                        disabled={salvando}
                                        className="w-full resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#22365b] focus:ring-2 focus:ring-[#22365b]/10 disabled:bg-slate-100"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                                <button
                                    type="button"
                                    onClick={fechar}
                                    disabled={salvando}
                                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    disabled={salvando}
                                    className="rounded-xl bg-[#c22a2e] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#a92327] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {salvando
                                        ? "Salvando..."
                                        : "Salvar Checklist"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}