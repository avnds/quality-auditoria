import { getCurrentUser } from "@/lib/auth/current-user";
import { temPermissao } from "@/lib/auth/authorization";

export async function requirePermission(permissao: string) {
    const usuario = await getCurrentUser();

    if (!usuario) {
        return {
            autorizado: false as const,
            motivo: "NAO_AUTENTICADO" as const,
        };
    }

    const permitido = await temPermissao(usuario.id, permissao);

    if (!permitido) {
        return {
            autorizado: false as const,
            motivo: "SEM_PERMISSAO" as const,
            usuario,
        };
    }

    return {
        autorizado: true as const,
        usuario,
    };
}