"use client";

import { useState } from "react";
import EditarChecklistButton from "./EditarChecklistButton";
import AlterarStatusChecklistButton from "./AlterarStatusChecklistButton";
import Link from "next/link";

type Setor = {
    id: string;
    nome: string;
};

type Checklist = {
    id: string;
    nome: string;
    descricao: string | null;
    ativo: boolean;
    setorId: string;
    setorNome: string;
};

type ChecklistsTableProps = {
    checklistsIniciais: Checklist[];
    setores: Setor[];
    podeGerenciar: boolean;
};

export default function ChecklistsTable({
    checklistsIniciais,
    setores,
    podeGerenciar,
}: ChecklistsTableProps) {
    const [checklists] = useState(checklistsIniciais);

    return (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            {/* Desktop */}
            <div className="hidden md:block">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Checklist
                                </th>

                                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Setor
                                </th>

                                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Descrição
                                </th>

                                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Status
                                </th>

                                {podeGerenciar && (
                                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Ações
                                    </th>
                                )}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {checklists.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={podeGerenciar ? 5 : 4}
                                        className="px-6 py-12 text-center"
                                    >
                                        <p className="text-sm font-medium text-slate-600">
                                            Nenhum checklist cadastrado.
                                        </p>

                                        <p className="mt-1 text-sm text-slate-400">
                                            Os checklists cadastrados aparecerão
                                            aqui.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                checklists.map((checklist) => (
                                    <tr
                                        key={checklist.id}
                                        className="transition hover:bg-slate-50/70"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-800">
                                                {checklist.nome}
                                            </div>
                                        </td>

                                        <td className="px-6 py-4">
                                            <span className="inline-flex rounded-lg bg-slate-100 px-3 py-1 text-sm font-medium text-[#22365b]">
                                                {checklist.setorNome}
                                            </span>
                                        </td>

                                        <td className="max-w-md px-6 py-4">
                                            <p className="truncate text-sm text-slate-600">
                                                {checklist.descricao || "—"}
                                            </p>
                                        </td>

                                        <td className="px-6 py-4">
                                            {checklist.ativo ? (
                                                <span className="inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                                                    Ativo
                                                </span>
                                            ) : (
                                                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                                                    Inativo
                                                </span>
                                            )}
                                        </td>

                                        {podeGerenciar && (
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <EditarChecklistButton
                                                        checklist={checklist}
                                                        setores={setores}
                                                        onUpdated={() => window.location.reload()}
                                                    />

                                                    <Link
                                                        href={`/checklists/${checklist.id}/versoes`}
                                                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[#22365b] transition hover:bg-slate-50"
                                                    >
                                                        Versões
                                                    </Link>

                                                    <AlterarStatusChecklistButton
                                                        checklistId={checklist.id}
                                                        ativo={checklist.ativo}
                                                        nome={checklist.nome}
                                                        onChanged={() => window.location.reload()}
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

            {/* Mobile */}
            <div className="md:hidden">
                {checklists.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                        <p className="text-sm font-medium text-slate-600">
                            Nenhum checklist cadastrado.
                        </p>

                        <p className="mt-1 text-sm text-slate-400">
                            Os checklists cadastrados aparecerão aqui.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {checklists.map((checklist) => (
                            <div
                                key={checklist.id}
                                className="p-5"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-slate-800">
                                            {checklist.nome}
                                        </h3>

                                        <div className="mt-2">
                                            <span className="inline-flex rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-[#22365b]">
                                                {checklist.setorNome}
                                            </span>
                                        </div>
                                    </div>

                                    {checklist.ativo ? (
                                        <span className="shrink-0 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                                            Ativo
                                        </span>
                                    ) : (
                                        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                                            Inativo
                                        </span>
                                    )}
                                </div>

                                <div className="mt-4">
                                    <p className="text-sm leading-6 text-slate-600">
                                        {checklist.descricao ||
                                            "Sem descrição cadastrada."}
                                    </p>
                                </div>

                                {podeGerenciar && (
                                    <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
                                        <div className="flex flex-wrap justify-end gap-2">
                                            <EditarChecklistButton
                                                checklist={checklist}
                                                setores={setores}
                                                onUpdated={() => window.location.reload()}
                                            />

                                            <Link
                                                href={`/checklists/${checklist.id}/versoes`}
                                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[#22365b] transition hover:bg-slate-50"
                                            >
                                                Versões
                                            </Link>

                                            <AlterarStatusChecklistButton
                                                checklistId={checklist.id}
                                                ativo={checklist.ativo}
                                                nome={checklist.nome}
                                                onChanged={() => window.location.reload()}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}