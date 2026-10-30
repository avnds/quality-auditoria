import Link from "next/link";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { temPermissao } from "@/lib/auth/authorization";
import TreinamentosManager from "./TreinamentosManager";

type PageProps = {
    params: Promise<{ id: string; lojaId: string }>;
};

export default async function TreinamentosPage({ params }: PageProps) {
    const usuario = await getCurrentUser();
    if (!usuario) redirect("/login");

    const permitido = await temPermissao(usuario.id, "treinamentos.visualizar");
    if (!permitido) {
        return (
            <main className="min-h-screen bg-gray-50 p-8">
                <div className="mx-auto max-w-5xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
                    <h1 className="text-xl font-semibold text-[#c22a2e]">Acesso não permitido</h1>
                    <p className="mt-2 text-slate-600">Você não possui permissão para visualizar treinamentos.</p>
                </div>
            </main>
        );
    }

    const { id: clienteId, lojaId } = await params;

    const lojaResult = await db.execute({
        sql: `
            SELECT l.id, l.nome, l.cliente_id, c.nome_fantasia
            FROM lojas l
            INNER JOIN clientes c ON c.id = l.cliente_id
            WHERE l.id = ? AND l.cliente_id = ?
              AND (
                ? IN ('MASTER', 'SUPERVISORA')
                OR EXISTS (
                    SELECT 1 FROM usuario_lojas ul
                    WHERE ul.loja_id = l.id AND ul.usuario_id = ?
                )
              )
            LIMIT 1
        `,
        args: [lojaId, clienteId, usuario.perfil, usuario.id],
    });

    if (lojaResult.rows.length === 0) redirect("/clientes");

    const loja = lojaResult.rows[0];
    const podeGerenciar =
        (usuario.perfil === "MASTER" || usuario.perfil === "SUPERVISORA") &&
        await temPermissao(usuario.id, "treinamentos.gerenciar");

    return (
        <main className="min-h-screen bg-gray-50 p-6 sm:p-8">
            <div className="mx-auto max-w-5xl">
                <div className="mb-6">
                    <Link
                        href={`/clientes/${clienteId}/lojas`}
                        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                        ← Voltar para lojas
                    </Link>
                    <h1 className="mt-5 text-3xl font-bold text-[#12223f]">Treinamentos</h1>
                    <div className="mt-2 h-1 w-20 rounded-full bg-[#c22a2e]" />
                    <p className="mt-3 text-slate-600">
                        {String(loja.nome)} • {String(loja.nome_fantasia)}
                    </p>
                </div>

                {podeGerenciar ? (
                    <TreinamentosManager lojaId={lojaId} />
                ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <p className="text-sm text-slate-600">
                            Você possui acesso de consulta aos treinamentos desta loja.
                        </p>
                    </div>
                )}
            </div>
        </main>
    );
}
