
"use client";

import { useState } from "react";

type CatalogoItem = {
    id: string;
    texto: string;
};

type NovoItemButtonProps = {
    checklistId: string;
    versaoId: string;
    secaoId: string;
    catalogoItens: CatalogoItem[];
};

export default function NovoItemButton({
    checklistId,
    versaoId,
    secaoId,
    catalogoItens,
}: NovoItemButtonProps) {
    const [aberto, setAberto] = useState(false);
    const [texto, setTexto] = useState("");
    const [orientacao, setOrientacao] = useState("");
    const [ordem, setOrdem] = useState("");
    const [carregandoOrdem, setCarregandoOrdem] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const [modo, setModo] = useState<"novo" | "catalogo">("novo");
    const [catalogoItemId, setCatalogoItemId] = useState("");

    async function abrirModal() {
        setErro("");
        setTexto("");
        setOrientacao("");
        setOrdem("");
        setCatalogoItemId("");
        setModo("novo");
        setAberto(true);
        setCarregandoOrdem(true);

        try {
            const response = await fetch(
                `/api/checklists/${checklistId}/versoes/${versaoId}/secoes/${secaoId}/itens`
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.message ||
                        "Não foi possível obter a próxima ordem."
                );
            }

            setOrdem(String(data.proximaOrdem ?? 1));
        } catch {
            setOrdem("1");
            setErro(
                "Não foi possível calcular a próxima ordem automaticamente."
            );
        } finally {
            setCarregandoOrdem(false);
        }
    }

    function fecharModal() {
        if (salvando) return;

        setAberto(false);
        setErro("");
    }

    async function salvar() {
        setErro("");

        const textoLimpo = texto.trim();
        const orientacaoLimpa = orientacao.trim();
        const ordemNumero = Number(ordem);

        if (modo === "novo" && !textoLimpo) {
            setErro("O texto do item é obrigatório.");
            return;
        }

        if (modo === "catalogo" && !catalogoItemId) {
            setErro("Selecione um item do catálogo.");
            return;
        }

        if (
            !Number.isInteger(ordemNumero) ||
            ordemNumero <= 0
        ) {
            setErro(
                "A ordem do item deve ser um número inteiro maior que zero."
            );
            return;
        }

        try {
            setSalvando(true);

            const response = await fetch(
                `/api/checklists/${checklistId}/versoes/${versaoId}/secoes/${secaoId}/itens`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        texto:
                            modo === "novo"
                                ? textoLimpo
                                : undefined,
                        catalogoItemId:
                            modo === "catalogo"
                                ? catalogoItemId
                                : undefined,
                        orientacao: orientacaoLimpa,
                        ordem: ordemNumero,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setErro(
                    data?.message ||
                        "Não foi possível criar o item."
                );
                return;
            }

            setAberto(false);
            window.location.reload();
        } catch {
            setErro(
                "Não foi possível criar o item. Tente novamente."
            );
        } finally {
            setSalvando(false);
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={abrirModal}
                className="rounded-lg bg-[#22365b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1b2d4d]"
            >
                + Novo Item
            </button>

            {aberto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-5">
                            <h2 className="text-lg font-bold text-[#12223f]">
                                Novo Item
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Cadastre um item para esta seção do
                                checklist.
                            </p>

                            <div className="mt-4 flex rounded-lg border border-slate-200 p-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setModo("novo");
                                        setErro("");
                                        setCatalogoItemId("");
                                    }}
                                    disabled={salvando}
                                    className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
                                        modo === "novo"
                                            ? "bg-[#22365b] text-white"
                                            : "text-slate-600 hover:bg-slate-50"
                                    }`}
                                >
                                    Criar novo
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setModo("catalogo");
                                        setErro("");
                                        setTexto("");
                                    }}
                                    disabled={salvando}
                                    className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
                                        modo === "catalogo"
                                            ? "bg-[#22365b] text-white"
                                            : "text-slate-600 hover:bg-slate-50"
                                    }`}
                                >
                                    Reutilizar do catálogo
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {modo === "novo" && (
                                <div>
                                    <label
                                        htmlFor="texto"
                                        className="mb-1.5 block text-sm font-medium text-slate-700"
                                    >
                                        Item
                                    </label>

                                    <textarea
                                        id="texto"
                                        value={texto}
                                        onChange={(event) =>
                                            setTexto(event.target.value)
                                        }
                                        placeholder="Ex.: Os produtos estão identificados e dentro do prazo de validade?"
                                        maxLength={1000}
                                        rows={4}
                                        className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#22365b] focus:ring-2 focus:ring-[#22365b]/10"
                                        disabled={salvando}
                                    />
                                </div>
                            )}

                            {modo === "catalogo" && (
                                <div>
                                    <label
                                        htmlFor="catalogoItem"
                                        className="mb-1.5 block text-sm font-medium text-slate-700"
                                    >
                                        Item do catálogo
                                    </label>

                                    <select
                                        id="catalogoItem"
                                        value={catalogoItemId}
                                        onChange={(event) =>
                                            setCatalogoItemId(
                                                event.target.value
                                            )
                                        }
                                        disabled={salvando}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#22365b] focus:ring-2 focus:ring-[#22365b]/10"
                                    >
                                        <option value="">
                                            Selecione um item
                                        </option>

                                        {catalogoItens.map((item) => (
                                            <option
                                                key={item.id}
                                                value={item.id}
                                            >
                                                {item.texto}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label
                                    htmlFor="orientacao"
                                    className="mb-1.5 block text-sm font-medium text-slate-700"
                                >
                                    Orientação
                                </label>

                                <textarea
                                    id="orientacao"
                                    value={orientacao}
                                    onChange={(event) =>
                                        setOrientacao(event.target.value)
                                    }
                                    placeholder="Orientação opcional para o auditor."
                                    maxLength={1000}
                                    rows={3}
                                    className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#22365b] focus:ring-2 focus:ring-[#22365b]/10"
                                    disabled={salvando}
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="ordem"
                                    className="mb-1.5 block text-sm font-medium text-slate-700"
                                >
                                    Ordem
                                </label>

                                <input
                                    id="ordem"
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={ordem}
                                    onChange={(event) =>
                                        setOrdem(event.target.value)
                                    }
                                    placeholder={
                                        carregandoOrdem
                                            ? "Calculando..."
                                            : "Ex.: 1"
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#22365b] focus:ring-2 focus:ring-[#22365b]/10"
                                    disabled={
                                        salvando ||
                                        carregandoOrdem
                                    }
                                />

                                <p className="mt-1 text-xs text-slate-400">
                                    A ordem define a posição do item dentro
                                    da seção.
                                </p>
                            </div>

                            {erro && (
                                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                                    {erro}
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={fecharModal}
                                disabled={salvando}
                                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={salvar}
                                disabled={salvando}
                                className="rounded-lg bg-[#c22a2e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#a92327] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {salvando
                                    ? "Salvando..."
                                    : modo === "catalogo"
                                        ? "Adicionar Item"
                                        : "Criar Item"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
