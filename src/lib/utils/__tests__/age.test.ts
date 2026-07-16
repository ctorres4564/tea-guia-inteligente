import { describe, expect, it } from "vitest";

import { calculateAge, formatAgeLabel } from "@/lib/utils/age";

describe("calculateAge", () => {
  it("calcula anos e meses corretamente quando o aniversário já passou no ano", () => {
    const result = calculateAge("2020-01-15", new Date("2024-06-20"));
    expect(result.years).toBe(4);
    expect(result.months).toBe(5);
    expect(result.totalMonths).toBe(53);
  });

  it("calcula corretamente quando o aniversário ainda não chegou no mês de referência", () => {
    const result = calculateAge("2020-06-25", new Date("2024-06-20"));
    expect(result.years).toBe(3);
    expect(result.months).toBe(11);
  });

  it("calcula idade em meses para bebês com menos de 1 ano", () => {
    const result = calculateAge("2024-01-01", new Date("2024-06-15"));
    expect(result.years).toBe(0);
    expect(result.months).toBe(5);
  });

  it("nunca retorna valores negativos", () => {
    const result = calculateAge("2024-06-20", new Date("2024-06-20"));
    expect(result.years).toBeGreaterThanOrEqual(0);
    expect(result.months).toBeGreaterThanOrEqual(0);
  });
});

describe("formatAgeLabel", () => {
  it("formata anos e meses", () => {
    expect(formatAgeLabel("2020-01-15", new Date("2024-06-20"))).toBe("4 anos e 5 meses");
  });

  it("formata apenas anos quando os meses são zero", () => {
    expect(formatAgeLabel("2020-06-20", new Date("2024-06-20"))).toBe("4 anos");
  });

  it("formata apenas 1 ano no singular", () => {
    expect(formatAgeLabel("2023-06-20", new Date("2024-06-20"))).toBe("1 ano");
  });

  it("formata em meses quando menor que 1 ano", () => {
    expect(formatAgeLabel("2024-01-20", new Date("2024-06-20"))).toBe("5 meses");
  });

  it("formata 1 mês no singular", () => {
    expect(formatAgeLabel("2024-05-20", new Date("2024-06-20"))).toBe("1 mês");
  });
});
