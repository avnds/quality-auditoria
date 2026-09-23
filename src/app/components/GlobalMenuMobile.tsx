"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

type ItemMenu = {
    nome: string;
    href: string;
};

type GlobalMenuMobileProps = {
    itens: ItemMenu[];
};

export default function GlobalMenuMobile({
    itens,
}: GlobalMenuMobileProps) {
    const [aberto, setAberto] = useState(false);
    const pathname = usePathname();

    return (
        <div className="lg:hidden">
            <button
                type="button"
                onClick={() => setAberto(!aberto)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-[#22365b] transition hover:bg-slate-100"
                aria-label={aberto ? "Fechar menu" : "Abrir menu"}
                aria-expanded={aberto}
            >
                <span className="text-xl">
                    {aberto ? "✕" : "☰"}
                </span>
            </button>

            {aberto && (
                <div className="absolute left-0 right-0 top-full z-50 border-t border-slate-200 bg-white shadow-lg">
                    <nav className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
                        <div className="flex flex-col gap-1">
                            {itens.map((item) => {
                                const ativo =
                                    item.href === "/"
                                        ? pathname === "/"
                                        : pathname === item.href ||
                                          pathname.startsWith(
                                              `${item.href}/`
                                          );

                                return (
                                    <Link
                                        key={
                                            item.href +
                                            item.nome
                                        }
                                        href={item.href}
                                        onClick={() =>
                                            setAberto(false)
                                        }
                                        className={
                                            ativo
                                                ? "rounded-lg bg-[#22365b] px-4 py-3 text-sm font-semibold text-white"
                                                : "rounded-lg px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-[#22365b]"
                                        }
                                    >
                                        {item.nome}
                                    </Link>
                                );
                            })}
                        </div>
                    </nav>
                </div>
            )}
        </div>
    );
}