import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { temPermissao } from "@/lib/auth/authorization";
import NovaVersaoButton from "./NovaVersaoButton";

type VersoesPageProps = {
    params: Promise<{
        id: string;
    }>;
};

export default async function VersoesPage({
    params,
}: VersoesPageProps) {
    const usuario = await getCurrentUser();

    if (!usuario) {
        redirect("/login");
    }

    const podeVisualizar = await temPermissao(
        usuario.id,
        "checklists.visualizar"
    );

    if (!podeVisualizar) {
        redirect("/");
    }

    const { id } = await params;

    const checklistResult = await db.execute({
        sql: `
            SELECT
                c.id,
                c.nome,
                c.descricao,
                c.ativo,
                s.nome AS setor_nome
            FROM checklists c
            INNER JOIN setores s ON s.id = c.setor_id
            WHERE c.id = ?
            LIMIT 1
        `,
        args: [id],
    });

    if (checklistResult.rows.length === 0) {
        notFound();
    }

    const checklist = checklistResult.rows[0];

    const versoesResult = await db.execute({
        sql: `
            SELECT
                id,
                numero,
                descricao,
                publicada,
                criada_em
            FROM checklist_versoes
            WHERE checklist_id = ?
            ORDER BY numero DESC
        `,
        args: [id],
    });

    const versoes = versoesResult.rows.map((row) => ({
        id: String(row.id),
        numero: Number(row.numero),
        descricao:
            row.descricao === null || row.descricao === undefined
                ? null
                : String(row.descricao),
        publicada: Number(row.publicada) === 1,
        criadaEm: String(row.criada_em),
    }));

    const podeGerenciar =
        usuario.perfil === "MASTER" ||
        usuario.perfil === "SUPERVISORA";

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
                <div className="mb-6">
                    <Link
                        href="/checklists"
                        className="text-sm font-medium text-[#22365b] hover:underline"
                    >
                        ← Voltar para Checklists
                    </Link>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-[#12223f]">
                                    {String(checklist.nome)}
                                </h1>

                                {Number(checklist.ativo) === 1 ? (
                                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                                        Ativo
                                    </span>
                                ) : (
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                                        Inativo
                                    </span>
                                )}
                            </div>

                            <div className="mt-2">
                                <span className="inline-flex rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-[#22365b]">
                                    {String(checklist.setor_nome)}
                                </span>
                            </div>

                            {checklist.descricao && (
                                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
                                    {String(checklist.descricao)}
                                </p>
                            )}
                        </div>

                        {podeGerenciar && (
                            <NovaVersaoButton checklistId={id} />
                        )}
                    </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                        <h2 className="text-sm font-semibold text-slate-700">
                            Versões do Checklist
                        </h2>
                    </div>

                    {versoes.length === 0 ? (
                        <div className="px-6 py-12 text-center">
                            <p className="text-sm font-medium text-slate-600">
                                Nenhuma versão cadastrada.
                            </p>

                            <p className="mt-1 text-sm text-slate-400">
                                Crie a primeira versão deste checklist.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {versoes.map((versao) => (
                                <div
                                    key={versao.id}
                                    className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="font-semibold text-slate-800">
                                                Versão {versao.numero}
                                            </h3>

                                            {versao.publicada && (
                                                <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                                                    Publicada
                                                </span>
                                            )}
                                        </div>

                                        <p className="mt-1 text-sm text-slate-600">
                                            {versao.descricao ||
                                                "Sem descrição cadastrada."}
                                        </p>

                                        <p className="mt-2 text-xs text-slate-400">
                                            Criada em {versao.criadaEm}
                                        </p>


                                    </div>

                                    <Link
                                        href={`/checklists/${id}/versoes/${versao.id}/secoes`}
                                        className="rounded-lg border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-[#22365b] transition hover:bg-slate-50"
                                    >
                                        Seções
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}