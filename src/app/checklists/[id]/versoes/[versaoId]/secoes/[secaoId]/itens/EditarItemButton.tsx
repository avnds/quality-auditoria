"use client";

import { useState } from "react";

type EditarItemButtonProps = {
    checklistId: string;
    versaoId: string;
    secaoId: string;
    item: {
        id: string;
        texto: string;
        orientacao: string | null;
        ordem: number;
    };
    
};

export default function EditarItemButton({
    checklistId,
    versaoId,
    secaoId,
    item,
    
}: EditarItemButtonProps) {
    const [aberto, setAberto] = useState(false);
    const [texto, setTexto] = useState(item.texto);
    const [orientacao, setOrientacao] = useState(item.orientacao ?? "");
    const [ordem, setOrdem] = useState(String(item.ordem));
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");

    function abrir() {
        setTexto(item.texto);
        setOrientacao(item.orientacao ?? "");
        setOrdem(String(item.ordem));
        setErro("");
        setAberto(true);
    }

    async function handleSalvar(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErro("");

        const textoLimpo = texto.trim();
        const ordemNumero = Number(ordem);

        if (!textoLimpo) {
            setErro("O texto do item é obrigatório.");
            return;
        }

        if (!Number.isInteger(ordemNumero) || ordemNumero <= 0) {
            setErro("A ordem deve ser um número inteiro maior que zero.");
            return;
        }

        setSalvando(true);

        try {
            const resposta = await fetch(
                `/api/checklists/${checklistId}/versoes/${versaoId}/secoes/${secaoId}/itens/${item.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        texto: textoLimpo,
                        orientacao: orientacao.trim(),
                        ordem: ordemNumero,
                    }),
                }
            );

            const dados = await resposta.json();

            if (!resposta.ok) {
                setErro(
                    dados.message ||
                        "Não foi possível editar o item."
                );
                return;
            }

            setAberto(false);
            window.location.reload();
        } catch (error) {
            console.error("Erro ao editar item:", error);
            setErro("Não foi possível editar o item. Tente novamente.");
        } finally {
            setSalvando(false);
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={abrir}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[#22365b] transition hover:bg-slate-50"
            >
                Editar
            </button>

            {aberto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
                        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
                            <div>
                                <h2 className="text-lg font-bold text-[#22365b]">
                                    Editar Item
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Atualize os dados do item do checklist.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setAberto(false)}
                                className="text-xl leading-none text-slate-400 transition hover:text-slate-600"
                                aria-label="Fechar"
                            >
                                ×
                            </button>
                        </div>

                        <form
                            onSubmit={handleSalvar}
                            className="space-y-5 px-6 py-5"
                        >
                            {erro && (
                                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    {erro}
                                </div>
                            )}

                            <div>
                                <label
                                    htmlFor={`editar-item-texto-${item.id}`}
                                    className="mb-1.5 block text-sm font-semibold text-slate-700"
                                >
                                    Item
                                </label>

                                <textarea
                                    id={`editar-item-texto-${item.id}`}
                                    value={texto}
                                    onChange={(event) =>
                                        setTexto(event.target.value)
                                    }
                                    maxLength={1000}
                                    rows={4}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#22365b] focus:ring-2 focus:ring-[#22365b]/10"
                                    required
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor={`editar-item-orientacao-${item.id}`}
                                    className="mb-1.5 block text-sm font-semibold text-slate-700"
                                >
                                    Orientação
                                </label>

                                <textarea
                                    id={`editar-item-orientacao-${item.id}`}
                                    value={orientacao}
                                    onChange={(event) =>
                                        setOrientacao(event.target.value)
                                    }
                                    maxLength={1000}
                                    rows={3}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#22365b] focus:ring-2 focus:ring-[#22365b]/10"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor={`editar-item-ordem-${item.id}`}
                                    className="mb-1.5 block text-sm font-semibold text-slate-700"
                                >
                                    Ordem
                                </label>

                                <input
                                    id={`editar-item-ordem-${item.id}`}
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={ordem}
                                    onChange={(event) =>
                                        setOrdem(event.target.value)
                                    }
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#22365b] focus:ring-2 focus:ring-[#22365b]/10"
                                    required
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setAberto(false)}
                                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                                    disabled={salvando}
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    disabled={salvando}
                                    className="rounded-xl bg-[#22365b] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1b2d4c] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {salvando
                                        ? "Salvando..."
                                        : "Salvar alterações"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}