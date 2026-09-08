"use client";

import { useState } from "react";

type Cliente = {
    id: string;
    razao_social: string;
    nome_fantasia: string;
    cnpj: string;
    email: string | null;
    ativo: number;
};

type EditarClienteFormProps = {
    cliente: Cliente;
    onClose: () => void;
    onUpdated: () => void;
};

export default function EditarClienteForm({
    cliente,
    onClose,
    onUpdated,
}: EditarClienteFormProps) {
    const [razaoSocial, setRazaoSocial] = useState(cliente.razao_social);
    const [nomeFantasia, setNomeFantasia] = useState(cliente.nome_fantasia);
    const [cnpj, setCnpj] = useState(cliente.cnpj);
    const [email, setEmail] = useState(cliente.email ?? "");

    const [salvando, setSalvando] = useState(false);
    const [alterandoStatus, setAlterandoStatus] = useState(false);
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
            const response = await fetch(`/api/clientes/${cliente.id}`, {
                method: "PUT",
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
                    "Não foi possível atualizar o cliente."
                );
                return;
            }

            onUpdated();
        } catch (error) {
            console.error("Erro ao editar cliente:", error);
            setErro("Não foi possível atualizar o cliente.");
        } finally {
            setSalvando(false);
        }
    }

    async function handleAlterarStatus() {
        const novoStatus = cliente.ativo === 1 ? 0 : 1;

        const mensagem =
            novoStatus === 1
                ? "Deseja ativar este cliente?"
                : "Deseja inativar este cliente?";

        if (!window.confirm(mensagem)) {
            return;
        }

        setErro("");
        setAlterandoStatus(true);

        try {
            const response = await fetch(`/api/clientes/${cliente.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ativo: novoStatus,
                }),
            });

            const dados = await response.json();

            if (!response.ok) {
                setErro(
                    dados.message ??
                    "Não foi possível alterar o status do cliente."
                );
                return;
            }

            onUpdated();
        } catch (error) {
            console.error(
                "Erro ao alterar status do cliente:",
                error
            );
            setErro(
                "Não foi possível alterar o status do cliente."
            );
        } finally {
            setAlterandoStatus(false);
        }
    }

    const ocupado = salvando || alterandoStatus;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
                <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
                    <div>
                        <h2 className="text-xl font-semibold text-[#12223f]">
                            Editar cliente
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                            Atualize os dados do cliente.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={ocupado}
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
                            disabled={ocupado}
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10 disabled:bg-gray-50"
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
                            disabled={ocupado}
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10 disabled:bg-gray-50"
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
                            disabled={ocupado}
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10 disabled:bg-gray-50"
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
                            disabled={ocupado}
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-[#12223f] focus:ring-2 focus:ring-[#12223f]/10 disabled:bg-gray-50"
                        />
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-semibold text-gray-700">
                                    Status do cliente
                                </p>

                                <p className="mt-1 text-sm text-gray-500">
                                    Atualmente:{" "}
                                    <span
                                        className={
                                            cliente.ativo === 1
                                                ? "font-semibold text-green-700"
                                                : "font-semibold text-red-700"
                                        }
                                    >
                                        {cliente.ativo === 1
                                            ? "Ativo"
                                            : "Inativo"}
                                    </span>
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleAlterarStatus}
                                disabled={ocupado}
                                className={
                                    cliente.ativo === 1
                                        ? "w-full rounded-lg border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60 sm:w-auto"
                                        : "w-full rounded-lg border border-green-200 px-4 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-50 disabled:opacity-60 sm:w-auto"
                                }
                            >
                                {alterandoStatus
                                    ? "Alterando..."
                                    : cliente.ativo === 1
                                        ? "Inativar cliente"
                                        : "Ativar cliente"}
                            </button>
                        </div>
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
                            disabled={ocupado}
                            className="w-full rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 sm:w-auto"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={ocupado}
                            className="w-full rounded-lg bg-[#12223f] px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                        >
                            {salvando
                                ? "Salvando..."
                                : "Salvar alterações"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}