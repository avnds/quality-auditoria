"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type ItemMenu = {
    nome: string;
    href: string;
};

type GlobalMenuLinksProps = {
    itens: ItemMenu[];
};

export default function GlobalMenuLinks({
    itens,
}: GlobalMenuLinksProps) {
    const pathname = usePathname();

    return (
        <nav className="hidden items-center gap-1 lg:flex">
            {itens.map((item) => {
                const ativo =
                    item.href === "/"
                        ? pathname === "/"
                        : pathname === item.href ||
                          pathname.startsWith(`${item.href}/`);

                return (
                    <Link
                        key={item.href + item.nome}
                        href={item.href}
                        className={
                            ativo
                                ? "rounded-lg bg-[#22365b] px-3 py-2 text-sm font-semibold text-white transition"
                                : "rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-[#22365b]"
                        }
                    >
                        {item.nome}
                    </Link>
                );
            })}
        </nav>
    );
}