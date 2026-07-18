'use client';

import React, { useMemo } from 'react';
import { Plus, Trash2, Copy } from 'lucide-react';
import type { MeasurementRow, ArcItem } from '@/types';
import { calcMeasurementRow, defaultMeasurementRow } from '@/utils/helpers';

interface MeasurementTableProps {
  rows: MeasurementRow[];
  onChange: (rows: MeasurementRow[]) => void;
  totalArea: number;
  arcItems?: ArcItem[];
}

export default function MeasurementTable({ rows, onChange, totalArea, arcItems = [] }: MeasurementTableProps) {
  const updateRow = (id: string, field: keyof MeasurementRow, value: string | number) => {
    const updated = rows.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, [field]: value };
      next.totalArea = calcMeasurementRow(next);
      return next;
    });
    onChange(updated);
  };

  const addRow = () => {
    onChange([...rows, defaultMeasurementRow(rows.length + 1)]);
  };

  const deleteRow = (id: string) => {
    onChange(rows.filter((r) => r.id !== id).map((r, i) => ({ ...r, slNo: i + 1 })));
  };

  const duplicateRow = (id: string) => {
    const src = rows.find((r) => r.id === id);
    if (!src) return;
    onChange([...rows, { ...src, id: `mr-${Date.now()}`, slNo: rows.length + 1 }]);
  };

  // Extract unique job types from ARC items for autocomplete suggestions
  const uniqueJobTypes = useMemo(() => {
    const set = new Set<string>();
    arcItems.forEach((item) => {
      if (item.job_type) set.add(item.job_type);
    });
    return Array.from(set);
  }, [arcItems]);

  const numInput = (rowId: string, field: 'length' | 'width' | 'no', value: number | '') => (
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

  const textInput = (
    rowId: string,
    field: 'jobType' | 'location' | 'coat',
    value: string,
    placeholder: string,
    className: string,
    listId?: string
  ) => (
    <input
      list={listId}
      value={value}
      onChange={(e) => updateRow(rowId, field, e.target.value)}
      className={className}
      placeholder={placeholder}
    />
  );

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div>
          <h3 className="font-semibold text-foreground text-sm">Section B — Measurement Sheet</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Job Type groups matching rows — Total Area = Length × Width × No.
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
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-left min-w-[140px]">Job Type</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-left min-w-[160px]">Location</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-center min-w-[80px]">Coat</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-right min-w-[80px]">Length (m)</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-right min-w-[80px]">Width (m)</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-right min-w-[60px]">No.</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-right min-w-[100px]">Total Area (m²)</th>
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
                    {textInput(
                      row.id,
                      'jobType',
                      row.jobType ?? '',
                      'e.g. Civil Repair',
                      'w-full px-1.5 py-1 bg-input border border-transparent rounded text-xs text-foreground focus:outline-none focus:border-ring focus:bg-card transition',
                      `jobtype-options-${row.id}`
                    )}
                    <datalist id={`jobtype-options-${row.id}`}>
                      {uniqueJobTypes.map((jt, i) => (
                        <option key={i} value={jt} />
                      ))}
                    </datalist>
                  </td>
                  <td className="px-1 py-1.5">
                    {textInput(
                      row.id,
                      'location',
                      row.location,
                      'e.g. North Wall, Ceiling',
                      'w-full px-1.5 py-1 bg-input border border-transparent rounded text-xs text-foreground focus:outline-none focus:border-ring focus:bg-card transition'
                    )}
                  </td>
                  <td className="px-1 py-1.5">
                    {textInput(
                      row.id,
                      'coat',
                      row.coat,
                      '1st',
                      'w-full px-1.5 py-1 bg-input border border-transparent rounded text-xs text-center text-foreground focus:outline-none focus:border-ring focus:bg-card transition'
                    )}
                  </td>
                  <td className="px-1 py-1.5">{numInput(row.id, 'length', row.length)}</td>
                  <td className="px-1 py-1.5">{numInput(row.id, 'width', row.width)}</td>
                  <td className="px-1 py-1.5">{numInput(row.id, 'no', row.no)}</td>
                  <td className="px-2 py-1.5 text-right text-xs font-tabular font-semibold text-foreground">
                    {row.totalArea.toFixed(2)}
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
                Total Area
              </td>
              <td className="px-2 py-2.5 text-right text-sm font-bold font-tabular text-primary">
                {totalArea.toFixed(2)} m²
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}