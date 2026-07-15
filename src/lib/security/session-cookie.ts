/**
 * Nome do cookie de sessão. Mantido em módulo isolado, sem nenhuma
 * dependência do Firebase Admin SDK, para que possa ser importado com
 * segurança tanto pelo middleware (Edge Runtime) quanto pelo servidor
 * (Node.js runtime) sem arrastar código incompatível com o Edge.
 */
export const SESSION_COOKIE_NAME = "__session";
