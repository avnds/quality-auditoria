import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionByToken } from "@/lib/auth/session";
import db from "@/lib/db";
import UsuariosTable from "./components/UsuariosTable";
import NovoUsuarioButton from "./components/NovoUsuarioButton";

type Usuario = {
    id: string;
    nome: string;
    email: string;
    perfil: string;
    ativo: number;
};

export default async function UsuariosPage() {
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

    if (perfil !== "MASTER" && perfil !== "SUPERVISORA") {
        return (
            <main className="min-h-screen bg-gray-50 p-8">
                <div className="mx-auto max-w-7xl">
                    <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
                        <h1 className="text-xl font-semibold text-[#c22a2e]">
                            Acesso não permitido
                        </h1>

                        <p className="mt-2 text-gray-600">
                            Você não possui permissão para visualizar os usuários.
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    const sql =
        perfil === "MASTER"
            ? `
                SELECT
                    id,
                    nome,
                    email,
                    perfil,
                    ativo
                FROM usuarios
                ORDER BY nome
            `
            : `
                SELECT
                    id,
                    nome,
                    email,
                    perfil,
                    ativo
                FROM usuarios
                WHERE perfil = 'CONSULTOR'
                ORDER BY nome
            `;

    const resultado = await db.execute(sql);

    const usuarios: Usuario[] = resultado.rows.map((usuario) => ({
        id: String(usuario.id),
        nome: String(usuario.nome),
        email: String(usuario.email),
        perfil: String(usuario.perfil),
        ativo: Number(usuario.ativo),
    }));

    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <div className="mx-auto max-w-7xl">
                <div className="mb-8">
                    <a
                        href="/"
                        className="mb-4 inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                        ← Voltar para inicial
                    </a>

                    <h1 className="text-3xl font-bold text-[#12223f] font-['Montserrat']">
                        Usuários
                    </h1>

                    <div className="mt-2 h-1 w-20 rounded-full bg-[#c22a2e]" />

                    <p className="mt-3 text-gray-600">
                        Gerencie os usuários e seus respectivos acessos ao sistema.
                    </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-[#12223f]">
                                Usuários cadastrados
                            </h2>

                            <p className="mt-1 text-sm text-gray-500">
                                Consulte e gerencie os usuários do sistema.
                            </p>
                        </div>

                        <NovoUsuarioButton perfilAtual={perfil} />
                    </div>

                    <div className="mt-8">
                        <UsuariosTable usuarios={usuarios} />
                    </div>
                </div>
            </div>
        </main>
    );
}