/**
 * Utility for safe CSV generation with UTF-8 BOM encoding for proper Bengali text rendering
 * and protection against CSV Formula Injection (Excel Macro Injection).
 */

function sanitizeForCSV(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();

  // Protect against CSV Formula Injection
  // If the cell starts with =, +, -, @, \t, \r, escape with single quote prefix
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape double quotes inside string by doubling them
  str = str.replace(/"/g, '""');

  return `"${str}"`;
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number | undefined | null)[][]): void {
  const headerRow = headers.map(h => sanitizeForCSV(h)).join(',');
  const dataRows = rows.map(row => row.map(cell => sanitizeForCSV(cell)).join(','));

  // Prepend UTF-8 BOM (\uFEFF) so Microsoft Excel recognizes UTF-8 encoding for Bengali script
  const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
