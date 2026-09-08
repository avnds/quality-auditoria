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
                    ? "text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
                    : "text-sm font-semibold text-green-600 hover:underline disabled:opacity-50"
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