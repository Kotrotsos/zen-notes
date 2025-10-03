"use client"

import React, { useMemo, useRef, useState, useCallback } from "react"
import { AgGridReact } from "ag-grid-react"
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community"
import type { ColDef, GridApi, GridReadyEvent, CellValueChangedEvent } from "ag-grid-community"
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"
import { stringifyCsv } from "@/lib/csv"

type Props = {
  headers: string[]
  rows: Record<string, string>[]
  onRowsChange?: (rows: Record<string, string>[]) => void
}

export default function TableView({ headers, rows, onRowsChange }: Props) {
  // Register all community modules once (no-op after first call)
  try {
    ModuleRegistry.registerModules([AllCommunityModule])
  } catch {}
  const gridRef = useRef<AgGridReact>(null)
  const [api, setApi] = useState<GridApi | null>(null)

  const columnDefs = useMemo<ColDef[]>(() => headers.map((h) => ({ headerName: h, field: h, editable: true, resizable: true })), [headers])
  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, filter: true, minWidth: 100 }), [])
  const rowData = useMemo(() => rows, [rows])

  const onGridReady = useCallback((e: GridReadyEvent) => {
    setApi(e.api)
  }, [])

  const onCellValueChanged = useCallback((e: CellValueChangedEvent) => {
    const newData: Record<string, string>[] = []
    e.api.forEachNodeAfterFilterAndSort((n) => { if (n.data) newData.push({ ...n.data }) })
    onRowsChange?.(newData)
  }, [onRowsChange])

  return (
    <div className="ag-theme-alpine w-full h-full">
      <AgGridReact
        ref={gridRef}
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onGridReady={onGridReady}
        onCellValueChanged={onCellValueChanged}
        animateRows
        pagination
        paginationPageSize={100}
        rowBuffer={50}
        suppressColumnVirtualisation={false}
        suppressRowVirtualisation={false}
      />
    </div>
  )
}
