"use client";

import { FormEvent, useState } from "react";

type Setor = {
    id: string;
    nome: string;
    descricao: string | null;
    ativo: boolean;
};

type EditarSetorButtonProps = {
    setor: Setor;
    onChanged: () => void;
};

export default function EditarSetorButton({
    setor,
    onChanged,
}: EditarSetorButtonProps) {
    const [aberto, setAberto] = useState(false);
    const [nome, setNome] = useState(setor.nome);
    const [descricao, setDescricao] = useState(
        setor.descricao ?? ""
    );
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");

    function abrir() {
        setNome(setor.nome);
        setDescricao(setor.descricao ?? "");
        setErro("");
        setAberto(true);
    }

    function fechar() {
        if (salvando) {
            return;
        }

        setAberto(false);
        setErro("");
    }

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setErro("");
        setSalvando(true);

        try {
            const response = await fetch(
                `/api/setores/${setor.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        nome,
                        descricao,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setErro(
                    data.message ||
                        "Não foi possível atualizar o setor."
                );
                return;
            }

            fechar();
            onChanged();
        } catch {
            setErro(
                "Não foi possível atualizar o setor. Tente novamente."
            );
        } finally {
            setSalvando(false);
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={abrir}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
                Editar
            </button>

            {aberto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-[#12223f]">
                                Editar Setor
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Atualize os dados do setor.
                            </p>
                        </div>

                        <form
                            onSubmit={handleSubmit}
                            className="space-y-5"
                        >
                            <div>
                                <label
                                    htmlFor={`nome-${setor.id}`}
                                    className="mb-2 block text-sm font-medium text-slate-700"
                                >
                                    Nome *
                                </label>

                                <input
                                    id={`nome-${setor.id}`}
                                    type="text"
                                    value={nome}
                                    onChange={(event) =>
                                        setNome(event.target.value)
                                    }
                                    required
                                    autoFocus
                                    disabled={salvando}
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor={`descricao-${setor.id}`}
                                    className="mb-2 block text-sm font-medium text-slate-700"
                                >
                                    Descrição
                                </label>

                                <textarea
                                    id={`descricao-${setor.id}`}
                                    value={descricao}
                                    onChange={(event) =>
                                        setDescricao(event.target.value)
                                    }
                                    disabled={salvando}
                                    rows={4}
                                    className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10"
                                />
                            </div>

                            {erro && (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    {erro}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={fechar}
                                    disabled={salvando}
                                    className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    disabled={salvando}
                                    className="rounded-xl bg-[#c22a2e] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {salvando
                                        ? "Salvando..."
                                        : "Salvar Alterações"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}