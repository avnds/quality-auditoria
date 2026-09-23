import { redirect } from "next/navigation";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import SetoresTable from "./SetoresTable";

export default async function SetoresPage() {
    const usuario = await getCurrentUser();

    if (!usuario) {
        redirect("/login");
    }

    if (
        usuario.perfil !== "MASTER" &&
        usuario.perfil !== "SUPERVISORA" &&
        usuario.perfil !== "CONSULTOR"
    ) {
        redirect("/");
    }

    const result = await db.execute({
        sql: `
            SELECT
                id,
                nome,
                descricao,
                ativo
            FROM setores
            ORDER BY nome
        `,
        args: [],
    });

    const setores = result.rows.map((setor) => ({
        id: String(setor.id),
        nome: String(setor.nome),
        descricao:
            setor.descricao !== null
                ? String(setor.descricao)
                : null,
        ativo: Number(setor.ativo) === 1,
    }));

    const podeGerenciar =
        usuario.perfil === "MASTER" ||
        usuario.perfil === "SUPERVISORA";

    return (
        <main className="min-h-screen bg-slate-50">
            <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[#12223f]">
                        Gerenciar Setores
                    </h1>

                    <div className="mt-3 h-1 w-24 rounded-full bg-[#c22a2e]" />

                    <p className="mt-4 text-sm text-slate-600">
                        Cadastre, edite e gerencie os setores utilizados
                        nas lojas.
                    </p>
                </div>

                <SetoresTable
                    setores={setores}
                    podeGerenciar={podeGerenciar}
                />
            </div>
        </main>
    );
}