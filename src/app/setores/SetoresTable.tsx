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
    const [setores, setSetores] = useState(setoresIniciais);

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

            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
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
            </div>
        </div>
    );
}