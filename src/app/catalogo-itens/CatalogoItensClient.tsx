"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ItemCatalogo = {
    id: string;
    texto: string;
    criado_em?: string;
};

export default function CatalogoItensClient() {
    const formularioRef = useRef<HTMLElement | null>(null);
    const [itens, setItens] = useState<ItemCatalogo[]>([]);
    const [texto, setTexto] = useState("");
    const [itemEditando, setItemEditando] =
        useState<ItemCatalogo | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [excluindoId, setExcluindoId] = useState<string | null>(null);
    const [erro, setErro] = useState("");
    const [sucesso, setSucesso] = useState("");

    const carregarItens = useCallback(async () => {
        setCarregando(true);
        setErro("");

        try {
            const resposta = await fetch("/api/catalogo-itens", {
                cache: "no-store",
            });

            const dados = await resposta.json();

            if (!resposta.ok || !dados.success) {
                throw new Error(
                    dados.message || "Não foi possível carregar os itens."
                );
            }

            setItens(dados.itens);
        } catch (error) {
            setErro(
                error instanceof Error
                    ? error.message
                    : "Erro ao carregar os itens."
            );
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        void carregarItens();
    }, [carregarItens]);

    function iniciarEdicao(item: ItemCatalogo) {
        setItemEditando(item);
        setTexto(item.texto);
        setErro("");
        setSucesso("");

        requestAnimationFrame(() => {
            formularioRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        });
    }

    function cancelarEdicao() {
        setItemEditando(null);
        setTexto("");
        setErro("");
        setSucesso("");
    }

    async function salvarItem(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const textoLimpo = texto.trim();

        if (!textoLimpo) {
            setErro("Informe o texto do item.");
            return;
        }

        setSalvando(true);
        setErro("");
        setSucesso("");

        try {
            const editando = itemEditando !== null;

            const resposta = await fetch(
                editando
                    ? `/api/catalogo-itens/${itemEditando.id}`
                    : "/api/catalogo-itens",
                {
                    method: editando ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ texto: textoLimpo }),
                }
            );

            const dados = await resposta.json();

            if (!resposta.ok || !dados.success) {
                throw new Error(
                    dados.message || "Não foi possível salvar o item."
                );
            }

            setSucesso(
                editando
                    ? "Item atualizado com sucesso."
                    : "Item cadastrado com sucesso."
            );

            setTexto("");
            setItemEditando(null);

            await carregarItens();
        } catch (error) {
            setErro(
                error instanceof Error
                    ? error.message
                    : "Erro ao salvar o item."
            );
        } finally {
            setSalvando(false);
        }
    }

    async function excluirItem(item: ItemCatalogo) {
        const confirmado = window.confirm(
            `Deseja excluir o item "${item.texto}" do catálogo?`
        );

        if (!confirmado) {
            return;
        }

        setExcluindoId(item.id);
        setErro("");
        setSucesso("");

        try {
            const resposta = await fetch(
                `/api/catalogo-itens/${item.id}`,
                {
                    method: "DELETE",
                }
            );

            const dados = await resposta.json();

            if (!resposta.ok || !dados.success) {
                throw new Error(
                    dados.message || "Não foi possível excluir o item."
                );
            }

            if (itemEditando?.id === item.id) {
                cancelarEdicao();
            }

            setSucesso(dados.message || "Item excluído com sucesso.");

            await carregarItens();
        } catch (error) {
            setErro(
                error instanceof Error
                    ? error.message
                    : "Erro ao excluir o item."
            );
        } finally {
            setExcluindoId(null);
        }
    }

    return (
        <div className="space-y-8">
            <section
                ref={formularioRef}
                className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            >
                <h2 className="text-lg font-semibold text-[#22365b]">
                    {itemEditando ? "Editar item" : "Cadastrar item"}
                </h2>

                <form onSubmit={salvarItem} className="mt-5 space-y-4">
                    <div>
                        <label
                            htmlFor="texto-item"
                            className="mb-2 block text-sm font-medium text-slate-700"
                        >
                            Texto do item
                        </label>

                        <textarea
                            id="texto-item"
                            value={texto}
                            onChange={(event) => setTexto(event.target.value)}
                            maxLength={2000}
                            required
                            rows={3}
                            placeholder="Digite o texto do item de checklist"
                            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-[#22365b] focus:ring-2 focus:ring-[#22365b]/15"
                        />
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            type="submit"
                            disabled={salvando}
                            className="rounded-lg bg-[#22365b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#182947] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {salvando
                                ? "Salvando..."
                                : itemEditando
                                    ? "Salvar alterações"
                                    : "Cadastrar item"}
                        </button>

                        {itemEditando && (
                            <button
                                type="button"
                                onClick={cancelarEdicao}
                                disabled={salvando}
                                className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                Cancelar edição
                            </button>
                        )}
                    </div>
                </form>
            </section>

            {erro && (
                <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                    {erro}
                </div>
            )}

            {sucesso && (
                <div
                    role="status"
                    className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
                >
                    {sucesso}
                </div>
            )}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <h2 className="text-lg font-semibold text-[#22365b]">
                            Itens cadastrados
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            Total: {itens.length}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => void carregarItens()}
                        disabled={carregando}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                        Atualizar lista
                    </button>
                </div>

                {carregando ? (
                    <p className="px-5 py-8 text-sm text-slate-500 sm:px-6">
                        Carregando itens...
                    </p>
                ) : itens.length === 0 ? (
                    <p className="px-5 py-8 text-sm text-slate-500 sm:px-6">
                        Nenhum item cadastrado no catálogo.
                    </p>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {itens.map((item) => (
                            <div
                                key={item.id}
                                className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                            >
                                <div className="min-w-0">
                                    <p className="whitespace-pre-wrap break-words font-medium text-slate-800">
                                        {item.texto}
                                    </p>

                                    <p className="mt-1 break-all text-xs text-slate-400">
                                        ID: {item.id}
                                    </p>
                                </div>

                                <div className="flex shrink-0 flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => iniciarEdicao(item)}
                                        className="rounded-lg border border-[#22365b] px-4 py-2 text-sm font-medium text-[#22365b] transition hover:bg-slate-50"
                                    >
                                        Editar
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => void excluirItem(item)}
                                        disabled={excluindoId === item.id}
                                        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {excluindoId === item.id
                                            ? "Excluindo..."
                                            : "Excluir"}
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