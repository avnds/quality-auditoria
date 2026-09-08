"use client";

import { useState } from "react";
import NovaLojaForm from "./NovaLojaForm";

type NovaLojaButtonProps = {
    clienteId: string;
};

export default function NovaLojaButton({
    clienteId,
}: NovaLojaButtonProps) {
    const [aberto, setAberto] = useState(false);

    function handleCreated() {
        setAberto(false);
        window.location.reload();
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setAberto(true)}
                className="w-full rounded-lg bg-[#12223f] px-5 py-3 font-semibold text-white transition hover:opacity-90 sm:w-auto"
            >
                + Nova loja
            </button>

            {aberto && (
                <NovaLojaForm
                    clienteId={clienteId}
                    onClose={() => setAberto(false)}
                    onCreated={handleCreated}
                />
            )}
        </>
    );
}