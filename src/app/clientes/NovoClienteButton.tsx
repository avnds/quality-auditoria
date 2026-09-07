"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NovoClienteForm from "./NovoClienteForm";

export default function NovoClienteButton() {
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
                + Novo cliente
            </button>

            {aberto && (
                <NovoClienteForm
                    onClose={() => setAberto(false)}
                    onCreated={handleCreated}
                />
            )}
        </>
    );
}