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

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full">
                <thead className="bg-gray-50">
                    <tr className="text-left text-sm text-gray-600">
                        <th className="px-5 py-4 font-semibold">
                            Nome
                        </th>

                        <th className="px-5 py-4 font-semibold">
                            E-mail
                        </th>

                        <th className="px-5 py-4 font-semibold">
                            Perfil
                        </th>

                        <th className="px-5 py-4 font-semibold">
                            Status
                        </th>

                        <th className="px-5 py-4 font-semibold text-right">
                            Ações
                        </th>
                    </tr>
                </thead>

                <tbody>
                    {usuarios.length === 0 ? (
                        <tr>
                            <td
                                colSpan={5}
                                className="px-5 py-12 text-center text-gray-500"
                            >
                                Nenhum usuário cadastrado.
                            </td>
                        </tr>
                    ) : (
                        usuarios.map((usuario) => (
                            <tr
                                key={usuario.id}
                                className="border-t border-gray-100"
                            >
                                <td className="px-5 py-4 font-medium text-gray-800">
                                    {usuario.nome}
                                </td>

                                <td className="px-5 py-4 text-gray-600">
                                    {usuario.email}
                                </td>

                                <td className="px-5 py-4">
                                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                                        {usuario.perfil}
                                    </span>
                                </td>

                                <td className="px-5 py-4">
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
                                </td>

                                <td className="px-5 py-4 text-right">
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/usuarios/${usuario.id}`)}
                                        className="text-sm font-semibold text-[#12223f] hover:underline"
                                    >
                                        Editar
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}