"use client";

import Link from "next/link";
import { useState } from "react";
import EditarClienteForm from "./EditarClienteForm";

type Cliente = {
    id: string;
    razao_social: string;
    nome_fantasia: string;
    cnpj: string;
    email: string | null;
    ativo: number;
};

type ClientesTableProps = {
    clientes: Cliente[];
    podeEditar: boolean;
};

export default function ClientesTable({
    clientes,
    podeEditar,
}: ClientesTableProps) {
    const [clienteSelecionado, setClienteSelecionado] =
        useState<Cliente | null>(null);

    function handleUpdated() {
        setClienteSelecionado(null);
        window.location.reload();
    }

    return (
        <>
            {/* Desktop */}
            <div className="hidden overflow-hidden rounded-xl border border-gray-200 md:block">
                <table className="w-full table-fixed">
                    <thead className="bg-gray-50">
                        <tr className="text-left text-sm text-gray-600">
                            <th className="w-[28%] px-5 py-4 font-semibold">
                                Nome fantasia
                            </th>

                            <th className="w-[25%] px-5 py-4 font-semibold">
                                Razão social
                            </th>

                            <th className="w-[20%] px-5 py-4 font-semibold">
                                CNPJ
                            </th>

                            <th className="w-[15%] px-5 py-4 font-semibold">
                                Status
                            </th>

                            <th className="w-[12%] px-5 py-4 text-right font-semibold">
                                Ações
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {clientes.map((cliente) => (
                            <tr
                                key={cliente.id}
                                className="border-t border-gray-100"
                            >
                                <td className="px-5 py-4 font-medium text-gray-800 break-words">
                                    {cliente.nome_fantasia}
                                </td>

                                <td className="px-5 py-4 text-gray-600 break-words">
                                    {cliente.razao_social}
                                </td>

                                <td className="px-5 py-4 text-gray-600">
                                    {cliente.cnpj}
                                </td>

                                <td className="px-5 py-4">
                                    <span
                                        className={
                                            cliente.ativo === 1
                                                ? "inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                                                : "inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
                                        }
                                    >
                                        {cliente.ativo === 1
                                            ? "Ativo"
                                            : "Inativo"}
                                    </span>
                                </td>

                                <td className="px-5 py-4 text-right">
                                    <div className="flex items-center justify-end gap-4">
                                        <Link
                                            href={`/clientes/${cliente.id}/lojas`}
                                            className="text-sm font-semibold text-[#12223f] hover:underline"
                                        >
                                            Lojas
                                        </Link>

                                        {podeEditar && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setClienteSelecionado(cliente)
                                                }
                                                className="text-sm font-semibold text-[#12223f] hover:underline"
                                            >
                                                Editar
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile */}
            <div className="space-y-3 md:hidden">
                {clientes.map((cliente) => (
                    <div
                        key={cliente.id}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                        <div className="min-w-0">
                            <p className="font-semibold text-gray-800 break-words">
                                {cliente.nome_fantasia}
                            </p>

                            <p className="mt-1 text-sm text-gray-600 break-words">
                                {cliente.razao_social}
                            </p>

                            <p className="mt-2 text-sm text-gray-500">
                                {cliente.cnpj}
                            </p>
                        </div>

                        <div className="mt-4">
                            <span
                                className={
                                    cliente.ativo === 1
                                        ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                                        : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
                                }
                            >
                                {cliente.ativo === 1
                                    ? "Ativo"
                                    : "Inativo"}
                            </span>
                        </div>

                        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                            <Link
                                href={`/clientes/${cliente.id}/lojas`}
                                className="block w-full rounded-lg border border-[#12223f] px-4 py-3 text-center text-sm font-semibold text-[#12223f] transition hover:bg-gray-50"
                            >
                                Ver lojas
                            </Link>

                            {podeEditar && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setClienteSelecionado(cliente)
                                    }
                                    className="w-full rounded-lg bg-[#12223f] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                                >
                                    Editar cliente
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {clienteSelecionado && (
                <EditarClienteForm
                    cliente={clienteSelecionado}
                    onClose={() => setClienteSelecionado(null)}
                    onUpdated={handleUpdated}
                />
            )}
        </>
    );
}