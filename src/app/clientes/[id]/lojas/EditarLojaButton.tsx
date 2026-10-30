"use client";

import { useState } from "react";
import EditarLojaForm from "./EditarLojaForm";

type EditarLojaButtonProps = {
    lojaId: string;
};

export default function EditarLojaButton({
    lojaId,
}: EditarLojaButtonProps) {
    const [aberto, setAberto] = useState(false);

    function handleUpdated() {
        setAberto(false);
        window.location.reload();
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setAberto(true)}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-[#22365b]/20 bg-white px-3 py-2 text-xs font-semibold text-[#22365b] shadow-sm transition-colors hover:border-[#22365b] hover:bg-[#22365b]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22365b]/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
                Editar
            </button>

            {aberto && (
                <EditarLojaForm
                    lojaId={lojaId}
                    onClose={() => setAberto(false)}
                    onUpdated={handleUpdated}
                />
            )}
        </>
    );
}