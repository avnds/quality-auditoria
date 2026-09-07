"use client";

import { useRouter } from "next/navigation";

type Usuario = {
    id: string;
    nome: string;
    email: string;
    perfil: string;
    ativo: number;
};

type UsuariosTableProps = {
    usuarios: Usuario[];
};

export default function UsuariosTable({
    usuarios,
}: UsuariosTableProps) {
    const router = useRouter();

    if (usuarios.length === 0) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center text-gray-500">
                Nenhum usuário cadastrado.
            </div>
        );
    }

    return (
        <>
            {/* Desktop */}
            <div className="hidden overflow-hidden rounded-xl border border-gray-200 md:block">
                <table className="w-full table-fixed">
                    <thead className="bg-gray-50">
                        <tr className="text-left text-sm text-gray-600">
                            <th className="w-[22%] px-5 py-4 font-semibold">
                                Nome
                            </th>

                            <th className="w-[34%] px-5 py-4 font-semibold">
                                E-mail
                            </th>

                            <th className="w-[18%] px-5 py-4 font-semibold">
                                Perfil
                            </th>

                            <th className="w-[14%] px-5 py-4 font-semibold">
                                Status
                            </th>

                            <th className="w-[12%] px-5 py-4 text-right font-semibold">
                                Ações
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {usuarios.map((usuario) => (
                            <tr
                                key={usuario.id}
                                className="border-t border-gray-100"
                            >
                                <td className="px-5 py-4 font-medium text-gray-800 break-words">
                                    {usuario.nome}
                                </td>

                                <td className="px-5 py-4 text-gray-600 break-all">
                                    {usuario.email}
                                </td>

                                <td className="px-5 py-4">
                                    <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                                        {usuario.perfil}
                                    </span>
                                </td>

                                <td className="px-5 py-4">
                                    <span
                                        className={
                                            usuario.ativo === 1
                                                ? "inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                                                : "inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
                                        }
                                    >
                                        {usuario.ativo === 1
                                            ? "Ativo"
                                            : "Inativo"}
                                    </span>
                                </td>

                                <td className="px-5 py-4 text-right">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            router.push(
                                                `/usuarios/${usuario.id}`
                                            )
                                        }
                                        className="text-sm font-semibold text-[#12223f] hover:underline"
                                    >
                                        Editar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile */}
            <div className="space-y-3 md:hidden">
                {usuarios.map((usuario) => (
                    <div
                        key={usuario.id}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                        <div className="min-w-0">
                            <p className="font-semibold text-gray-800 break-words">
                                {usuario.nome}
                            </p>

                            <p className="mt-1 text-sm text-gray-600 break-all">
                                {usuario.email}
                            </p>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                                {usuario.perfil}
                            </span>

                            <span
                                className={
                                    usuario.ativo === 1
                                        ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                                        : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
                                }
                            >
                                {usuario.ativo === 1
                                    ? "Ativo"
                                    : "Inativo"}
                            </span>
                        </div>

                        <div className="mt-4 border-t border-gray-100 pt-4">
                            <button
                                type="button"
                                onClick={() =>
                                    router.push(
                                        `/usuarios/${usuario.id}`
                                    )
                                }
                                className="w-full rounded-lg bg-[#12223f] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                            >
                                Editar usuário
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}