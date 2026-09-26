import { cookies } from "next/headers";
import Link from "next/link";
import db from "@/lib/db";
import { getSessionByToken } from "@/lib/auth/session";

export default async function AuditoriasPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("quality_session")?.value;

    if (!token) {
        return (
            <main className="min-h-screen bg-gray-50 p-8">
                <div className="mx-auto max-w-7xl">
                    <p className="text-gray-600">
                        Usuário não autenticado.
                    </p>
                </div>
            </main>
        );
    }

    const session = await getSessionByToken(token);

    if (!session) {
        return (
            <main className="min-h-screen bg-gray-50 p-8">
                <div className="mx-auto max-w-7xl">
                    <p className="text-gray-600">
                        Sessão inválida ou expirada.
                    </p>
                </div>
            </main>
        );
    }

    const result = await db.execute({
        sql: `
            SELECT
                a.id,
                a.criada_em,
                l.nome AS loja_nome,
                c.nome_fantasia AS cliente_nome,
                u.nome AS auditor_nome,
                av.numero AS versao_numero,
                av.status
            FROM auditorias a
            INNER JOIN lojas l
                ON l.id = a.loja_id
            INNER JOIN clientes c
                ON c.id = l.cliente_id
            INNER JOIN usuarios u
                ON u.id = a.auditor_id
            INNER JOIN auditoria_versoes av
                ON av.auditoria_id = a.id
            WHERE av.numero = (
                SELECT MAX(av2.numero)
                FROM auditoria_versoes av2
                WHERE av2.auditoria_id = a.id
            )
            ORDER BY a.criada_em DESC
        `,
        args: [],
    });

    const auditorias = result.rows;

    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <div className="mx-auto max-w-7xl">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1
                            className="text-3xl font-bold"
                            style={{ color: "#12223f" }}
                        >
                            Auditorias
                        </h1>

                        <div
                            className="mt-2 h-1 w-16 rounded"
                            style={{ backgroundColor: "#c22a2e" }}
                        />

                        <p className="mt-3 text-gray-600">
                            Gerencie as auditorias realizadas nos
                            estabelecimentos.
                        </p>
                    </div>

                    <Link
                        href="/auditorias/nova"
                        className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-5 py-3 font-semibold text-white transition hover:opacity-90"
                        style={{ backgroundColor: "#c22a2e" }}
                    >
                        + Nova Auditoria
                    </Link>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    {auditorias.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            <div className="text-lg font-semibold text-gray-700">
                                Nenhuma auditoria cadastrada
                            </div>

                            <p className="mt-2 text-sm text-gray-500">
                                Clique em “Nova Auditoria” para iniciar a
                                primeira auditoria.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="hidden overflow-x-auto md:block">
                                <table className="min-w-full">
                                    <thead className="border-b border-gray-200 bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                                                Cliente
                                            </th>

                                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                                                Loja
                                            </th>

                                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                                                Auditor
                                            </th>

                                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                                                Versão
                                            </th>

                                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100">
                                        {auditorias.map((auditoria) => (
                                            <tr key={String(auditoria.id)}>
                                                <td className="px-6 py-4 text-sm text-gray-700">
                                                    {String(
                                                        auditoria.cliente_nome
                                                    )}
                                                </td>

                                                <td className="px-6 py-4 text-sm text-gray-700">
                                                    {String(
                                                        auditoria.loja_nome
                                                    )}
                                                </td>

                                                <td className="px-6 py-4 text-sm text-gray-700">
                                                    {String(
                                                        auditoria.auditor_nome
                                                    )}
                                                </td>

                                                <td className="px-6 py-4 text-sm text-gray-700">
                                                    v
                                                    {String(
                                                        auditoria.versao_numero
                                                    )}
                                                </td>

                                                <td className="px-6 py-4 text-sm font-medium text-gray-700">
                                                    {String(
                                                        auditoria.status
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="divide-y divide-gray-100 md:hidden">
                                {auditorias.map((auditoria) => (
                                    <div
                                        key={String(auditoria.id)}
                                        className="p-5"
                                    >
                                        <div className="font-semibold text-gray-800">
                                            {String(auditoria.loja_nome)}
                                        </div>

                                        <div className="mt-1 text-sm text-gray-500">
                                            {String(auditoria.cliente_nome)}
                                        </div>

                                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <div className="text-xs text-gray-400">
                                                    Auditor
                                                </div>

                                                <div className="font-medium text-gray-700">
                                                    {String(
                                                        auditoria.auditor_nome
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <div className="text-xs text-gray-400">
                                                    Status
                                                </div>

                                                <div className="font-medium text-gray-700">
                                                    {String(
                                                        auditoria.status
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}