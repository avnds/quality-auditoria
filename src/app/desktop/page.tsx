import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { identificarAmbienteBanco } from "@/lib/db/identificar-ambiente";

export const dynamic = "force-dynamic";

export default async function DesktopPage() {
    const usuario = await getCurrentUser();
    if (!usuario) redirect("/login");
    if (usuario.perfil !== "MASTER" && usuario.perfil !== "SUPERVISORA") redirect("/");
    const ambiente = identificarAmbienteBanco();
    if (ambiente === "production_offline") redirect("/");
    return (
        <main className="mx-auto max-w-3xl px-6 py-12 text-[#22365b]">
            <Link href="/" className="text-sm underline">Voltar ao Quality</Link>
            <h1 className="mt-8 text-3xl font-bold">Quality Desktop</h1>
            <p className="mt-3 text-slate-600">
                Instale o Quality no Windows e importe os dados do ambiente conectado.
                A importação inclui usuários e permissões, permitindo login offline.
            </p>
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="font-semibold">Ambiente de origem: {ambiente === "development" ? "Desenvolvimento (DEV)" : "Produção"}</p>
                <p className="mt-2 text-sm text-slate-600">
                    A exportação exige sua sessão autenticada e não modifica o banco de origem.
                    O aplicativo Windows só será disponibilizado aqui após a geração e validação do instalador.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                    <a href="/api/desktop/exportacao/disponibilidade"
                        className="rounded-lg bg-[#22365b] px-5 py-3 font-semibold text-white">
                        Verificar disponibilidade
                    </a>
                    <span aria-disabled="true" className="cursor-not-allowed rounded-lg bg-slate-200 px-5 py-3 font-semibold text-slate-500">
                        Instalar Quality Desktop — aguardando instalador
                    </span>
                </div>
            </div>
        </main>
    );
}
