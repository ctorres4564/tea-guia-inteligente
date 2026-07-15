import { clsx, type ClassValue } from "clsx";

/**
 * Combina classes condicionalmente. Wrapper fino sobre `clsx` para manter
 * um único ponto de importação em todo o projeto.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
