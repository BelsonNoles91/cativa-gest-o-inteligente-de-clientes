import { describe, expect, it, vi } from "vitest";
import { fetchAllPages } from "@/lib/fetch-all-pages";

describe("fetchAllPages", () => {
  it("lê todas as páginas em intervalos inclusivos e estáveis", async () => {
    const rows = ["a", "b", "c", "d", "e", "f", "g"];
    const calls: Array<[number, number]> = [];
    const result = await fetchAllPages(async (from, to) => {
      calls.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    }, 3);

    expect(result).toEqual(rows);
    expect(calls).toEqual([[0, 2], [3, 5], [6, 8]]);
  });

  it("confirma conjuntos múltiplos exatos com uma página final vazia", async () => {
    const rows = [1, 2, 3, 4, 5, 6];
    const calls: Array<[number, number]> = [];
    const result = await fetchAllPages(async (from, to) => {
      calls.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    }, 3);

    expect(result).toEqual(rows);
    expect(calls).toEqual([[0, 2], [3, 5], [6, 8]]);
  });

  it("não trunca um conjunto maior que cinco limites de página", async () => {
    const rows = Array.from({ length: 2_503 }, (_, index) => index);
    const calls: Array<[number, number]> = [];
    const result = await fetchAllPages(async (from, to) => {
      calls.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    }, 500);

    expect(result).toEqual(rows);
    expect(calls).toEqual([[0, 499], [500, 999], [1000, 1499], [1500, 1999], [2000, 2499], [2500, 2999]]);
  });

  it("propaga o erro da página sem pedir páginas seguintes", async () => {
    const failure = new Error("falha de rede");
    const fetchPage = vi.fn(async () => ({ data: null, error: failure }));
    await expect(fetchAllPages(fetchPage, 10)).rejects.toBe(failure);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("rejeita limites de página inválidos antes de consultar", async () => {
    const fetchPage = vi.fn();
    await expect(fetchAllPages(fetchPage, 0)).rejects.toThrow(RangeError);
    expect(fetchPage).not.toHaveBeenCalled();
  });
});
