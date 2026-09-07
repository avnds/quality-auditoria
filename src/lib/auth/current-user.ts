import { cookies } from "next/headers";
import { getSessionByToken } from "@/lib/auth/session";

export async function getCurrentUser() {
    const cookieStore = await cookies();

    const token = cookieStore.get("quality_session")?.value;

    if (!token) {
        return null;
    }

    const session = await getSessionByToken(token);

    if (!session) {
        return null;
    }

    return {
        id: String(session.usuario_id),
        nome: String(session.nome),
        email: String(session.email),
        perfil: String(session.perfil),
    };
}