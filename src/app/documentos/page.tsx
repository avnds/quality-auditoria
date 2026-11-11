import Link from "next/link";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { temPermissao } from "@/lib/auth/authorization";
import DocumentosLoja from "./DocumentosLoja";

type PageProps = { searchParams: Promise<{ lojaId?: string }> };

export default async function DocumentosPage({ searchParams }: PageProps) {
    const usuario = await getCurrentUser();
    if (!usuario) redirect("/login");
    if (!(await temPermissao(usuario.id, "documentos.visualizar"))) {
        return (
            <main className="min-h-screen bg-slate-50 p-6">
                <div className="mx-auto max-w-5xl rounded-xl bg-white p-8 text-red-700">
                    Você não possui permissão para visualizar documentos.
                </div>
            </main>
        );
    }

    const amplo = usuario.perfil === "MASTER" || usuario.perfil === "SUPERVISORA";
    const consulta = await db.execute({
        sql: `SELECT l.id, l.nome, c.nome_fantasia AS cliente_nome
              FROM lojas l
              JOIN clientes c ON c.id = l.cliente_id
              WHERE l.ativo = 1 AND (? = 1 OR EXISTS (
                  SELECT 1 FROM usuario_lojas ul
                  WHERE ul.loja_id = l.id AND ul.usuario_id = ?
              ))
              ORDER BY c.nome_fantasia COLLATE NOCASE, l.nome COLLATE NOCASE`,
        args: [amplo ? 1 : 0, usuario.id],
    });
    const lojas = consulta.rows.map((linha) => ({
        id: String(linha.id),
        nome: String(linha.nome),
        cliente: String(linha.cliente_nome),
    }));
    const { lojaId } = await searchParams;
    const selecionada = lojas.find((loja) => loja.id === lojaId);
    if (lojaId && !selecionada) redirect("/documentos");

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
            <div className="mx-auto max-w-6xl">
                <header className="mb-8">
                    {selecionada && (
                        <Link href="/documentos" className="text-sm font-semibold text-[#22365b] hover:underline">
                            ← Voltar para lojas
                        </Link>
                    )}
                    <h1 className="mt-3 text-3xl font-bold text-[#12223f]">Documentação</h1>
                    <div className="mt-2 h-1 w-20 rounded bg-[#c22a2e]" />
                    <p className="mt-3 text-slate-600">
                        {selecionada
                            ? `${selecionada.cliente} • ${selecionada.nome}`
                            : "Selecione uma loja para acompanhar a situação dos documentos."}
                    </p>
                </header>

                {selecionada ? (
                    <DocumentosLoja key={selecionada.id} lojaId={selecionada.id} />
                ) : lojas.length === 0 ? (
                    <div className="rounded-xl border bg-white p-8 text-slate-600">
                        Nenhuma loja disponível para seu usuário.
                    </div>
                ) : (
                    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {lojas.map((loja) => (
                            <Link
                                key={loja.id}
                                href={`/documentos?lojaId=${encodeURIComponent(loja.id)}`}
                                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#22365b] hover:shadow-md"
                            >
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {loja.cliente}
                                </p>
                                <h2 className="mt-2 text-lg font-semibold text-[#12223f]">{loja.nome}</h2>
                                <p className="mt-4 text-sm font-semibold text-[#22365b]">Consultar documentos →</p>
                            </Link>
                        ))}
                    </section>
                )}
            </div>
        </main>
    );
}
