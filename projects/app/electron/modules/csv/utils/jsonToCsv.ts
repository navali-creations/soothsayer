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
      // Escape quotes and wrap in quotes if name contains comma or quote
      const escapedName =
        name.includes(",") || name.includes('"')
          ? `"${name.replace(/"/g, '""')}"`
          : name;

      return `${escapedName},${amount}`;
    })
    .join("\n");

  return header + rows;
}
