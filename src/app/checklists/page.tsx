import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import db from "@/lib/db";
import ChecklistsTable from "./ChecklistsTable";
import NovoChecklistButton from "./NovoChecklistButton";

export default async function ChecklistsPage() {
    const usuario = await getCurrentUser();

    if (!usuario) {
        redirect("/login");
    }

    const podeVisualizar =
        usuario.perfil === "MASTER" ||
        usuario.perfil === "SUPERVISORA";

    if (!podeVisualizar) {
        redirect("/");
    }

    const result = await db.execute({
        sql: `
            SELECT
                c.id,
                c.nome,
                c.descricao,
                c.ativo,
                c.setor_id,
                s.nome AS setor_nome
            FROM checklists c
            INNER JOIN setores s
                ON s.id = c.setor_id
            ORDER BY
                s.nome,
                c.nome
        `,
        args: [],
    });

    const checklists = result.rows.map((row) => ({
        id: String(row.id),
        nome: String(row.nome),
        descricao:
            row.descricao === null || row.descricao === undefined
                ? null
                : String(row.descricao),
        ativo: Number(row.ativo) === 1,
        setorId: String(row.setor_id),
        setorNome: String(row.setor_nome),
    }));

    const setoresResult = await db.execute({
        sql: `
            SELECT
                id,
                nome
            FROM setores
            WHERE ativo = 1
            ORDER BY nome
        `,
        args: [],
    });

    const setores = setoresResult.rows.map((row) => ({
        id: String(row.id),
        nome: String(row.nome),
    }));

    return (
        <main className="min-h-screen bg-slate-50">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <div className="mb-6">
                    <a
                        href="/"
                        className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                        ← Voltar para o início
                    </a>
                </div>

                <div className="mb-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-[#12223f] sm:text-3xl">
                                Gerenciar Checklists
                            </h1>

                            <div className="mt-2 h-1 w-16 rounded-full bg-[#c22a2e]" />

                            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                                Cadastre e gerencie os checklists utilizados nas
                                auditorias, organizados por setor.
                            </p>
                        </div>

                        <div className="shrink-0">
                            <NovoChecklistButton setores={setores} />
                        </div>
                    </div>

                    
                </div>

                <ChecklistsTable
                    checklistsIniciais={checklists}
                    setores={setores}
                    podeGerenciar={
                        usuario.perfil === "MASTER" ||
                        usuario.perfil === "SUPERVISORA"
                    }
                />
            </div>
        </main>
    );
}