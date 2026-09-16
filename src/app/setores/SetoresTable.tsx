"use client";

import { useState } from "react";
import NovoSetorButton from "./NovoSetorButton";
import EditarSetorButton from "./EditarSetorButton";
import AlterarStatusSetorButton from "./AlterarStatusSetorButton";

type Setor = {
    id: string;
    nome: string;
    descricao: string | null;
    ativo: boolean;
};

type SetoresTableProps = {
    setores: Setor[];
    podeGerenciar: boolean;
};

export default function SetoresTable({
    setores: setoresIniciais,
    podeGerenciar,
}: SetoresTableProps) {
    const [setores] = useState(setoresIniciais);

    function atualizarLista() {
        window.location.reload();
    }

    return (
        <div className="space-y-6">
            {podeGerenciar && (
                <div className="flex justify-end">
                    <NovoSetorButton onCreated={atualizarLista} />
                </div>
            )}

            {/* Desktop */}
            <div className="hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm md:block">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="px-6 py-4 text-left text-sm font-semibold text-[#12223f]">
                                Setor
                            </th>

                            <th className="px-6 py-4 text-left text-sm font-semibold text-[#12223f]">
                                Descrição
                            </th>

                            <th className="px-6 py-4 text-center text-sm font-semibold text-[#12223f]">
                                Status
                            </th>

                            {podeGerenciar && (
                                <th className="px-6 py-4 text-right text-sm font-semibold text-[#12223f]">
                                    Ações
                                </th>
                            )}
                        </tr>
                    </thead>

                    <tbody>
                        {setores.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={podeGerenciar ? 4 : 3}
                                    className="px-6 py-12 text-center text-sm text-slate-500"
                                >
                                    Nenhum setor cadastrado.
                                </td>
                            </tr>
                        ) : (
                            setores.map((setor) => (
                                <tr
                                    key={setor.id}
                                    className="border-b border-slate-100 last:border-b-0"
                                >
                                    <td className="px-6 py-4">
                                        <span className="font-medium text-slate-800">
                                            {setor.nome}
                                        </span>
                                    </td>

                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {setor.descricao || "—"}
                                    </td>

                                    <td className="px-6 py-4 text-center">
                                        <span
                                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                                setor.ativo
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-slate-100 text-slate-500"
                                            }`}
                                        >
                                            {setor.ativo
                                                ? "Ativo"
                                                : "Inativo"}
                                        </span>
                                    </td>

                                    {podeGerenciar && (
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-2">
                                                <EditarSetorButton
                                                    setor={setor}
                                                    onChanged={
                                                        atualizarLista
                                                    }
                                                />

                                                <AlterarStatusSetorButton
                                                    setorId={setor.id}
                                                    ativo={setor.ativo}
                                                    nome={setor.nome}
                                                    onChanged={
                                                        atualizarLista
                                                    }
                                                />
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile */}
            <div className="space-y-3 md:hidden">
                {setores.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-12 text-center text-sm text-slate-500 shadow-sm">
                        Nenhum setor cadastrado.
                    </div>
                ) : (
                    setores.map((setor) => (
                        <div
                            key={setor.id}
                            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="break-words font-semibold text-slate-800">
                                        {setor.nome}
                                    </h3>

                                    <p className="mt-2 break-words text-sm text-slate-600">
                                        {setor.descricao || "Sem descrição"}
                                    </p>
                                </div>

                                <span
                                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                                        setor.ativo
                                            ? "bg-green-100 text-green-700"
                                            : "bg-slate-100 text-slate-500"
                                    }`}
                                >
                                    {setor.ativo
                                        ? "Ativo"
                                        : "Inativo"}
                                </span>
                            </div>

                            {podeGerenciar && (
                                <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-4">
                                    <EditarSetorButton
                                        setor={setor}
                                        onChanged={atualizarLista}
                                    />

                                    <AlterarStatusSetorButton
                                        setorId={setor.id}
                                        ativo={setor.ativo}
                                        nome={setor.nome}
                                        onChanged={atualizarLista}
                                    />
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}