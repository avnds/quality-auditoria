"use client";

import { useEffect, useState } from "react";

type Setor = {
    id: string;
    nome: string;
    descricao: string | null;
    ativo: boolean;
    associado: boolean;
};

type SetoresLojaProps = {
    lojaId: string;
    podeGerenciar: boolean;
};

export default function SetoresLoja({
    lojaId,
    podeGerenciar,
}: SetoresLojaProps) {
    const [setores, setSetores] = useState<Setor[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const [mensagem, setMensagem] = useState("");

    async function carregarSetores() {
        setErro("");
        setCarregando(true);

        try {
            const response = await fetch(
                `/api/lojas/${lojaId}/setores`
            );

            const data = await response.json();

            if (!response.ok) {
                setErro(
                    data.message ||
                        "Não foi possível consultar os setores."
                );
                return;
            }

            setSetores(data.setores);
        } catch {
            setErro(
                "Não foi possível consultar os setores. Tente novamente."
            );
        } finally {
            setCarregando(false);
        }
    }

    useEffect(() => {
        carregarSetores();
    }, [lojaId]);

    function alternarSetor(setorId: string) {
        setSetores((setoresAtuais) =>
            setoresAtuais.map((setor) =>
                setor.id === setorId
                    ? {
                          ...setor,
                          associado: !setor.associado,
                      }
                    : setor
            )
        );

        setMensagem("");
        setErro("");
    }

    async function salvarSetores() {
        setErro("");
        setMensagem("");
        setSalvando(true);

        try {
            const setorIds = setores
                .filter((setor) => setor.associado)
                .map((setor) => setor.id);

            const response = await fetch(
                `/api/lojas/${lojaId}/setores`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        setorIds,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setErro(
                    data.message ||
                        "Não foi possível salvar os setores."
                );
                return;
            }

            setMensagem("Setores atualizados com sucesso.");
            await carregarSetores();
        } catch {
            setErro(
                "Não foi possível salvar os setores. Tente novamente."
            );
        } finally {
            setSalvando(false);
        }
    }

    if (carregando) {
        return (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">
                    Carregando setores...
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-5">
                <h3 className="text-lg font-bold text-[#12223f]">
                    Setores da loja
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                    {podeGerenciar
                        ? "Selecione os setores que fazem parte desta loja."
                        : "Setores configurados para esta loja."}
                </p>
            </div>

            {erro && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {erro}
                </div>
            )}

            {mensagem && (
                <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    {mensagem}
                </div>
            )}

            {setores.length === 0 ? (
                <div className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    Nenhum setor ativo cadastrado.
                </div>
            ) : (
                <div className="space-y-3">
                    {setores.map((setor) => (
                        <label
                            key={setor.id}
                            className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                                podeGerenciar
                                    ? "cursor-pointer hover:bg-slate-50"
                                    : "cursor-default"
                            } ${
                                setor.associado
                                    ? "border-[#12223f]/20 bg-slate-50"
                                    : "border-slate-200"
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={setor.associado}
                                onChange={() =>
                                    alternarSetor(setor.id)
                                }
                                disabled={
                                    !podeGerenciar || salvando
                                }
                                className="h-4 w-4 accent-[#12223f]"
                            />

                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800">
                                    {setor.nome}
                                </p>

                                {setor.descricao && (
                                    <p className="mt-0.5 text-xs text-slate-500">
                                        {setor.descricao}
                                    </p>
                                )}
                            </div>
                        </label>
                    ))}
                </div>
            )}

            {podeGerenciar && setores.length > 0 && (
                <div className="mt-5 flex justify-end">
                    <button
                        type="button"
                        onClick={salvarSetores}
                        disabled={salvando}
                        className="rounded-xl bg-[#c22a2e] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {salvando
                            ? "Salvando..."
                            : "Salvar Setores"}
                    </button>
                </div>
            )}
        </div>
    );
}