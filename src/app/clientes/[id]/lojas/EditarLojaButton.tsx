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
                className="text-sm font-semibold text-[#12223f] hover:underline"
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