import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { temPermissao } from "@/lib/auth/authorization";
import db from "@/lib/db";

type Relatorio = {
    auditoria_id: string;
    auditoria_versao_id: string;
    versao_numero: number;
    status: string;
    auditoria_criada_em: string;
    versao_criada_em: string;
    loja_id: string;
    loja_nome: string;
    cliente_id: string;
    cliente_nome: string;
    auditor_id: string;
    auditor_nome: string;
    gerente_loja_nome: string | null;
};

function formatarData(valor: string | null | undefined) {
    if (!valor) return "—";

    const data = new Date(valor);

    if (Number.isNaN(data.getTime())) return valor;

    return data.toLocaleDateString("pt-BR", {
        timeZone: "America/Fortaleza",
    });
}

export default async function RelatoriosPage() {
    const usuario = await getCurrentUser();

    if (!usuario) {
        redirect("/login");
    }

    const permitido = await temPermissao(
        usuario.id,
        "relatorios.visualizar"
    );

    if (!permitido) {
        redirect("/auditorias");
    }

    const args: string[] = [];
    let filtroLoja = "";

    if (usuario.perfil === "CONSULTOR") {
        filtroLoja = " AND a.auditor_id = ?";
        args.push(usuario.id);
    } else if (
        usuario.perfil !== "MASTER" &&
        usuario.perfil !== "SUPERVISORA"
    ) {
        filtroLoja = `
            AND EXISTS (
                SELECT 1
                FROM usuario_lojas ul
                WHERE ul.loja_id = a.loja_id
                  AND ul.usuario_id = ?
            )
        `;

        args.push(usuario.id);
    }

    let relatorios: Relatorio[] = [];

    try {
        const result = await db.execute({
            sql: `
                SELECT
                    a.id AS auditoria_id,
                    av.id AS auditoria_versao_id,
                    av.numero AS versao_numero,
                    av.status AS status,
                    a.criada_em AS auditoria_criada_em,
                    av.criada_em AS versao_criada_em,
                    l.id AS loja_id,
                    l.nome AS loja_nome,
                    c.id AS cliente_id,
                    c.nome_fantasia AS cliente_nome,
                    u.id AS auditor_id,
                    u.nome AS auditor_nome,
                    a.gerente_loja_nome
                FROM auditorias a
                INNER JOIN auditoria_versoes av
                    ON av.auditoria_id = a.id
                INNER JOIN lojas l
                    ON l.id = a.loja_id
                INNER JOIN clientes c
                    ON c.id = l.cliente_id
                INNER JOIN usuarios u
                    ON u.id = a.auditor_id
                WHERE av.numero = (
                    SELECT MAX(av2.numero)
                    FROM auditoria_versoes av2
                    WHERE av2.auditoria_id = a.id
                )
                  AND av.status = 'FINALIZADA'
                  ${filtroLoja}
                ORDER BY av.criada_em DESC
            `,
            args,
        });

        relatorios = result.rows as unknown as Relatorio[];
    } catch (error) {
        console.error("Erro ao carregar relatórios:", error);
        throw new Error("Não foi possível carregar os relatórios.");
    }

    return (
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-[#12223f] sm:text-3xl">
                    Relatórios de auditoria
                </h1>

                <div className="mt-3 h-1 w-20 rounded bg-[#c22a2e]" />

                <p className="mt-4 text-sm text-gray-600">
                    Consulte as auditorias finalizadas e acesse a prévia
                    dos respectivos relatórios.
                </p>
            </div>

            <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-col gap-2 border-b border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <h2 className="font-semibold text-[#12223f]">
                        Auditorias finalizadas
                    </h2>

                    <span className="text-sm text-gray-500">
                        {relatorios.length}{" "}
                        {relatorios.length === 1
                            ? "auditoria encontrada"
                            : "auditorias encontradas"}
                    </span>
                </div>

                {relatorios.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                        <p className="font-medium text-gray-700">
                            Nenhuma auditoria finalizada encontrada.
                        </p>

                        <p className="mt-2 text-sm text-gray-500">
                            Os relatórios aparecerão aqui após a
                            finalização das auditorias.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {relatorios.map((relatorio) => (
                            <article
                                key={relatorio.auditoria_versao_id}
                                className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                            >
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-gray-900">
                                        {relatorio.cliente_nome}
                                    </h3>

                                    <p className="mt-1 text-sm text-gray-600">
                                        Loja: {relatorio.loja_nome}
                                    </p>

                                    <p className="mt-1 text-sm text-gray-600">
                                        Auditor: {relatorio.auditor_nome}
                                    </p>

                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                        <span>
                                            Auditoria:{" "}
                                            {formatarData(
                                                relatorio.auditoria_criada_em
                                            )}
                                        </span>

                                        <span>
                                            Versão {relatorio.versao_numero}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex shrink-0 items-center">
                                    <Link
                                        href={`/relatorios/${relatorio.auditoria_id}`}
                                        className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#22365b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#172846]"
                                    >
                                        Visualizar relatório
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}