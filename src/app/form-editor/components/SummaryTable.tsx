'use client';

import React from 'react';
import { Plus, Trash2, Copy } from 'lucide-react';
import type { SummaryRow } from '@/types';
import { calcSummaryRow, defaultSummaryRow, formatCurrency } from '@/utils/helpers';

interface SummaryTableProps {
  rows: SummaryRow[];
  onChange: (rows: SummaryRow[]) => void;
  grandTotal: number;
}

export default function SummaryTable({ rows, onChange, grandTotal }: SummaryTableProps) {
  const updateRow = (id: string, field: keyof SummaryRow, value: string | number) => {
    const updated = rows.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, [field]: value };
      next.amount = calcSummaryRow(next);
      return next;
    });
    onChange(updated);
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
    const src = rows.find((r) => r.id === id);
    if (!src) return;
    const dup: SummaryRow = {
      ...src,
      id: `sr-${Date.now()}`,
      slNo: rows.length + 1,
    };
    onChange([...rows, dup]);
  };

  const numInput = (
    rowId: string,
    field: 'qty' | 'rate',
    value: number | ''
  ) => (
    <input
      type="number"
      step="0.01"
      min="0"
      value={value === '' ? '' : value}
      onChange={(e) =>
        updateRow(rowId, field, e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
      }
      className="w-full px-1.5 py-1 bg-input border border-transparent rounded text-right text-xs font-tabular text-foreground focus:outline-none focus:border-ring focus:bg-card transition"
    />
  );

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div>
          <h3 className="font-semibold text-foreground text-sm">Section A — Summary</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Complaint source, paint type, quantities and rates
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
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-center w-8">Sl.</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-left min-w-[140px]">Complaint Source</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-left min-w-[120px]">Paint Type</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-center min-w-[80px]">Coat</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-center min-w-[80px]">ARC No.</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-right min-w-[70px]">Qty</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-right min-w-[80px]">Rate (₹)</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-right min-w-[90px]">Amount (₹)</th>
              <th className="px-2 py-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No rows yet — click "Add Row" to start
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border hover:bg-secondary/20 transition-colors group">
                  <td className="px-2 py-1.5 text-center text-xs text-muted-foreground font-tabular">{row.slNo}</td>
                  <td className="px-1 py-1.5">
                    <input
                      value={row.complaintSource}
                      onChange={(e) => updateRow(row.id, 'complaintSource', e.target.value)}
                      className="w-full px-1.5 py-1 bg-input border border-transparent rounded text-xs text-foreground focus:outline-none focus:border-ring focus:bg-card transition"
                      placeholder="Source..."
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <input
                      value={row.paintType}
                      onChange={(e) => updateRow(row.id, 'paintType', e.target.value)}
                      className="w-full px-1.5 py-1 bg-input border border-transparent rounded text-xs text-foreground focus:outline-none focus:border-ring focus:bg-card transition"
                      placeholder="e.g. Emulsion"
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <input
                      value={row.coat}
                      onChange={(e) => updateRow(row.id, 'coat', e.target.value)}
                      className="w-full px-1.5 py-1 bg-input border border-transparent rounded text-xs text-center text-foreground focus:outline-none focus:border-ring focus:bg-card transition"
                      placeholder="1st"
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <input
                      value={row.arcNo}
                      onChange={(e) => updateRow(row.id, 'arcNo', e.target.value)}
                      className="w-full px-1.5 py-1 bg-input border border-transparent rounded text-xs text-center text-foreground focus:outline-none focus:border-ring focus:bg-card transition"
                      placeholder="ARC-001"
                    />
                  </td>
                  <td className="px-1 py-1.5">{numInput(row.id, 'qty', row.qty)}</td>
                  <td className="px-1 py-1.5">{numInput(row.id, 'rate', row.rate)}</td>
                  <td className="px-2 py-1.5 text-right text-xs font-tabular font-semibold text-foreground">
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="px-1 py-1.5">
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
              <td colSpan={7} className="px-4 py-2.5 text-right text-sm font-semibold text-foreground">
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