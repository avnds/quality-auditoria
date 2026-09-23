import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { temPermissao } from "@/lib/auth/authorization";
import LogoutButton from "@/app/components/LogoutButton";
import GlobalMenuLinks from "@/app/components/GlobalMenuLinks";
import GlobalMenuMobile from "@/app/components/GlobalMenuMobile";

type ItemMenu = {
    nome: string;
    href: string;
    permissao?: string;
};

const itensMenu: ItemMenu[] = [
    {
        nome: "Início",
        href: "/",
    },
    {
        nome: "Clientes",
        href: "/clientes",
        permissao: "clientes.visualizar",
    },

    {
        nome: "Setores",
        href: "/setores",
        permissao: "setores.visualizar",
    },
    {
        nome: "Checklists",
        href: "/checklists",
        permissao: "checklists.visualizar",
    },
    {
        nome: "Certificados",
        href: "/certificados",
    },
    {
        nome: "Auditorias",
        href: "/auditorias",
        permissao: "auditorias.visualizar",
    },
    {
        nome: "Relatórios",
        href: "/relatorios",
        permissao: "relatorios.visualizar",
    },
    {
        nome: "Usuários",
        href: "/usuarios",
        permissao: "usuarios.visualizar",
    },
];

export default async function GlobalMenu() {
    const usuario = await getCurrentUser();

    if (!usuario) {
        return null;
    }

    const itensVisiveis: ItemMenu[] = [];

    for (const item of itensMenu) {
        if (!item.permissao) {
            itensVisiveis.push(item);
            continue;
        }

        const permitido = await temPermissao(
            usuario.id,
            item.permissao
        );

        if (permitido) {
            itensVisiveis.push(item);
        }
    }

    return (
        <header className="relative border-b border-slate-200 bg-white shadow-sm">
            <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
                <div className="flex min-w-0 items-center gap-8">
                    <Link
                        href="/"
                        className="shrink-0 text-lg font-bold tracking-tight text-[#22365b]"
                    >
                        Quality Consultoria
                    </Link>

                    <GlobalMenuLinks itens={itensVisiveis} />
                </div>

                <div className="flex shrink-0 items-center gap-4">
                    <GlobalMenuMobile itens={itensVisiveis} />

                    <div className="text-right">
                        <p className="text-sm font-semibold text-[#22365b]">
                            {usuario.nome}
                        </p>

                        <p className="text-xs font-medium text-slate-500">
                            {usuario.perfil}
                        </p>
                    </div>

                    <LogoutButton />
                </div>
            </div>
        </header>
    );
}