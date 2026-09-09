"use client";

import React, { useState } from "react";
import { Plus, Trash2, Copy, Info, ChevronUp, ChevronDown } from "lucide-react";
import type { SummaryRow, ArcItem } from "@/types";
import {
  calcSummaryRow,
  defaultSummaryRow,
  formatCurrency,
  generateId,
} from "@/utils/helpers";
import { useSuggestions } from "@/components/ui/HorizontalSuggestions";

const COMPLAINT_SUGGESTIONS = [
  "Engineer Dept.",
  "Housekeeping",
  "Guest Complaint",
  "Maintenance",
  "Front Office",
  "F&B Dept.",
  "Direct Work",
];

const PAINT_TYPE_SUGGESTIONS = [
  "Emulsion Paint",
  "Enamel Paint",
  "Melamyne Polish",
  "PU Polish",
  "DUCO Paint",
  "Textured Paint",
  "Primer Coat",
  "Wall Putty",
  "Lamination",
];

interface SummaryTableProps {
  rows: SummaryRow[];
  onChange: (rows: SummaryRow[]) => void;
  grandTotal: number;
  arcItems?: ArcItem[];
  formType?: "painting" | "carpenter";
}

export default function SummaryTable({
  rows,
  onChange,
  grandTotal,
  arcItems = [],
  formType = "painting",
}: SummaryTableProps) {
  const { showSuggestions, hideSuggestions } = useSuggestions();
  const isCarpenter = formType === "carpenter";
  const totalCols = isCarpenter ? 8 : 9;
  const [overRowId, setOverRowId] = React.useState<string | null>(null);

  const updateRow = (
    id: string,
    field: keyof SummaryRow,
    value: string | number,
  ) => {
    const updated = rows.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, [field]: value };
      next.amount = calcSummaryRow(next);
      return next;
    });
    onChange(updated);
  };

  const renumberRows = (updatedRows: SummaryRow[]) =>
    updatedRows.map((row, index) => ({ ...row, slNo: index + 1 }));

  const reorderRows = (sourceId: string, targetId: string) => {
    const sourceIndex = rows.findIndex((row) => row.id === sourceId);
    const targetIndex = rows.findIndex((row) => row.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex)
      return;

    const updated = [...rows];
    const [movedRow] = updated.splice(sourceIndex, 1);
    const adjustedTargetIndex =
      sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    updated.splice(adjustedTargetIndex, 0, movedRow);
    onChange(renumberRows(updated));
  };

  const moveUp = (id: string) => {
    const idx = rows.findIndex((r) => r.id === id);
    if (idx > 0) reorderRows(id, rows[idx - 1].id);
  };

  const moveDown = (id: string) => {
    const idx = rows.findIndex((r) => r.id === id);
    if (idx >= 0 && idx < rows.length - 1) reorderRows(id, rows[idx + 1].id);
  };

  const addRow = () => {
    onChange([...rows, defaultSummaryRow(rows.length + 1)]);
  };

  const deleteRow = (id: string) => {
    const updated = rows
      .filter((r) => r.id !== id)
      .map((r, i) => ({ ...r, slNo: i + 1 }));
    onChange(updated);
  };

  const duplicateRow = (id: string) => {
    const srcIndex = rows.findIndex((r) => r.id === id);
    if (srcIndex < 0) return;
    const src = rows[srcIndex];
    const dup: SummaryRow = {
      ...src,
      id: generateId("sr"),
    };
    const updated = [...rows];
    updated.splice(srcIndex + 1, 0, dup);
    onChange(renumberRows(updated));
  };

  const handleArcSelect = (rowId: string, val: string) => {
    const matched = arcItems.find((item) => item.arc_no === val);
    if (matched) {
      const rateValue: number | "" =
        typeof matched.final_rate === "number" ? matched.final_rate : "";
      const updated = rows.map((r) => {
        if (r.id !== rowId) return r;
        const next: SummaryRow = {
          ...r,
          arcNo: val,
          paintType: matched.job_type || matched.description,
          coat: matched.coat ? String(matched.coat) : "",
          rate: rateValue,
        };
        next.amount = calcSummaryRow(next);
        return next;
      });
      onChange(updated);
    } else {
      updateRow(rowId, "arcNo", val);
    }
  };

  const showComplaintSuggestions = (rowId: string, query: string) => {
    const q = query.toLowerCase().trim();
    const filtered = COMPLAINT_SUGGESTIONS.filter((c) =>
      !q || c.toLowerCase().includes(q),
    ).map((c) => ({ label: c, value: c }));
    showSuggestions(`cs-${rowId}`, filtered, (selected) => {
      updateRow(rowId, "complaintSource", selected);
    });
  };

  const showPaintTypeSuggestions = (rowId: string, query: string) => {
    const q = query.toLowerCase().trim();
    const filtered = PAINT_TYPE_SUGGESTIONS.filter((p) =>
      !q || p.toLowerCase().includes(q),
    ).map((p) => ({ label: p, value: p }));
    showSuggestions(`pt-${rowId}`, filtered, (selected) => {
      updateRow(rowId, "paintType", selected);
    });
  };

  const showArcSuggestions = (rowId: string, query: string, paintTypeQuery: string) => {
    const q = query.toLowerCase().trim();
    const pq = paintTypeQuery.toLowerCase().trim();
    const filteredArcItems = pq
      ? arcItems.filter(
          (item) =>
            (item.job_type && item.job_type.toLowerCase().includes(pq)) ||
            (item.description && item.description.toLowerCase().includes(pq)),
        )
      : arcItems;

    const filtered = filteredArcItems
      .filter((item) => !q || item.arc_no.toLowerCase().includes(q) || (item.job_type && item.job_type.toLowerCase().includes(q)))
      .map((item) => ({
        label: item.arc_no,
        value: item.arc_no,
        sublabel: item.job_type || (item.description ? item.description.substring(0, 25) : undefined),
      }));

    showSuggestions(`sarc-${rowId}`, filtered, (selected) => {
      handleArcSelect(rowId, selected);
    });
  };

  interface SummaryNumInputProps {
    rowId: string;
    field: "qty" | "rate";
    value: number | "";
  }

  const SummaryNumInput = ({ rowId, field, value }: SummaryNumInputProps) => {
    const [text, setText] = useState<string | null>(null);

    const display =
      text !== null ? text : value === "" ? "" : value.toFixed(2);

    return (
      <input
        type="number"
        inputMode="decimal"
        pattern="[0-9]*"
        step="0.01"
        min="0"
        value={display}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          updateRow(
            rowId,
            field,
            raw === "" ? "" : parseFloat(raw) || 0,
          );
        }}
        onFocus={(e) => {
          setText(value === "" ? "" : String(value));
          e.target.select();
        }}
        onBlur={() => setText(null)}
        className="w-full px-1.5 py-1 bg-input border border-transparent rounded text-right text-xs font-tabular text-foreground focus:outline-none focus:border-ring focus:bg-card transition"
      />
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div>
          <h3 className="font-semibold text-foreground text-sm">
            Section A — Summary
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            Complaint source, paint type, quantities and rates.
            <span className="inline-flex items-center gap-0.5 text-primary font-medium">
              <Info size={12} />
              Tip: Enter Paint Type first to filter ARC No. options!
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors scale-press"
        >
          <Plus size={13} />
          Add Row
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-center w-8">
                Sl.
              </th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-left min-w-[140px]">
                Complaint Source
              </th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-left min-w-[120px]">
                Paint Type
              </th>
              {!isCarpenter && (
                <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-center min-w-[80px]">
                  Coat
                </th>
              )}
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-center min-w-[100px]">
                ARC No.
              </th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-right min-w-[70px]">
                Qty
              </th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-right min-w-[80px]">
                Rate (₹)
              </th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-right min-w-[90px]">
                Amount (₹)
              </th>
              <th className="px-2 py-2 w-24" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={totalCols}
                  className="px-4 py-8 text-center text-muted-foreground text-sm"
                >
                  No rows yet — click "Add Row" to start
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-border transition-transform duration-150 ease-out group ${
                    overRowId === row.id
                      ? "bg-secondary/30 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                      : "hover:bg-secondary/20"
                  }`}
                  style={{ willChange: "transform" }}
                >
                  <td className="px-2 py-1.5 text-center text-xs text-muted-foreground font-tabular">
                    {row.slNo}
                  </td>
                  <td className="px-1 py-1.5">
                    <input
                      value={row.complaintSource}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateRow(row.id, "complaintSource", val);
                        showComplaintSuggestions(row.id, val);
                      }}
                      onFocus={() => showComplaintSuggestions(row.id, row.complaintSource)}
                      onBlur={() => hideSuggestions(`cs-${row.id}`)}
                      className="w-full px-1.5 py-1 bg-input border border-transparent rounded text-xs text-foreground focus:outline-none focus:border-ring focus:bg-card transition"
                      placeholder="Engineer Dept."
                      autoComplete="off"
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <input
                      value={row.paintType}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateRow(row.id, "paintType", val);
                        showPaintTypeSuggestions(row.id, val);
                      }}
                      onFocus={() => showPaintTypeSuggestions(row.id, row.paintType)}
                      onBlur={() => hideSuggestions(`pt-${row.id}`)}
                      className="w-full px-1.5 py-1 bg-input border border-transparent rounded text-xs text-foreground focus:outline-none focus:border-ring focus:bg-card transition"
                      placeholder="e.g. Emulsion"
                      autoComplete="off"
                    />
                  </td>
                  {!isCarpenter && (
                    <td className="px-1 py-1.5">
                      <input
                        value={row.coat}
                        onChange={(e) =>
                          updateRow(row.id, "coat", e.target.value)
                        }
                        className="w-full px-1.5 py-1 bg-input border border-transparent rounded text-xs text-center text-foreground focus:outline-none focus:border-ring focus:bg-card transition"
                        placeholder="1st"
                        autoComplete="off"
                      />
                    </td>
                  )}
                  <td className="px-1 py-1.5">
                    <input
                      value={row.arcNo}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleArcSelect(row.id, val);
                        showArcSuggestions(row.id, val, row.paintType);
                      }}
                      onFocus={() => showArcSuggestions(row.id, row.arcNo, row.paintType)}
                      onBlur={() => hideSuggestions(`sarc-${row.id}`)}
                      className="w-full px-1.5 py-1 bg-input border border-transparent rounded text-xs text-center text-foreground focus:outline-none focus:border-ring focus:bg-card transition"
                      placeholder="ARC-001"
                      autoComplete="off"
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <SummaryNumInput rowId={row.id} field="qty" value={row.qty} />
                  </td>
                  <td className="px-1 py-1.5">
                    <SummaryNumInput rowId={row.id} field="rate" value={row.rate} />
                  </td>
                  <td className="px-2 py-1.5 text-right text-xs font-tabular font-semibold text-foreground">
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="px-1 py-1.5">
                    <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => moveUp(row.id)}
                        title="Move up"
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={row.slNo === 1}
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(row.id)}
                        title="Move down"
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={row.slNo === rows.length}
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateRow(row.id)}
                        title="Duplicate row"
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRow(row.id)}
                        title="Delete row"
                        className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-secondary/40">
              <td
                colSpan={isCarpenter ? 6 : 7}
                className="px-4 py-2.5 text-right text-sm font-semibold text-foreground"
              >
                Grand Total
              </td>
              <td className="px-2 py-2.5 text-right text-sm font-bold font-tabular text-primary">
                ₹{formatCurrency(grandTotal)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
