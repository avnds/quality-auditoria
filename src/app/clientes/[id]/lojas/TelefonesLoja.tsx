"use client";

import { useEffect, useState } from "react";

type Telefone = {
    id: string;
    loja_id: string;
    numero: string;
    tipo: string | null;
    principal: number;
};

type TelefonesLojaProps = {
    lojaId: string;
    podeGerenciar: boolean;
};

export default function TelefonesLoja({
    lojaId,
    podeGerenciar,
}: TelefonesLojaProps) {
    const [telefones, setTelefones] = useState<Telefone[]>([]);
    const [carregando, setCarregando] = useState(true);

    const [numero, setNumero] = useState("");
    const [tipo, setTipo] = useState("");
    const [principal, setPrincipal] = useState(false);

    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");

    async function carregarTelefones() {
        try {
            const response = await fetch(
                `/api/telefones?loja_id=${lojaId}`
            );

            const dados = await response.json();

            if (!response.ok) {
                setErro(
                    dados.message ??
                        "Não foi possível carregar os telefones."
                );
                return;
            }

            setTelefones(dados.telefones ?? []);
        } catch (error) {
            console.error("Erro ao carregar telefones:", error);
            setErro("Não foi possível carregar os telefones.");
        } finally {
            setCarregando(false);
        }
    }

    useEffect(() => {
        carregarTelefones();
    }, [lojaId]);

    async function handleAdicionar() {
        setErro("");

        if (!numero.trim()) {
            setErro("Informe o número do telefone.");
            return;
        }

        setSalvando(true);

        try {
            const response = await fetch("/api/telefones", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    loja_id: lojaId,
                    numero,
                    tipo,
                    principal,
                }),
            });

            const dados = await response.json();

            if (!response.ok) {
                setErro(
                    dados.message ??
                        "Não foi possível cadastrar o telefone."
                );
                return;
            }

            setNumero("");
            setTipo("");
            setPrincipal(false);

            await carregarTelefones();
        } catch (error) {
            console.error("Erro ao cadastrar telefone:", error);
            setErro("Não foi possível cadastrar o telefone.");
        } finally {
            setSalvando(false);
        }
    }

    return (
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                <h2 className="text-lg font-semibold text-[#12223f]">
                    Telefones
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                    Telefones de contato desta loja.
                </p>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
                {podeGerenciar && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <h3 className="mb-4 text-sm font-semibold text-[#12223f]">
                            Adicionar telefone
                        </h3>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div className="sm:col-span-2">
                                <label className="mb-1 block text-sm font-semibold text-gray-700">
                                    Número *
                                </label>

                                <input
                                    type="text"
                                    value={numero}
                                    onChange={(e) =>
                                        setNumero(e.target.value)
                                    }
                                    disabled={salvando}
                                    placeholder="(85) 99999-9999"
                                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10 disabled:bg-gray-100"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold text-gray-700">
                                    Tipo
                                </label>

                                <select
                                    value={tipo}
                                    onChange={(e) =>
                                        setTipo(e.target.value)
                                    }
                                    disabled={salvando}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10 disabled:bg-gray-100"
                                >
                                    <option value="">
                                        Selecione
                                    </option>
                                    <option value="Celular">
                                        Celular
                                    </option>
                                    <option value="WhatsApp">
                                        WhatsApp
                                    </option>
                                    <option value="Fixo">
                                        Fixo
                                    </option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={principal}
                                    onChange={(e) =>
                                        setPrincipal(e.target.checked)
                                    }
                                    disabled={salvando}
                                    className="h-4 w-4 rounded border-gray-300"
                                />

                                Telefone principal
                            </label>

                            <button
                                type="button"
                                onClick={handleAdicionar}
                                disabled={salvando}
                                className="w-full rounded-lg bg-[#12223f] px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                            >
                                {salvando
                                    ? "Salvando..."
                                    : "Adicionar telefone"}
                            </button>
                        </div>
                    </div>
                )}

                {erro && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {erro}
                    </div>
                )}

                {carregando ? (
                    <p className="text-sm text-gray-500">
                        Carregando telefones...
                    </p>
                ) : telefones.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center">
                        <p className="text-sm font-medium text-gray-600">
                            Nenhum telefone cadastrado.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {telefones.map((telefone) => (
                            <div
                                key={telefone.id}
                                className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold text-gray-800">
                                            {telefone.numero}
                                        </span>

                                        {telefone.tipo && (
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                                                {telefone.tipo}
                                            </span>
                                        )}

                                        {telefone.principal === 1 && (
                                            <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                                                Principal
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}