import Link from "next/link";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { temPermissao } from "@/lib/auth/authorization";
import TreinamentosManager from "@/app/clientes/[id]/lojas/[lojaId]/treinamentos/TreinamentosManager";

type PageProps = {
    searchParams: Promise<{ clienteId?: string; lojaId?: string }>;
};

export default async function TreinamentosPage({ searchParams }: PageProps) {
    const usuario = await getCurrentUser();
    if (!usuario) redirect("/login");

    const permitido = await temPermissao(usuario.id, "treinamentos.visualizar");
    if (!permitido) {
        return (
            <main className="min-h-screen bg-gray-50 p-6 sm:p-8">
                <div className="mx-auto max-w-5xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
                    <h1 className="text-xl font-semibold text-[#c22a2e]">Acesso não permitido</h1>
                    <p className="mt-2 text-slate-600">Você não possui permissão para visualizar treinamentos.</p>
                </div>
            </main>
        );
    }

    const { clienteId, lojaId } = await searchParams;
    const acessoAmplo = usuario.perfil === "MASTER" || usuario.perfil === "SUPERVISORA";

    const lojasResult = await db.execute({
        sql: `
            SELECT l.id, l.nome, l.cliente_id, c.nome_fantasia
            FROM lojas l
            INNER JOIN clientes c ON c.id = l.cliente_id
            WHERE (
                ? = 1
                OR EXISTS (
                    SELECT 1 FROM usuario_lojas ul
                    WHERE ul.loja_id = l.id AND ul.usuario_id = ?
                )
            )
            AND (? IS NULL OR l.cliente_id = ?)
            ORDER BY c.nome_fantasia, l.nome
        `,
        args: [acessoAmplo ? 1 : 0, usuario.id, clienteId ?? null, clienteId ?? null],
    });

    const lojas = lojasResult.rows.map((row) => ({
        id: String(row.id),
        nome: String(row.nome),
        clienteId: String(row.cliente_id),
        clienteNome: String(row.nome_fantasia),
    }));

    const lojaSelecionada = lojaId
        ? lojas.find((loja) => loja.id === lojaId)
        : undefined;

    if (lojaId && !lojaSelecionada) redirect("/treinamentos");

    const podeGerenciar =
        acessoAmplo && await temPermissao(usuario.id, "treinamentos.gerenciar");

    return (
        <main className="min-h-screen bg-gray-50 p-6 sm:p-8">
            <div className="mx-auto max-w-5xl">
                <div className="mb-6">
                    {lojaSelecionada ? (
                        <Link
                            href={clienteId ? `/treinamentos?clienteId=${encodeURIComponent(clienteId)}` : "/treinamentos"}
                            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            ← Voltar para lojas
                        </Link>
                    ) : null}
                    <h1 className="mt-5 text-3xl font-bold text-[#12223f]">Treinamentos</h1>
                    <div className="mt-2 h-1 w-20 rounded-full bg-[#c22a2e]" />
                    <p className="mt-3 text-slate-600">
                        {lojaSelecionada
                            ? `${lojaSelecionada.nome} • ${lojaSelecionada.clienteNome}`
                            : "Selecione uma loja para consultar ou registrar treinamentos."}
                    </p>
                </div>

                {lojaSelecionada ? (
                    podeGerenciar ? (
                        <TreinamentosManager key={lojaSelecionada.id} lojaId={lojaSelecionada.id} />
                    ) : (
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <p className="text-sm text-slate-600">
                                Você possui acesso de consulta aos treinamentos desta loja.
                            </p>
                        </div>
                    )
                ) : lojas.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
                        Nenhuma loja disponível para seu usuário.
                    </div>
                ) : (
                    <section className="grid gap-4 sm:grid-cols-2">
                        {lojas.map((loja) => (
                            <Link
                                key={loja.id}
                                href={`/treinamentos?clienteId=${encodeURIComponent(loja.clienteId)}&lojaId=${encodeURIComponent(loja.id)}`}
                                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#22365b] hover:shadow-md"
                            >
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{loja.clienteNome}</p>
                                <h2 className="mt-2 text-lg font-semibold text-[#12223f]">{loja.nome}</h2>
                                <span className="mt-4 inline-flex text-sm font-semibold text-[#22365b]">Acessar treinamentos →</span>
                            </Link>
                        ))}
                    </section>
                )}
            </div>
        </main>
    );
}
