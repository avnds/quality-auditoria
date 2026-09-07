import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionByToken } from "@/lib/auth/session";
import db from "@/lib/db";
import NovoClienteButton from "./NovoClienteButton";

type Cliente = {
    id: string;
    razao_social: string;
    nome_fantasia: string;
    cnpj: string;
    email: string | null;
    ativo: number;
};

export default async function ClientesPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("quality_session")?.value;

    if (!token) {
        redirect("/login");
    }

    const session = await getSessionByToken(token);

    if (!session) {
        redirect("/login");
    }

    const perfil = String(session.perfil);

    if (
        perfil !== "MASTER" &&
        perfil !== "SUPERVISORA" &&
        perfil !== "CONSULTOR"
    ) {
        return (
            <main className="min-h-screen bg-gray-50 p-8">
                <div className="mx-auto max-w-7xl">
                    <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
                        <h1 className="text-xl font-semibold text-[#c22a2e]">
                            Acesso não permitido
                        </h1>

                        <p className="mt-2 text-gray-600">
                            Você não possui permissão para visualizar os clientes.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    let resultado;

    if (
        perfil === "MASTER" ||
        perfil === "SUPERVISORA"
    ) {
        resultado = await db.execute({
            sql: `
                SELECT
                    id,
                    razao_social,
                    nome_fantasia,
                    cnpj,
                    email,
                    ativo
                FROM clientes
                ORDER BY nome_fantasia
            `,
            args: [],
        });
    } else {
        resultado = await db.execute({
            sql: `
                SELECT
                    c.id,
                    c.razao_social,
                    c.nome_fantasia,
                    c.cnpj,
                    c.email,
                    c.ativo
                FROM clientes c
                INNER JOIN usuario_clientes uc
                    ON uc.cliente_id = c.id
                WHERE uc.usuario_id = ?
                ORDER BY c.nome_fantasia
            `,
            args: [String(session.usuario_id)],
        });
    }

    const clientes: Cliente[] = resultado.rows.map((cliente) => ({
        id: String(cliente.id),
        razao_social: String(cliente.razao_social),
        nome_fantasia: String(cliente.nome_fantasia),
        cnpj: String(cliente.cnpj),
        email:
            cliente.email === null
                ? null
                : String(cliente.email),
        ativo: Number(cliente.ativo),
    }));

    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <div className="mx-auto max-w-7xl">

                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[#12223f] font-['Montserrat']">
                        Clientes
                    </h1>

                    <div className="mt-2 h-1 w-20 rounded-full bg-[#c22a2e]" />

                    <p className="mt-3 text-gray-600">
                        Gerencie os clientes e seus respectivos estabelecimentos.
                    </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-[#12223f]">
                                Clientes cadastrados
                            </h2>

                            <p className="mt-1 text-sm text-gray-500">
                                Consulte e gerencie os clientes do sistema.
                            </p>
                        </div>

                        {(perfil === "MASTER" ||
                            perfil === "SUPERVISORA") && (
                                <NovoClienteButton />
                            )}
                    </div>

                    <div className="mt-8">

                        {clientes.length === 0 ? (
                            <div className="rounded-xl border border-gray-200 px-5 py-12 text-center text-gray-500">
                                Nenhum cliente cadastrado.
                            </div>
                        ) : (
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
                                                        <button
                                                            type="button"
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

                                            <div className="mt-4 border-t border-gray-100 pt-4">
                                                <button
                                                    type="button"
                                                    className="w-full rounded-lg bg-[#12223f] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                                                >
                                                    Editar cliente
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}