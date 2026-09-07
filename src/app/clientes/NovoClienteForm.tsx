"use client";

import { useState } from "react";

type NovoClienteFormProps = {
    onClose: () => void;
    onCreated: () => void;
};

export default function NovoClienteForm({
    onClose,
    onCreated,
}: NovoClienteFormProps) {
    const [razaoSocial, setRazaoSocial] = useState("");
    const [nomeFantasia, setNomeFantasia] = useState("");
    const [cnpj, setCnpj] = useState("");
    const [email, setEmail] = useState("");

    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");

    async function handleSubmit() {
        setErro("");

        if (
            !razaoSocial.trim() ||
            !nomeFantasia.trim() ||
            !cnpj.trim()
        ) {
            setErro(
                "Razão social, nome fantasia e CNPJ são obrigatórios."
            );
            return;
        }

        setSalvando(true);

        try {
            const response = await fetch("/api/clientes", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    razao_social: razaoSocial,
                    nome_fantasia: nomeFantasia,
                    cnpj,
                    email,
                }),
            });

            const dados = await response.json();

            if (!response.ok) {
                setErro(
                    dados.message ??
                        "Não foi possível criar o cliente."
                );
                return;
            }

            onCreated();
        } catch (error) {
            console.error("Erro ao criar cliente:", error);
            setErro("Não foi possível criar o cliente.");
        } finally {
            setSalvando(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
                <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
                    <div>
                        <h2 className="text-xl font-semibold text-[#12223f]">
                            Novo cliente
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                            Cadastre um novo cliente no sistema.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={salvando}
                        className="ml-4 text-2xl leading-none text-gray-400 transition hover:text-gray-700 disabled:opacity-50"
                        aria-label="Fechar"
                    >
                        ×
                    </button>
                </div>

                <div className="space-y-5 p-5 sm:p-6">
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-gray-700">
                            Razão social
                        </label>

                        <input
                            type="text"
                            value={razaoSocial}
                            onChange={(e) =>
                                setRazaoSocial(e.target.value)
                            }
                            placeholder="Digite a razão social"
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-semibold text-gray-700">
                            Nome fantasia
                        </label>

                        <input
                            type="text"
                            value={nomeFantasia}
                            onChange={(e) =>
                                setNomeFantasia(e.target.value)
                            }
                            placeholder="Digite o nome fantasia"
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-semibold text-gray-700">
                            CNPJ
                        </label>

                        <input
                            type="text"
                            value={cnpj}
                            onChange={(e) =>
                                setCnpj(e.target.value)
                            }
                            placeholder="Digite o CNPJ"
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-semibold text-gray-700">
                            E-mail
                        </label>

                        <input
                            type="email"
                            value={email}
                            onChange={(e) =>
                                setEmail(e.target.value)
                            }
                            placeholder="Digite o e-mail"
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10"
                        />
                    </div>

                    {erro && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {erro}
                        </div>
                    )}

                    <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={salvando}
                            className="w-full rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 sm:w-auto"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={salvando}
                            className="w-full rounded-lg bg-[#12223f] px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                        >
                            {salvando
                                ? "Salvando..."
                                : "Criar cliente"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}