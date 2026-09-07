import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionByToken } from "@/lib/auth/session";
import db from "@/lib/db";
import EditarUsuarioForm from "./components/EditarUsuarioForm";
import AlterarSenhaForm from "./components/AlterarSenhaForm";

type Usuario = {
    id: string;
    nome: string;
    email: string;
    perfil: string;
    ativo: number;
    criado_em: string;
    atualizado_em: string;
};

export default async function EditarUsuarioPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const cookieStore = await cookies();
    const token = cookieStore.get("quality_session")?.value;

    if (!token) {
        redirect("/login");
    }

    const session = await getSessionByToken(token);

    if (!session) {
        redirect("/login");
    }

    const perfilAtual = String(session.perfil);
    const { id } = await params;

    if (!id) {
        return (
            <main className="min-h-screen bg-gray-50 p-8">
                <div className="mx-auto max-w-3xl">
                    <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
                        <h1 className="text-xl font-semibold text-[#c22a2e]">
                            Usuário não encontrado
                        </h1>

                        <p className="mt-2 text-gray-600">
                            O usuário informado não existe.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    if (perfilAtual !== "MASTER" && perfilAtual !== "SUPERVISORA") {
        return (
            <main className="min-h-screen bg-gray-50 p-8">
                <div className="mx-auto max-w-3xl">
                    <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
                        <h1 className="text-xl font-semibold text-[#c22a2e]">
                            Acesso não permitido
                        </h1>

                        <p className="mt-2 text-gray-600">
                            Você não possui permissão para visualizar este usuário.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    const resultado = await db.execute({
        sql: `
            SELECT
                id,
                nome,
                email,
                perfil,
                ativo,
                criado_em,
                atualizado_em
            FROM usuarios
            WHERE id = ?
            LIMIT 1
        `,
        args: [id],
    });

    if (resultado.rows.length === 0) {
        return (
            <main className="min-h-screen bg-gray-50 p-8">
                <div className="mx-auto max-w-3xl">
                    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                        <h1 className="text-xl font-semibold text-[#12223f]">
                            Usuário não encontrado
                        </h1>

                        <p className="mt-2 text-gray-600">
                            O usuário informado não existe.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    const usuarioEncontrado = resultado.rows[0];

    if (
        perfilAtual === "SUPERVISORA" &&
        String(usuarioEncontrado.perfil) !== "CONSULTOR"
    ) {
        return (
            <main className="min-h-screen bg-gray-50 p-8">
                <div className="mx-auto max-w-3xl">
                    <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
                        <h1 className="text-xl font-semibold text-[#c22a2e]">
                            Acesso não permitido
                        </h1>

                        <p className="mt-2 text-gray-600">
                            Você não possui permissão para visualizar este usuário.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    const usuario: Usuario = {
        id: String(usuarioEncontrado.id),
        nome: String(usuarioEncontrado.nome),
        email: String(usuarioEncontrado.email),
        perfil: String(usuarioEncontrado.perfil),
        ativo: Number(usuarioEncontrado.ativo),
        criado_em: String(usuarioEncontrado.criado_em),
        atualizado_em: String(usuarioEncontrado.atualizado_em),
    };

    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <div className="mx-auto max-w-3xl">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[#12223f] font-['Montserrat']">
                        Editar usuário
                    </h1>

                    <div className="mt-2 h-1 w-20 rounded-full bg-[#c22a2e]" />

                    <p className="mt-3 text-gray-600">
                        Altere os dados e as configurações de acesso do usuário.
                    </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <EditarUsuarioForm usuario={usuario} />

                    <div className="mt-8 border-t border-gray-100 pt-6">
                        <h2 className="text-lg font-semibold text-[#12223f]">
                            Segurança
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                            Gerencie a senha de acesso deste usuário.
                        </p>

                        <AlterarSenhaForm usuarioId={usuario.id} />
                    </div>
                </div>

                <p className="mt-4 text-xs text-gray-400">
                    ID do usuário: {usuario.id}
                </p>
            </div>
        </main>
    );
}