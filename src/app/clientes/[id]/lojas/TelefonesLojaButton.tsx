"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TelefonesLoja from "./TelefonesLoja";

type TelefonesLojaButtonProps = {
    lojaId: string;
    podeGerenciar: boolean;
};

export default function TelefonesLojaButton({
    lojaId,
    podeGerenciar,
}: TelefonesLojaButtonProps) {
    const [aberto, setAberto] = useState(false);

    const router = useRouter();

    function handleChanged() {
        setAberto(false);
        router.refresh();
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setAberto(true)}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-[#22365b]/20 bg-white px-3 py-2 text-xs font-semibold text-[#22365b] shadow-sm transition-colors hover:border-[#22365b] hover:bg-[#22365b]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22365b]/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
                Telefones
            </button>

            {aberto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-[#12223f]">
                                Telefones da loja
                            </h2>

                            <button
                                type="button"
                                onClick={() => setAberto(false)}
                                className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                            >
                                Fechar
                            </button>
                        </div>

                        <TelefonesLoja
                            lojaId={lojaId}
                            podeGerenciar={podeGerenciar}
                            onChanged={handleChanged}
                        />
                    </div>
                </div>
            )}
        </>
    );
}