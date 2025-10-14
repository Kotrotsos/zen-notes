export type CsvRow = Record<string, string>

const CANDIDATES = [',', ';', '\t', '|'] as const
export type Delimiter = typeof CANDIDATES[number]

function detectDelimiter(text: string): Delimiter {
  const lines = text.split(/\r?\n/).slice(0, 10)
  let best: Delimiter = ','
  let bestScore = -1
  for (const cand of CANDIDATES) {
    let score = 0
    for (const line of lines) {
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          inQuotes = !inQuotes || (line[i + 1] === '"' && !!(i++)) === false
        } else if (!inQuotes && ch === cand) {
          score++
        }
      }
    }
    if (score > bestScore) { bestScore = score; best = cand }
  }
  return best
}

export function parseCsv(text: string, delimiter?: Delimiter): { headers: string[]; rows: CsvRow[]; delimiter: Delimiter } {
  const delim = delimiter || detectDelimiter(text)
  const rowsRaw: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ } else { inQuotes = false }
      } else { cell += ch }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === delim) { row.push(cell); cell = "" }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++
        row.push(cell)
        rowsRaw.push(row)
        row = []
        cell = ""
      } else { cell += ch }
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rowsRaw.push(row) }
  if (rowsRaw.length === 0) return { headers: [], rows: [], delimiter: delim }
  const headers = rowsRaw[0].map((h, idx) => (h?.trim() || `col_${idx + 1}`))
  const data: CsvRow[] = rowsRaw.slice(1).map((r) => {
    const rec: CsvRow = {}
    headers.forEach((h, i) => { rec[h] = (r[i] ?? "").trim() })
    return rec
  })
  return { headers, rows: data, delimiter: delim }
}

export function stringifyCsv(headers: string[], rows: CsvRow[], delimiter: Delimiter = ','): string {
  const esc = (v: string) => {
    if (v == null) return ""
    const needs = new RegExp(`["${delimiter}\\n\\r]`).test(v)
    const s = String(v).replace(/"/g, '""')
    return needs ? `"${s}"` : s
  }
  const head = headers.map(esc).join(delimiter)
  const body = rows.map((r) => headers.map((h) => esc(r[h] ?? "")).join(delimiter)).join('\n')
  return body ? `${head}\n${body}` : head
}

export function isValidCsv(text: string): boolean {
  try {
    const { headers, rows, delimiter } = parseCsv(text)

    // Need at least 2 columns
    if (headers.length < 2) return false

    // Need at least 1 data row (not counting header)
    if (rows.length < 1) return false

    // Check if delimiter appears consistently across rows
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) return false // Need at least header + 1 data row

    // Count delimiter occurrences in each line
    const delimCounts = lines.map(line => {
      let count = 0
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') inQuotes = !inQuotes
        else if (!inQuotes && ch === delimiter) count++
      }
      return count
    })

    // All rows should have similar delimiter counts (within 1 of each other)
    const minCount = Math.min(...delimCounts)
    const maxCount = Math.max(...delimCounts)
    if (maxCount - minCount > 1) return false

    // At least 80% of lines should have the delimiter
    const linesWithDelimiter = delimCounts.filter(c => c > 0).length
    if (linesWithDelimiter < lines.length * 0.8) return false

    return true
  } catch {
    return false
  }
}
