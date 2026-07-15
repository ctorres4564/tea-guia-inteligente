/**
 * Gera um slug em kebab-case a partir de um texto livre (título, nome de
 * categoria etc.), compatível com a validação de `slug` dos schemas Zod
 * (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
 */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (marcas diacríticas combinantes)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
