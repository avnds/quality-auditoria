import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import CatalogoSecoesClient from "./CatalogoSecoesClient";

export default async function CatalogoSecoesPage() {
    const usuario = await getCurrentUser();

    if (!usuario) {
        redirect("/login");
    }

    if (
        usuario.perfil !== "MASTER" &&
        usuario.perfil !== "SUPERVISORA"
    ) {
        redirect("/");
    }

    return (
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-[#12223f] sm:text-3xl">
                    Catálogo de Seções
                </h1>

                <div className="mt-3 h-1 w-20 rounded bg-[#c22a2e]" />

                <p className="mt-4 text-sm text-slate-600 sm:text-base">
                    Cadastre e organize as seções reutilizáveis dos checklists.
                </p>
            </div>

            <CatalogoSecoesClient />
        </main>
    );
}