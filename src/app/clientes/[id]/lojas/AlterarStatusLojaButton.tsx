"use client";

import { useState } from "react";

type AlterarStatusLojaButtonProps = {
    lojaId: string;
    ativo: boolean;
};

export default function AlterarStatusLojaButton({
    lojaId,
    ativo,
}: AlterarStatusLojaButtonProps) {
    const [alterando, setAlterando] = useState(false);

    async function handleAlterarStatus() {
        const acao = ativo ? "inativar" : "ativar";

        const confirmar = window.confirm(
            `Tem certeza que deseja ${acao} esta loja?`
        );

        if (!confirmar) {
            return;
        }

        setAlterando(true);

        try {
            const response = await fetch(`/api/lojas/${lojaId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ativo: !ativo,
                }),
            });

            const dados = await response.json();

            if (!response.ok) {
                window.alert(
                    dados.message ??
                        `Não foi possível ${acao} a loja.`
                );
                return;
            }

            window.location.reload();
        } catch (error) {
            console.error(
                "Erro ao alterar status da loja:",
                error
            );

            window.alert(
                `Não foi possível ${acao} a loja.`
            );
        } finally {
            setAlterando(false);
        }
    }

    return (
        <button
            type="button"
            onClick={handleAlterarStatus}
            disabled={alterando}
            className={
                ativo
                    ? "inline-flex items-center justify-center whitespace-nowrap rounded-lg border bg-white px-3 py-2 text-xs font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 focus-visible:ring-red-300"
                    : "inline-flex items-center justify-center whitespace-nowrap rounded-lg border bg-white px-3 py-2 text-xs font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 border-green-200 text-green-700 hover:border-green-300 hover:bg-green-50 focus-visible:ring-green-300"
            }
        >
            {alterando
                ? "Alterando..."
                : ativo
                    ? "Inativar"
                    : "Ativar"}
        </button>
    );
}