"use client";

import { useState } from "react";

type NovaVersaoButtonProps = {
    checklistId: string;
};

export default function NovaVersaoButton({
    checklistId,
}: NovaVersaoButtonProps) {
    const [aberto, setAberto] = useState(false);
    const [descricao, setDescricao] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");

    function abrir() {
        setDescricao("");
        setErro("");
        setAberto(true);
    }

    function fechar() {
        if (salvando) return;
        setAberto(false);
    }

    async function criarVersao() {
        setErro("");

        if (descricao.trim().length > 500) {
            setErro("A descrição deve ter no máximo 500 caracteres.");
            return;
        }

        setSalvando(true);

        try {
            const response = await fetch(
                `/api/checklists/${checklistId}/versoes`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        descricao: descricao.trim() || null,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setErro(
                    data.message ||
                        "Não foi possível criar a versão. Tente novamente."
                );
                return;
            }

            window.location.reload();
        } catch {
            setErro(
                "Não foi possível criar a versão. Tente novamente."
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
                className="rounded-xl bg-[#22365b] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
                + Nova Versão
            </button>

            {aberto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-[#12223f]">
                                    Nova Versão
                                </h2>

                                <p className="mt-1 text-sm text-slate-500">
                                    O número da versão será gerado automaticamente.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={fechar}
                                disabled={salvando}
                                className="text-xl leading-none text-slate-400 transition hover:text-slate-600 disabled:opacity-50"
                                aria-label="Fechar"
                            >
                                ×
                            </button>
                        </div>

                        <div className="mt-6">
                            <label
                                htmlFor="descricao-versao"
                                className="mb-2 block text-sm font-semibold text-slate-700"
                            >
                                Descrição da versão
                            </label>

                            <textarea
                                id="descricao-versao"
                                value={descricao}
                                onChange={(event) =>
                                    setDescricao(event.target.value)
                                }
                                maxLength={500}
                                rows={4}
                                placeholder="Ex.: Atualização dos itens de higiene e temperatura."
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#22365b] focus:ring-2 focus:ring-[#22365b]/10"
                            />

                            <p className="mt-1 text-right text-xs text-slate-400">
                                {descricao.length}/500
                            </p>
                        </div>

                        {erro && (
                            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {erro}
                            </div>
                        )}

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={fechar}
                                disabled={salvando}
                                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={criarVersao}
                                disabled={salvando}
                                className="rounded-xl bg-[#22365b] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {salvando ? "Criando..." : "Criar Versão"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
