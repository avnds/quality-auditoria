
"use client";

import { useState } from "react";

type NovaSecao = {
    id: string;
    nome: string;
};

type NovaSecaoButtonProps = {
    checklistId: string;
    versaoId: string;
    catalogoSecoes: NovaSecao[];
};

export default function NovaSecaoButton({
    checklistId,
    versaoId,
    catalogoSecoes,
}: NovaSecaoButtonProps) {
    const [aberto, setAberto] = useState(false);
    const [nome, setNome] = useState("");
    const [descricao, setDescricao] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const [modo, setModo] = useState<"nova" | "catalogo">("nova");
    const [catalogoSecaoId, setCatalogoSecaoId] = useState("");

    function abrirModal() {
        setErro("");
        setNome("");
        setDescricao("");
        setCatalogoSecaoId("");
        setModo("nova");
        setAberto(true);
    }

    function fecharModal() {
        if (salvando) return;

        setAberto(false);
        setErro("");
    }

    async function salvar() {
        setErro("");

        const nomeLimpo = nome.trim();

        if (modo === "nova" && !nomeLimpo) {
            setErro("O nome da seção é obrigatório.");
            return;
        }

        if (modo === "catalogo" && !catalogoSecaoId) {
            setErro("Selecione uma seção do catálogo.");
            return;
        }

        try {
            setSalvando(true);

            const response = await fetch(
                `/api/checklists/${checklistId}/versoes/${versaoId}/secoes`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        nome: modo === "nova" ? nomeLimpo : undefined,
                        catalogoSecaoId:
                            modo === "catalogo"
                                ? catalogoSecaoId
                                : undefined,
                        descricao: descricao.trim(),
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setErro(
                    data?.message ||
                        "Não foi possível criar a seção."
                );
                return;
            }

            setAberto(false);
            window.location.reload();
        } catch {
            setErro(
                "Não foi possível criar a seção. Tente novamente."
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
                + Nova Seção
            </button>

            {aberto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-5">
                            <h2 className="text-lg font-bold text-[#12223f]">
                                Nova Seção
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Cadastre uma seção para esta versão do
                                checklist.
                            </p>

                            <div className="mt-4 flex rounded-lg border border-slate-200 p-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setModo("nova");
                                        setErro("");
                                        setCatalogoSecaoId("");
                                    }}
                                    disabled={salvando}
                                    className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
                                        modo === "nova"
                                            ? "bg-[#22365b] text-white"
                                            : "text-slate-600 hover:bg-slate-50"
                                    }`}
                                >
                                    Criar nova
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setModo("catalogo");
                                        setErro("");
                                        setNome("");
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
                            {modo === "nova" && (
                                <div>
                                    <label
                                        htmlFor="nome"
                                        className="mb-1.5 block text-sm font-medium text-slate-700"
                                    >
                                        Nome da seção
                                    </label>

                                    <input
                                        id="nome"
                                        type="text"
                                        value={nome}
                                        onChange={(event) =>
                                            setNome(event.target.value)
                                        }
                                        placeholder="Ex.: Higiene e organização"
                                        maxLength={200}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#22365b] focus:ring-2 focus:ring-[#22365b]/10"
                                        disabled={salvando}
                                    />
                                </div>
                            )}

                            {modo === "catalogo" && (
                                <div>
                                    <label
                                        htmlFor="catalogoSecao"
                                        className="mb-1.5 block text-sm font-medium text-slate-700"
                                    >
                                        Seção do catálogo
                                    </label>

                                    <select
                                        id="catalogoSecao"
                                        value={catalogoSecaoId}
                                        onChange={(event) =>
                                            setCatalogoSecaoId(
                                                event.target.value
                                            )
                                        }
                                        disabled={salvando}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#22365b] focus:ring-2 focus:ring-[#22365b]/10"
                                    >
                                        <option value="">
                                            Selecione uma seção
                                        </option>

                                        {catalogoSecoes.map((secao) => (
                                            <option
                                                key={secao.id}
                                                value={secao.id}
                                            >
                                                {secao.nome}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label
                                    htmlFor="descricao"
                                    className="mb-1.5 block text-sm font-medium text-slate-700"
                                >
                                    Descrição
                                </label>

                                <textarea
                                    id="descricao"
                                    value={descricao}
                                    onChange={(event) =>
                                        setDescricao(event.target.value)
                                    }
                                    placeholder="Descrição opcional da seção"
                                    maxLength={500}
                                    rows={4}
                                    className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#22365b] focus:ring-2 focus:ring-[#22365b]/10"
                                    disabled={salvando}
                                />
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
                                        ? "Adicionar Seção"
                                        : "Criar Seção"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
