import type { DescritorSessaoExportacao } from "./sessao-exportacao";
import type { ManifestoImportacaoDesktop } from "./manifesto-importacao";
import { validarDescritorSessaoExportacao } from "./sessao-exportacao";

export type SessaoExportacaoAutorizada = {
    descritor: DescritorSessaoExportacao;
    usuarioId: string;
    perfilNaCriacao: "MASTER" | "SUPERVISORA";
};

/**
 * Registro de vínculo que deverá ser persistido exclusivamente pelo servidor.
 * Não constitui token de acesso nem substitui autenticação por requisição.
 */
export function vincularSessaoExportacao(
    descritor: DescritorSessaoExportacao,
    manifesto: ManifestoImportacaoDesktop,
    usuario: { id: string; perfil: string },
    agora = new Date()
): SessaoExportacaoAutorizada {
    if (!usuario || !/^[A-Za-z0-9_-]{1,128}$/.test(usuario.id) ||
        (usuario.perfil !== "MASTER" && usuario.perfil !== "SUPERVISORA") ||
        !validarDescritorSessaoExportacao(descritor, manifesto, agora)) {
        throw new Error("Sessão de exportação ou usuário não autorizado.");
    }
    return {
        descritor,
        usuarioId: usuario.id,
        perfilNaCriacao: usuario.perfil,
    };
}

/**
 * A identidade atual deve coincidir com o vínculo persistido.
 * A autorização efetiva também depende de consulta ao registro no servidor.
 */
export function autorizarSessaoExportacao(
    registro: SessaoExportacaoAutorizada,
    manifesto: ManifestoImportacaoDesktop,
    usuario: { id: string; perfil: string } | null,
    agora = new Date()
): boolean {
    if (!registro || !usuario ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(registro.usuarioId) ||
        (registro.perfilNaCriacao !== "MASTER" && registro.perfilNaCriacao !== "SUPERVISORA") ||
        registro.usuarioId !== usuario.id ||
        (usuario.perfil !== "MASTER" && usuario.perfil !== "SUPERVISORA")) return false;
    return validarDescritorSessaoExportacao(registro.descritor, manifesto, agora);
}
