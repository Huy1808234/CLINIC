import * as XLSX from "xlsx";

export interface ParsedSheetData {
  sheetName: string;
  rows: Array<Record<string, unknown>>;
  headerRowIndex: number;
}

export interface ParsedWorkbookResult {
  sheetNames: string[];
  sheets: ParsedSheetData[];
}

/**
 * Parses an Excel file buffer into structured rows
 */
export function parseExcelWorkbook(buffer: ArrayBuffer | Uint8Array | Buffer): ParsedWorkbookResult {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    raw: true,
  });

  const parsedSheets: ParsedSheetData[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    // Convert sheet to JSON rows
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: null,
      raw: true,
    });

    parsedSheets.push({
      sheetName,
      rows,
      headerRowIndex: 0,
    });
  }

  return {
    sheetNames: workbook.SheetNames,
    sheets: parsedSheets,
  };
}
