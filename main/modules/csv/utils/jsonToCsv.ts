/**
 * Regex matching characters that can trigger formula interpretation
 * in spreadsheet applications (Excel, LibreOffice Calc, etc.)
 * when they appear at the start of a CSV cell value.
 */
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

/**
 * Converts a simple key-value object to CSV format
 * @param data - Object with string keys and number values
 * @returns CSV string with "name,amount" header
 *
 * @example
 * const data = { "The Surgeon": 9, "The Doctor": 3 };
 * const csv = jsonToCsv(data);
 * // Returns:
 * // name,amount
 * // The Surgeon,9
 * // The Doctor,3
 */
export function jsonToCsv(data: Record<string, number>): string {
  const header = "name,amount\n";

  const rows = Object.entries(data)
    .map(([name, amount]) => {
      let escapedName = name;

      // CSV formula injection protection: prefix with single quote
      // to prevent spreadsheet formula interpretation.
      // The single quote is recognized by Excel/LibreOffice as a
      // text prefix marker and will not be displayed in the cell.
      if (FORMULA_TRIGGERS.test(escapedName)) {
        escapedName = `'${escapedName}`;
      }

      // Escape quotes and wrap in quotes if name contains comma, quote,
      // or was formula-prefixed (detected by comparing to original name)
      if (
        escapedName.includes(",") ||
        escapedName.includes('"') ||
        escapedName !== name
      ) {
        escapedName = `"${escapedName.replace(/"/g, '""')}"`;
      }

      return `${escapedName},${amount}`;
    })
    .join("\n");

  return header + rows;
}
