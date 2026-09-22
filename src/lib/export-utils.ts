/**
 * export-utils — Utilitários para exportação de dados em formatos amigáveis (CSV, etc).
 * Foco em relatórios gerenciais para fechamento de mês.
 */

/**
 * Converte um array de objetos para uma string CSV.
 */
export function jsonToCsv(data: Record<string, unknown>[], headers?: string[]): string {
  if (data.length === 0) return "";

  const keys = Object.keys(data[0]);
  const headerRow = headers ? headers.join(",") : keys.join(",");

  const rows = data.map((obj) => {
    return keys
      .map((key) => {
        let val = obj[key];
        if (val === null || val === undefined) val = "";
        // Escapa vírgulas e aspas
        const stringVal = String(val).replace(/"/g, '""');
        return `"${stringVal}"`;
      })
      .join(",");
  });

  return [headerRow, ...rows].join("\n");
}

/**
 * Dispara o download de um arquivo no navegador.
 */
export function downloadFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Formata moeda para CSV (remover símbolos se necessário ou usar formato numérico).
 */
export function formatCurrencyForExport(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Formata data para CSV.
 */
export function formatDateForExport(date: string | Date): string {
  return new Date(date).toLocaleDateString("pt-BR");
}
