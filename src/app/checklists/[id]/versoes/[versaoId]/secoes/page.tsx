import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { temPermissao } from "@/lib/auth/authorization";
import NovaSecaoButton from "./NovaSecaoButton";

type SecoesPageProps = {
    params: Promise<{
        id: string;
        versaoId: string;
    }>;
};

export default async function SecoesPage({
    params,
}: SecoesPageProps) {
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

    const { id, versaoId } = await params;

    const versaoResult = await db.execute({
        sql: `
            SELECT
                cv.id,
                cv.checklist_id,
                cv.numero,
                cv.descricao,
                cv.publicada,
                c.nome AS checklist_nome,
                c.descricao AS checklist_descricao,
                c.ativo AS checklist_ativo
            FROM checklist_versoes cv
            INNER JOIN checklists c
                ON c.id = cv.checklist_id
            WHERE cv.id = ?
              AND cv.checklist_id = ?
            LIMIT 1
        `,
        args: [versaoId, id],
    });

    if (versaoResult.rows.length === 0) {
        notFound();
    }

    const versao = versaoResult.rows[0];

    const secoesResult = await db.execute({
        sql: `
            SELECT
                id,
                nome,
                descricao,
                ordem
            FROM checklist_secoes
            WHERE checklist_versao_id = ?
            ORDER BY ordem ASC
        `,
        args: [versaoId],
    });

    const secoes = secoesResult.rows.map((row) => ({
        id: String(row.id),
        nome: String(row.nome),
        descricao:
            row.descricao === null ||
                row.descricao === undefined
                ? null
                : String(row.descricao),
        ordem: Number(row.ordem),
    }));

    const catalogoSecoesResult = await db.execute({
        sql: `
        SELECT
            id,
            nome
        FROM catalogo_secoes
        ORDER BY nome ASC
    `,
    });

    const catalogoSecoes = catalogoSecoesResult.rows.map((row) => ({
        id: String(row.id),
        nome: String(row.nome),
    }));

    const podeGerenciar =
        usuario.perfil === "MASTER" ||
        usuario.perfil === "SUPERVISORA";

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
                <div className="mb-6 flex flex-col gap-2">
                    <Link
                        href={`/checklists/${id}/versoes`}
                        className="text-sm font-medium text-[#22365b] hover:underline"
                    >
                        ← Voltar para Versões
                    </Link>

                    <Link
                        href="/checklists"
                        className="text-xs font-medium text-slate-500 hover:text-[#22365b] hover:underline"
                    >
                        Voltar para Checklists
                    </Link>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">
                                {String(versao.checklist_nome)}
                            </p>

                            <div className="mt-1 flex flex-wrap items-center gap-3">
                                <h1 className="text-2xl font-bold text-[#12223f]">
                                    Versão {Number(versao.numero)}
                                </h1>

                                {Number(versao.publicada) === 1 && (
                                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                                        Publicada
                                    </span>
                                )}

                                {Number(versao.checklist_ativo) === 1 ? (
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[#22365b]">
                                        Checklist ativo
                                    </span>
                                ) : (
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                                        Checklist inativo
                                    </span>
                                )}
                            </div>

                            {versao.descricao && (
                                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
                                    {String(versao.descricao)}
                                </p>
                            )}
                        </div>

                        {podeGerenciar &&
                            Number(versao.checklist_ativo) === 1 && (
                                <NovaSecaoButton
                                    checklistId={id}
                                    versaoId={versaoId}
                                    catalogoSecoes={catalogoSecoes}
                                />
                            )}
                    </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                        <h2 className="text-sm font-semibold text-slate-700">
                            Seções da Versão
                        </h2>
                    </div>

                    {secoes.length === 0 ? (
                        <div className="px-6 py-12 text-center">
                            <p className="text-sm font-medium text-slate-600">
                                Nenhuma seção cadastrada.
                            </p>

                            <p className="mt-1 text-sm text-slate-400">
                                Crie a primeira seção desta versão.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {secoes.map((secao) => (
                                <div
                                    key={secao.id}
                                    className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="flex gap-4">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#22365b] text-sm font-bold text-white">
                                            {secao.ordem}
                                        </div>

                                        <div>
                                            <h3 className="font-semibold text-slate-800">
                                                {secao.nome}
                                            </h3>

                                            <p className="mt-1 text-sm text-slate-600">
                                                {secao.descricao ||
                                                    "Sem descrição cadastrada."}
                                            </p>
                                        </div>
                                    </div>

                                    <Link
                                        href={`/checklists/${id}/versoes/${versaoId}/secoes/${secao.id}/itens`}
                                        className="rounded-lg border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-[#22365b] transition hover:bg-slate-50"
                                    >
                                        Itens
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