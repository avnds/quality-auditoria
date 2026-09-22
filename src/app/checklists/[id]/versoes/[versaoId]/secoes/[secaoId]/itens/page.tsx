
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { temPermissao } from "@/lib/auth/authorization";
import NovoItemButton from "./NovoItemButton";
import EditarItemButton from "./EditarItemButton";

type ItensPageProps = {
    params: Promise<{
        id: string;
        versaoId: string;
        secaoId: string;
    }>;
};

export default async function ItensPage({
    params,
}: ItensPageProps) {
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

    const { id, versaoId, secaoId } = await params;

    const secaoResult = await db.execute({
        sql: `
            SELECT
                cs.id,
                cs.nome AS secao_nome,
                cs.descricao AS secao_descricao,
                cs.ordem AS secao_ordem,
                cv.id AS versao_id,
                cv.numero AS versao_numero,
                cv.publicada,
                c.id AS checklist_id,
                c.nome AS checklist_nome,
                c.ativo AS checklist_ativo
            FROM checklist_secoes cs
            INNER JOIN checklist_versoes cv
                ON cv.id = cs.checklist_versao_id
            INNER JOIN checklists c
                ON c.id = cv.checklist_id
            WHERE cs.id = ?
              AND cv.id = ?
              AND c.id = ?
            LIMIT 1
        `,
        args: [secaoId, versaoId, id],
    });

    if (secaoResult.rows.length === 0) {
        notFound();
    }

    const secao = secaoResult.rows[0];

    const itensResult = await db.execute({
        sql: `
            SELECT
                id,
                texto,
                orientacao,
                ordem,
                ativo
            FROM checklist_itens
            WHERE checklist_secao_id = ?
            ORDER BY ordem ASC
        `,
        args: [secaoId],
    });

    const itens = itensResult.rows.map((row) => ({
        id: String(row.id),
        texto: String(row.texto),
        orientacao:
            row.orientacao === null ||
            row.orientacao === undefined
                ? null
                : String(row.orientacao),
        ordem: Number(row.ordem),
        ativo: Number(row.ativo) === 1,
    }));

    const catalogoItensResult = await db.execute({
        sql: `
            SELECT
                id,
                texto
            FROM catalogo_itens
            ORDER BY texto ASC
        `,
    });

    const catalogoItens = catalogoItensResult.rows.map((row) => ({
        id: String(row.id),
        texto: String(row.texto),
    }));

    const podeGerenciar =
        usuario.perfil === "MASTER" ||
        usuario.perfil === "SUPERVISORA";

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
                <div className="mb-6 flex flex-col gap-2">
                    <Link
                        href={`/checklists/${id}/versoes/${versaoId}/secoes`}
                        className="text-sm font-medium text-[#22365b] hover:underline"
                    >
                        ← Voltar para Seções
                    </Link>

                    <Link
                        href={`/checklists/${id}/versoes`}
                        className="text-xs font-medium text-slate-500 hover:text-[#22365b] hover:underline"
                    >
                        Voltar para Versões
                    </Link>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">
                                {String(secao.checklist_nome)}
                            </p>

                            <div className="mt-1 flex flex-wrap items-center gap-3">
                                <h1 className="text-2xl font-bold text-[#12223f]">
                                    {String(secao.secao_nome)}
                                </h1>

                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[#22365b]">
                                    Versão {Number(secao.versao_numero)}
                                </span>

                                {Number(secao.publicada) === 1 && (
                                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                                        Publicada
                                    </span>
                                )}

                                {Number(secao.checklist_ativo) === 1 ? (
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[#22365b]">
                                        Checklist ativo
                                    </span>
                                ) : (
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                                        Checklist inativo
                                    </span>
                                )}
                            </div>

                            {secao.secao_descricao && (
                                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
                                    {String(secao.secao_descricao)}
                                </p>
                            )}
                        </div>

                        {podeGerenciar &&
                            Number(secao.checklist_ativo) === 1 && (
                                <NovoItemButton
                                    checklistId={id}
                                    versaoId={versaoId}
                                    secaoId={secaoId}
                                    catalogoItens={catalogoItens}
                                />
                            )}
                    </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                        <h2 className="text-sm font-semibold text-slate-700">
                            Itens da Seção
                        </h2>
                    </div>

                    {itens.length === 0 ? (
                        <div className="px-6 py-12 text-center">
                            <p className="text-sm font-medium text-slate-600">
                                Nenhum item cadastrado.
                            </p>

                            <p className="mt-1 text-sm text-slate-400">
                                Crie o primeiro item desta seção.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {itens.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-start sm:justify-between"
                                >
                                    <div className="flex min-w-0 flex-1 gap-4">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#22365b] text-sm font-bold text-white">
                                            {item.ordem}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="font-semibold text-slate-800">
                                                    {item.texto}
                                                </h3>

                                                {item.ativo ? (
                                                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                                                        Ativo
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                                                        Inativo
                                                    </span>
                                                )}
                                            </div>

                                            <p className="mt-1 text-sm text-slate-600">
                                                {item.orientacao ||
                                                    "Sem orientação cadastrada."}
                                            </p>
                                        </div>
                                    </div>

                                                                        {podeGerenciar && (
                                        <EditarItemButton
                                            checklistId={id}
                                            versaoId={versaoId}
                                            secaoId={secaoId}
                                            item={item}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}