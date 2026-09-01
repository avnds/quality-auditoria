import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

export async function POST(request: Request) {
    try {
        const cookieHeader = request.headers.get("cookie");

        const token = cookieHeader
            ?.split(";")
            .map((cookie) => cookie.trim())
            .find((cookie) => cookie.startsWith("quality_session="))
            ?.split("=")
            .slice(1)
            .join("=");

        if (token) {
            await destroySession(token);
        }

        const response = NextResponse.json({
            success: true,
            message: "Logout realizado com sucesso.",
        });

        response.cookies.set("quality_session", "", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 0,
        });

        return response;
    } catch (error) {
        console.error("Erro no logout:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível realizar o logout.",
            },
            { status: 500 }
        );
    }
}