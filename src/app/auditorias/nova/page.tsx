import { getCurrentUser } from "@/lib/auth/current-user";
import NovaAuditoriaForm from "./NovaAuditoriaForm";

export default async function NovaAuditoriaPage() {
    const usuario = await getCurrentUser();

    if (!usuario) {
        return (
            <main className="min-h-screen bg-gray-50 p-8">
                <div className="mx-auto max-w-5xl">
                    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
                        Usuário não autenticado.
                    </div>
                </div>
            </main>
        );
    }

    return (
        <NovaAuditoriaForm
            usuario={{
                id: usuario.id,
                nome: usuario.nome,
                perfil: usuario.perfil,
            }}
        />
    );
}