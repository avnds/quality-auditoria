import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionByToken } from "@/lib/auth/session";
import db from "@/lib/db";
import Link from "next/link";
import NovaLojaButton from "./NovaLojaButton";
import EditarLojaButton from "./EditarLojaButton";
import AlterarStatusLojaButton from "./AlterarStatusLojaButton";
import TelefonesLoja from "./TelefonesLoja";
import LojaCard from "./LojaCard";
import TelefonesLojaButton from "./TelefonesLojaButton";

type Loja = {
    id: string;
    nome: string;
    cnpj: string | null;
    cidade: string;
    estado: string;
    ativo: number;
    endereco: string;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cep: string | null;
};

type Cliente = {
    id: string;
    nome_fantasia: string;
};

type PageProps = {
    params: Promise<{
        id: string;
    }>;
};

export default async function LojasPage({
    params,
}: PageProps) {
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
    const { id } = await params;

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
                            Você não possui permissão para visualizar as lojas.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    let clienteResult;

    if (
        perfil === "MASTER" ||
        perfil === "SUPERVISORA"
    ) {
        clienteResult = await db.execute({
            sql: `
                SELECT
                    id,
                    nome_fantasia
                FROM clientes
                WHERE id = ?
                LIMIT 1
            `,
            args: [id],
        });
    } else {
        clienteResult = await db.execute({
            sql: `
                SELECT
                    c.id,
                    c.nome_fantasia
                FROM clientes c
                INNER JOIN usuario_clientes uc
                    ON uc.cliente_id = c.id
                WHERE c.id = ?
                  AND uc.usuario_id = ?
                LIMIT 1
            `,
            args: [id, String(session.usuario_id)],
        });
    }

    if (clienteResult.rows.length === 0) {
        redirect("/clientes");
    }

    const cliente: Cliente = {
        id: String(clienteResult.rows[0].id),
        nome_fantasia: String(
            clienteResult.rows[0].nome_fantasia
        ),
    };

    let lojasResult;

    if (
        perfil === "MASTER" ||
        perfil === "SUPERVISORA"
    ) {
        lojasResult = await db.execute({
            sql: `
                SELECT
                    id,
                    nome,
                    cnpj,
                    endereco,
                    numero,
                    complemento,
                    bairro,
                    cidade,
                    estado,
                    cep,
                    ativo
                FROM lojas
                WHERE cliente_id = ?
                ORDER BY nome
            `,
            args: [id],
        });
    } else {
        lojasResult = await db.execute({
            sql: `
                SELECT
                    l.id,
                    l.nome,
                    l.cnpj,
                    l.endereco,
                    l.numero,
                    l.complemento,
                    l.bairro,
                    l.cidade,
                    l.estado,
                    l.cep,
                    l.ativo
                FROM lojas l
                INNER JOIN usuario_lojas ul
                    ON ul.loja_id = l.id
                WHERE l.cliente_id = ?
                  AND ul.usuario_id = ?
                ORDER BY l.nome
            `,
            args: [id, String(session.usuario_id)],
        });
    }

    const lojas: Loja[] = lojasResult.rows.map((loja) => ({
        id: String(loja.id),
        nome: String(loja.nome),
        cnpj:
            loja.cnpj === null
                ? null
                : String(loja.cnpj),
        endereco: String(loja.endereco),
        numero:
            loja.numero === null
                ? null
                : String(loja.numero),
        complemento:
            loja.complemento === null
                ? null
                : String(loja.complemento),
        bairro:
            loja.bairro === null
                ? null
                : String(loja.bairro),
        cidade: String(loja.cidade),
        estado: String(loja.estado),
        cep:
            loja.cep === null
                ? null
                : String(loja.cep),
        ativo: Number(loja.ativo),
    }));

    const podeGerenciar =
        perfil === "MASTER" ||
        perfil === "SUPERVISORA";

    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <div className="mx-auto max-w-7xl">

                <div className="mb-8">
                    <Link
                        href="/clientes"
                        className="mb-4 inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                        ← Voltar para clientes
                    </Link>

                    <h1 className="text-3xl font-bold text-[#12223f] font-['Montserrat']">
                        Lojas
                    </h1>

                    <div className="mt-2 h-1 w-20 rounded-full bg-[#c22a2e]" />

                    <p className="mt-3 text-gray-600">
                        Estabelecimentos vinculados ao cliente{" "}
                        <span className="font-semibold text-[#12223f]">
                            {cliente.nome_fantasia}
                        </span>
                    </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-[#12223f]">
                                Lojas cadastradas
                            </h2>

                            <p className="mt-1 text-sm text-gray-500">
                                Consulte e gerencie os estabelecimentos deste cliente.
                            </p>
                        </div>

                        {podeGerenciar && (
                            <NovaLojaButton clienteId={cliente.id} />
                        )}
                    </div>

                    <div className="mt-8">

                        {lojas.length === 0 ? (
                            <div className="rounded-xl border border-gray-200 px-5 py-12 text-center">
                                <p className="font-medium text-gray-600">
                                    Nenhuma loja cadastrada.
                                </p>

                                {podeGerenciar && (
                                    <p className="mt-2 text-sm text-gray-500">
                                        Clique em “+ Nova loja” para cadastrar o primeiro estabelecimento.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Desktop */}
                                <div className="hidden overflow-hidden rounded-xl border border-gray-200 md:block">
                                    <table className="w-full table-fixed">
                                        <thead className="bg-gray-50">
                                            <tr className="text-left text-sm text-gray-600">
                                                <th className="w-[30%] px-5 py-4 font-semibold">
                                                    Loja
                                                </th>

                                                <th className="w-[22%] px-5 py-4 font-semibold">
                                                    CNPJ
                                                </th>

                                                <th className="w-[23%] px-5 py-4 font-semibold">
                                                    Cidade / UF
                                                </th>

                                                <th className="w-[15%] px-5 py-4 font-semibold">
                                                    Status
                                                </th>

                                                <th className="w-[10%] px-5 py-4 text-right font-semibold">
                                                    Ações
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {lojas.map((loja) => (
                                                <tr
                                                    key={loja.id}
                                                    className="border-t border-gray-100"
                                                >
                                                    <td className="px-5 py-4 text-sm font-medium text-gray-800">
                                                        {loja.nome}
                                                    </td>

                                                    <td className="px-5 py-4 text-sm text-gray-600">
                                                        {loja.cnpj || "Não informado"}
                                                    </td>

                                                    <td className="px-5 py-4 text-sm text-gray-600">
                                                        {loja.cidade} / {loja.estado}
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <span
                                                            className={
                                                                loja.ativo === 1
                                                                    ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                                                                    : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
                                                            }
                                                        >
                                                            {loja.ativo === 1
                                                                ? "Ativo"
                                                                : "Inativo"}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <div className="flex justify-end gap-2">
                                                            {podeGerenciar && (
                                                                <EditarLojaButton
                                                                    lojaId={loja.id}
                                                                />
                                                            )}

                                                            <TelefonesLojaButton
                                                                lojaId={loja.id}
                                                                podeGerenciar={podeGerenciar}
                                                            />

                                                            {podeGerenciar && (
                                                                <AlterarStatusLojaButton
                                                                    lojaId={loja.id}
                                                                    ativo={Boolean(loja.ativo)}
                                                                />
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile */}
                                <div className="space-y-3 md:hidden">
                                    {lojas.map((loja) => (
                                        <div
                                            key={loja.id}
                                            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                                        >
                                            <p className="font-semibold text-gray-800 break-words">
                                                {loja.nome}
                                            </p>

                                            <p className="mt-2 text-sm text-gray-500">
                                                CNPJ: {loja.cnpj || "Não informado"}
                                            </p>

                                            <p className="mt-1 text-sm text-gray-500">
                                                {loja.cidade} / {loja.estado}
                                            </p>

                                            <div className="mt-4">
                                                <span
                                                    className={
                                                        loja.ativo === 1
                                                            ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                                                            : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
                                                    }
                                                >
                                                    {loja.ativo === 1
                                                        ? "Ativo"
                                                        : "Inativo"}
                                                </span>
                                            </div>

                                            {podeGerenciar && (
                                                <div className="mt-4 border-t border-gray-100 pt-4 flex items-center gap-4">
                                                    <EditarLojaButton lojaId={loja.id} />

                                                    <TelefonesLojaButton
                                                        lojaId={loja.id}
                                                        podeGerenciar={podeGerenciar}
                                                    />

                                                    <AlterarStatusLojaButton
                                                        lojaId={loja.id}
                                                        ativo={Boolean(loja.ativo)}
                                                    />
                                                </div>
                                            )}
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