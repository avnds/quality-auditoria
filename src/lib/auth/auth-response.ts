import { NextResponse } from "next/server";

export function unauthorizedResponse() {
    return NextResponse.json(
        {
            success: false,
            message: "Usuário não autenticado.",
        },
        { status: 401 }
    );
}

export function forbiddenResponse() {
    return NextResponse.json(
        {
            success: false,
            message: "Você não possui permissão para realizar esta ação.",
        },
        { status: 403 }
    );
}