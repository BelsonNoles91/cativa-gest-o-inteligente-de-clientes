/**
 * Busca páginas PostgREST por intervalo inclusivo sem perder a última página.
 * Uma página curta sinaliza o fim; se o total for múltiplo exato do limite,
 * é feita uma consulta vazia adicional para confirmar o término.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: readonly T[] | null; error: unknown | null }>,
  pageSize = 500,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new RangeError("pageSize precisa ser um inteiro positivo");
  }

  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
