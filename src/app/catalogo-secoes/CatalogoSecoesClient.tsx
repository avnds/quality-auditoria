"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SecaoCatalogo = {
    id: string;
    nome: string;
    criado_em?: string;
};

export default function CatalogoSecoesClient() {
    const formularioRef = useRef<HTMLElement | null>(null);
    const [secoes, setSecoes] = useState<SecaoCatalogo[]>([]);
    const [nome, setNome] = useState("");
    const [secaoEditando, setSecaoEditando] =
        useState<SecaoCatalogo | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [excluindoId, setExcluindoId] = useState<string | null>(null);
    const [erro, setErro] = useState("");
    const [sucesso, setSucesso] = useState("");

    const carregarSecoes = useCallback(async () => {
        setCarregando(true);
        setErro("");

        try {
            const resposta = await fetch("/api/catalogo-secoes", {
                cache: "no-store",
            });

            const dados = await resposta.json();

            if (!resposta.ok || !dados.success) {
                throw new Error(
                    dados.message || "Não foi possível carregar as seções."
                );
            }

            setSecoes(dados.secoes);
        } catch (error) {
            setErro(
                error instanceof Error
                    ? error.message
                    : "Erro ao carregar as seções."
            );
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        void carregarSecoes();
    }, [carregarSecoes]);

    function iniciarEdicao(secao: SecaoCatalogo) {
        setSecaoEditando(secao);
        setNome(secao.nome);
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
        setSecaoEditando(null);
        setNome("");
        setErro("");
        setSucesso("");
    }

    async function salvarSecao(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const nomeLimpo = nome.trim();

        if (!nomeLimpo) {
            setErro("Informe o nome da seção.");
            return;
        }

        setSalvando(true);
        setErro("");
        setSucesso("");

        try {
            const editando = secaoEditando !== null;

            const resposta = await fetch(
                editando
                    ? `/api/catalogo-secoes/${secaoEditando.id}`
                    : "/api/catalogo-secoes",
                {
                    method: editando ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ nome: nomeLimpo }),
                }
            );

            const dados = await resposta.json();

            if (!resposta.ok || !dados.success) {
                throw new Error(
                    dados.message || "Não foi possível salvar a seção."
                );
            }

            setSucesso(
                editando
                    ? "Seção atualizada com sucesso."
                    : "Seção cadastrada com sucesso."
            );

            setNome("");
            setSecaoEditando(null);

            await carregarSecoes();
        } catch (error) {
            setErro(
                error instanceof Error
                    ? error.message
                    : "Erro ao salvar a seção."
            );
        } finally {
            setSalvando(false);
        }
    }

    async function excluirSecao(secao: SecaoCatalogo) {
        const confirmado = window.confirm(
            `Deseja excluir a seção "${secao.nome}" do catálogo?`
        );

        if (!confirmado) {
            return;
        }

        setExcluindoId(secao.id);
        setErro("");
        setSucesso("");

        try {
            const resposta = await fetch(
                `/api/catalogo-secoes/${secao.id}`,
                {
                    method: "DELETE",
                }
            );

            const dados = await resposta.json();

            if (!resposta.ok || !dados.success) {
                throw new Error(
                    dados.message || "Não foi possível excluir a seção."
                );
            }

            if (secaoEditando?.id === secao.id) {
                cancelarEdicao();
            }

            setSucesso(dados.message || "Seção excluída com sucesso.");

            await carregarSecoes();
        } catch (error) {
            setErro(
                error instanceof Error
                    ? error.message
                    : "Erro ao excluir a seção."
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
                    {secaoEditando ? "Editar seção" : "Cadastrar seção"}
                </h2>

                <form onSubmit={salvarSecao} className="mt-5 space-y-4">
                    <div>
                        <label
                            htmlFor="nome-secao"
                            className="mb-2 block text-sm font-medium text-slate-700"
                        >
                            Nome da seção
                        </label>

                        <input
                            id="nome-secao"
                            type="text"
                            value={nome}
                            onChange={(event) => setNome(event.target.value)}
                            maxLength={200}
                            required
                            placeholder="Ex.: Manipulação"
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
                                : secaoEditando
                                    ? "Salvar alterações"
                                    : "Cadastrar seção"}
                        </button>

                        {secaoEditando && (
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
                            Seções cadastradas
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            Total: {secoes.length}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => void carregarSecoes()}
                        disabled={carregando}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                        Atualizar lista
                    </button>
                </div>

                {carregando ? (
                    <p className="px-5 py-8 text-sm text-slate-500 sm:px-6">
                        Carregando seções...
                    </p>
                ) : secoes.length === 0 ? (
                    <p className="px-5 py-8 text-sm text-slate-500 sm:px-6">
                        Nenhuma seção cadastrada no catálogo.
                    </p>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {secoes.map((secao) => (
                            <div
                                key={secao.id}
                                className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                            >
                                <div className="min-w-0">
                                    <p className="break-words font-medium text-slate-800">
                                        {secao.nome}
                                    </p>

                                    <p className="mt-1 break-all text-xs text-slate-400">
                                        ID: {secao.id}
                                    </p>
                                </div>

                                <div className="flex shrink-0 flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => iniciarEdicao(secao)}
                                        className="rounded-lg border border-[#22365b] px-4 py-2 text-sm font-medium text-[#22365b] transition hover:bg-slate-50"
                                    >
                                        Editar
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => void excluirSecao(secao)}
                                        disabled={excluindoId === secao.id}
                                        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {excluindoId === secao.id
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