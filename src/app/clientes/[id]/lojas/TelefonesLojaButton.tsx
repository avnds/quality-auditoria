"use client";

import { useState } from "react";
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

    return (
        <>
            <button
                type="button"
                onClick={() => setAberto(true)}
                className="text-sm font-semibold text-[#12223f] hover:underline"
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
                        />
                    </div>
                </div>
            )}
        </>
    );
}