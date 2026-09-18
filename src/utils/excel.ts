import * as XLSX from 'xlsx'

/** Write a genuine XLSX file containing exactly the rows visible in a table. */
export function downloadWorkbook<T>(
  sheetName: string,
  columns: Array<{ label: string; value: (row: T) => string | number | undefined }>,
  rows: T[],
  filename: string,
) {
  const data = rows.map((row) => Object.fromEntries(columns.map((column) => [column.label, column.value(row) ?? ''])))
  const worksheet = XLSX.utils.json_to_sheet(data, { header: columns.map((column) => column.label) })
  worksheet['!cols'] = columns.map((column) => ({ wch: Math.max(12, column.label.length + 2) }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, filename, { compression: true })
}
