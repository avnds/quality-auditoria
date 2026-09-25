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
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
            <div className="mx-auto flex min-h-20 max-w-7xl items-center gap-x-4 px-4 sm:gap-x-6 sm:px-6 lg:px-8">
                <div className="flex min-w-0 items-center gap-4 sm:gap-8">
                    <GlobalMenuMobile itens={itensVisiveis} />
                    <Link
                        href="/"
                        className="shrink-0"
                        aria-label="Quality Consultoria"
                    >
                        <img
                            src="/icone1.png"
                            alt="Quality Consultoria"
                            className="h-12 w-auto object-contain"
                        />
                    </Link>

                    <div className="hidden lg:block">
                        <GlobalMenuLinks itens={itensVisiveis} />
                    </div>
                </div>

                <div className="ml-auto flex min-w-0 items-center gap-3 sm:gap-6">
                    <div className="w-[100px] min-w-0 text-center sm:w-[160px] lg:w-[200px]">
                        <p className="break-words text-xs font-semibold leading-tight text-[#22365b] sm:text-sm">
                            {usuario.nome}
                        </p>

                        <p className="text-xs font-medium text-slate-500">
                            {usuario.perfil}
                        </p>
                    </div>

                    <div className="shrink-0 pt-0">
                        <LogoutButton />
                    </div>
                </div>
            </div>
        </header>
    );
}