"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NovoUsuarioForm from "./NovoUsuarioForm";

type NovoUsuarioButtonProps = {
    perfilAtual: string;
};

export default function NovoUsuarioButton({
    perfilAtual,
}: NovoUsuarioButtonProps) {
    const router = useRouter();
    const [aberto, setAberto] = useState(false);

    function handleCreated() {
        setAberto(false);
        router.refresh();
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setAberto(true)}
                className="w-full rounded-lg bg-[#12223f] px-5 py-3 font-semibold text-white transition hover:opacity-90 sm:w-auto"
            >
                + Novo usuário
            </button>

            {aberto && (
                <NovoUsuarioForm
                    perfilAtual={perfilAtual}
                    onClose={() => setAberto(false)}
                    onCreated={handleCreated}
                />
            )}
        </>
    );
}