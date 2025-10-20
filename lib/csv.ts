import Papa from 'papaparse'

export type CsvRow = Record<string, string>

const CANDIDATES = [',', ';', '\t', '|'] as const
export type Delimiter = typeof CANDIDATES[number]

// Simple hash function for cache key
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(36)
}

// LRU cache for parsed CSV results
class ParseCache {
  private cache = new Map<string, { headers: string[]; rows: CsvRow[]; delimiter: Delimiter }>()
  private maxSize = 10 // Keep last 10 parsed CSVs

  get(text: string, delimiter?: Delimiter): { headers: string[]; rows: CsvRow[]; delimiter: Delimiter } | null {
    const key = `${simpleHash(text)}_${delimiter || 'auto'}`
    const cached = this.cache.get(key)
    if (cached) {
      // Move to end (most recently used)
      this.cache.delete(key)
      this.cache.set(key, cached)
      return cached
    }
    return null
  }

  set(text: string, delimiter: Delimiter | undefined, result: { headers: string[]; rows: CsvRow[]; delimiter: Delimiter }): void {
    const key = `${simpleHash(text)}_${delimiter || 'auto'}`

    // Remove oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(key, result)
  }

  clear(): void {
    this.cache.clear()
  }
}

const parseCache = new ParseCache()

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
  // Check cache first
  const cached = parseCache.get(text, delimiter)
  if (cached) {
    return cached
  }

  const delim = delimiter || detectDelimiter(text)

  // Use PapaParse for much faster parsing
  const result = Papa.parse<string[]>(text, {
    delimiter: delim,
    skipEmptyLines: true,
    quoteChar: '"',
    escapeChar: '"',
  })

  if (!result.data || result.data.length === 0) {
    const emptyResult = { headers: [], rows: [], delimiter: delim }
    parseCache.set(text, delimiter, emptyResult)
    return emptyResult
  }

  const headers = result.data[0].map((h, idx) => (h?.trim() || `col_${idx + 1}`))
  const data: CsvRow[] = result.data.slice(1).map((r) => {
    const rec: CsvRow = {}
    headers.forEach((h, i) => { rec[h] = (r[i] ?? "").trim() })
    return rec
  })

  const parsedResult = { headers, rows: data, delimiter: delim }
  parseCache.set(text, delimiter, parsedResult)

  return parsedResult
}

// Export cache clear function for manual cache management if needed
export function clearCsvCache(): void {
  parseCache.clear()
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

    console.log('CSV Validation - Parse result:',
      'Headers:', headers.length,
      'Rows:', rows.length,
      'Delimiter:', JSON.stringify(delimiter)
    )

    // Need at least 2 columns
    if (headers.length < 2) {
      console.log('CSV Validation FAILED: Less than 2 columns')
      return false
    }

    // Need at least 1 data row (not counting header)
    if (rows.length < 1) {
      console.log('CSV Validation FAILED: No data rows')
      return false
    }

    // If PapaParse successfully parsed it with consistent results, trust that
    // Check that most rows have values for most columns
    let validRowCount = 0
    const sampleSize = Math.min(100, rows.length)

    for (let i = 0; i < sampleSize; i++) {
      const row = rows[i]
      const nonEmptyFields = Object.values(row).filter(v => v && v.trim().length > 0).length
      // At least 30% of fields should have values
      if (nonEmptyFields >= headers.length * 0.3) {
        validRowCount++
      }
    }

    const validRowRatio = validRowCount / sampleSize
    console.log('CSV Validation - Row quality check:',
      'Valid rows:', validRowCount,
      'Sampled:', sampleSize,
      'Ratio:', validRowRatio.toFixed(2)
    )

    // At least 70% of rows should have decent data
    if (validRowRatio < 0.7) {
      console.log('CSV Validation FAILED: Not enough valid rows')
      return false
    }

    console.log('CSV Validation PASSED ✓')
    return true
  } catch (error) {
    console.error('CSV Validation ERROR:', error)
    return false
  }
}
