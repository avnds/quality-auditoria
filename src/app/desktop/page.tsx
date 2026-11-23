import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { identificarAmbienteBanco } from "@/lib/db/identificar-ambiente";

export const dynamic = "force-dynamic";

export default async function DesktopPage() {
    const usuario = await getCurrentUser();
    if (!usuario) redirect("/login");
    if (usuario.perfil !== "MASTER" && usuario.perfil !== "SUPERVISORA") redirect("/");
    const ambiente = identificarAmbienteBanco();
    const cabecalhos = await headers();
    const host = cabecalhos.get("host") ?? "";
    // Somente a origem local, a produção conhecida ou o hostname exato
    // deste deploy Vercel podem iniciar o vínculo com o aplicativo.
    const hostPreview = process.env.VERCEL_URL ?? "";
    const origem = host === "localhost:3000" || host === "127.0.0.1:3000"
        ? `http://${host}`
        : host === "quality-auditoria.vercel.app" ||
          (hostPreview.endsWith(".vercel.app") && host === hostPreview)
            ? `https://${host}`
            : null;
    const vinculo = origem ? `qualitydesktop://setup?origin=${encodeURIComponent(origem)}` : null;
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
                    No DEV local, o botão baixa o instalador gerado neste computador. Em produção, o download depende da publicação do executável em armazenamento de distribuição.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                    <a href="/api/desktop/exportacao/disponibilidade"
                        className="rounded-lg bg-[#22365b] px-5 py-3 font-semibold text-white">
                        Verificar disponibilidade
                    </a>
                    {vinculo && <a href={vinculo} className="rounded-lg border border-[#22365b] px-5 py-3 font-semibold text-[#22365b]">Conectar aplicativo instalado</a>}
                    <a href="/api/desktop/instalador" className="rounded-lg bg-[#c22a2e] px-5 py-3 font-semibold text-white">Baixar instalador Windows (.exe)</a>
                </div>
            </div>
        </main>
    );
}
