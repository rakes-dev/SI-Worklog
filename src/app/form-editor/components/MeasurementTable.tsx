'use client';

import React, { useMemo } from 'react';
import { Plus, Trash2, Copy, ChevronUp, ChevronDown } from 'lucide-react';
import type { MeasurementRow, ArcItem } from '@/types';
import { calcMeasurementRow, defaultMeasurementRow } from '@/utils/helpers';

const LOCATION_SUGGESTIONS = [
  'Bed side table',
  'Sofa table',
  'Round table',
  'Chair',
  'Sofa chair',
  'Hall Ceiling',
  'Bedroom Ceiling',
  'Washroom Ceiling',
  'Shower Ceiling',
  'W/C Ceiling',
  'luggage Area Ceiling',
  'TV Cabinet',
  'Wardrobe',
  'Writing Table',
  'Telephone Table',
  'AC grill',
  'Door',
  'Door frame',
  'Basin Counter',
  'Tv Wall frame',
  'Coat Stand',
  'Magazine Self',
  'Washroom Sliding door',
  'Iron Stand',
  'Tea Counter',
  'Public Area Staircase',
  'Public Area Railing',
  'Public Area Drain grill',
  'Public Area Pillar',
  'Public Area Pipe',
];

interface MeasurementTableProps {
  rows: MeasurementRow[];
  onChange: (rows: MeasurementRow[]) => void;
  totalArea: number;
  arcItems?: ArcItem[];
}

export default function MeasurementTable({ rows, onChange, totalArea, arcItems = [] }: MeasurementTableProps) {
  const [draggedRowId, setDraggedRowId] = React.useState<string | null>(null);
  const [overRowId, setOverRowId] = React.useState<string | null>(null);

  const hasFilledMeasurementValues = (row: MeasurementRow) => {
    return (
      (row.jobType ?? '').trim() !== '' ||
      row.location.trim() !== '' ||
      row.coat.trim() !== '' ||
      (row.arcNo ?? '').trim() !== '' ||
      (typeof row.length === 'number' && row.length > 0) ||
      (typeof row.width === 'number' && row.width > 0) ||
      (typeof row.no === 'number' && row.no > 0)
    );
  };

  const appendTrailingEmptyRow = (updatedRows: MeasurementRow[]) => {
    if (updatedRows.length === 0) return updatedRows;
    const lastRow = updatedRows[updatedRows.length - 1];
    return hasFilledMeasurementValues(lastRow)
      ? [...updatedRows, defaultMeasurementRow(updatedRows.length + 1)]
      : updatedRows;
  };

  const renumberRows = (updatedRows: MeasurementRow[]) =>
    updatedRows.map((row, index) => ({ ...row, slNo: index + 1 }));

  const reorderRows = (sourceId: string, targetId: string) => {
    const sourceIndex = rows.findIndex((row) => row.id === sourceId);
    const targetIndex = rows.findIndex((row) => row.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;

    const updated = [...rows];
    const [movedRow] = updated.splice(sourceIndex, 1);
    const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
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

  const updateRow = (id: string, field: keyof MeasurementRow, value: string | number) => {
    const updated = rows.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, [field]: value };
      next.totalArea = calcMeasurementRow(next);
      return next;
    });
    onChange(appendTrailingEmptyRow(updated));
  };

  const addRow = () => {
    onChange(appendTrailingEmptyRow([...rows, defaultMeasurementRow(rows.length + 1)]));
  };

  const deleteRow = (id: string) => {
    onChange(rows.filter((r) => r.id !== id).map((r, i) => ({ ...r, slNo: i + 1 })));
  };

  const duplicateRow = (id: string) => {
    const src = rows.find((r) => r.id === id);
    if (!src) return;
    onChange(
      appendTrailingEmptyRow([...rows, { ...src, id: `mr-${Date.now()}`, slNo: rows.length + 1 }])
    );
  };

  // Extract unique job types from ARC items for autocomplete suggestions
  const uniqueJobTypes = useMemo(() => {
    const set = new Set<string>();
    arcItems.forEach((item) => {
      if (item.job_type) set.add(item.job_type);
    });
    return Array.from(set);
  }, [arcItems]);

  const numInput = (
    rowId: string,
    field: 'no' | 'length' | 'width',
    value: number | ''
  ) => (
    <input
      type="number"
      step={field === 'no' ? '1' : '0.01'}
      min="0"
      value={value === '' ? '' : value}
      onChange={(e) =>
        updateRow(
          rowId,
          field,
          e.target.value === '' ? '' : field === 'no'
            ? parseInt(e.target.value, 10) || 0
            : parseFloat(e.target.value) || 0
        )
      }
      onBlur={(e) => {
        if (e.target.value !== '') {
          if (field === 'no') {
            updateRow(rowId, field, parseInt(e.target.value, 10));
          } else {
            const formatted = Number(e.target.value).toFixed(2);
            updateRow(rowId, field, parseFloat(formatted));
            e.target.value = formatted;
          }
        }
      }}
      className="w-full px-1.5 py-1 bg-input border border-transparent rounded text-right text-xs font-tabular text-foreground focus:outline-none focus:border-ring focus:bg-card transition"
    />
  );

  const textInput = (
    rowId: string,
    field: 'jobType' | 'location' | 'coat',
    value: string,
    placeholder: string,
    className: string,
    listId?: string,
    maxLength?: number
  ) => (
    <input
      list={listId}
      value={value}
      onChange={(e) => updateRow(rowId, field, e.target.value)}
      maxLength={maxLength}
      className={className}
      placeholder={placeholder}
    />
  );

  const handleArcSelect = (rowId: string, val: string) => {
    const matched = arcItems.find((item) => item.arc_no === val);
    if (matched) {
      const rateValue: number | '' =
        typeof matched.final_rate === 'number' ? matched.final_rate : '';
      const updated = rows.map((r) => {
        if (r.id !== rowId) return r;
        const next = {
          ...r,
          arcNo: val,
          jobType: matched.job_type || r.jobType,
          coat: matched.coat ? String(matched.coat) : r.coat,
          rate: rateValue,
        };
        next.totalArea = calcMeasurementRow(next);
        return next;
      });
      onChange(appendTrailingEmptyRow(updated));
    } else {
      updateRow(rowId, 'arcNo', val);
    }
  };

  const arcInput = (row: MeasurementRow) => (
    <input
      list={`arc-options-${row.id}`}
      value={row.arcNo ?? ''}
      onChange={(e) => handleArcSelect(row.id, e.target.value)}
      className="w-full px-1.5 py-1 bg-input border border-transparent rounded text-xs text-center text-foreground focus:outline-none focus:border-ring focus:bg-card transition"
      placeholder="ARC-001"
    />
  );

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div>
          <h3 className="font-semibold text-foreground text-sm">Section B — Measurement Sheet</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select an ARC No. to auto-fill Job Type, Coat & Rate — Summary updates automatically. Total Area = Length × Width × No. (If only Length is given, it's treated as a circle: Area = π × (Length/2)² × No.)
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
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-center min-w-[100px]">ARC No.</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-left min-w-[140px]">Job Type</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-left min-w-[160px]">Location</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-center min-w-[80px]">Coat</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-right min-w-[80px]">Length (m)</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-right min-w-[80px]">Width (m)</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-right min-w-[60px]">No.</th>
              <th className="px-2 py-2 text-xs font-medium text-muted-foreground text-right min-w-[100px]">Total Area (m²)</th>
              <th className="px-2 py-2 w-24" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No rows yet — click "Add Row" to start
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-border transition-transform duration-150 ease-out group ${overRowId === row.id ? 'bg-secondary/30 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]' : 'hover:bg-secondary/20'}`}
                  style={{ willChange: 'transform' }}
                >
                  <td className="px-2 py-1.5 text-center text-xs text-muted-foreground font-tabular">{row.slNo}</td>
                  <td className="px-1 py-1.5">
                    {arcInput(row)}
                    <datalist id={`arc-options-${row.id}`}>
                      {arcItems.map((item) => (
                        <option key={item.id} value={item.arc_no}>
                          {item.job_type || item.description.substring(0, 30)} (₹{item.final_rate})
                        </option>
                      ))}
                    </datalist>
                  </td>
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
                      'e.g. Bed side table',
                      'w-full px-1.5 py-1 bg-input border border-transparent rounded text-xs text-foreground focus:outline-none focus:border-ring focus:bg-card transition',
                      `location-options-${row.id}`
                    )}
                    <datalist id={`location-options-${row.id}`}>
                      {LOCATION_SUGGESTIONS.map((loc, i) => (
                        <option key={i} value={loc} />
                      ))}
                    </datalist>
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
              <td colSpan={8} className="px-4 py-2.5 text-right text-sm font-semibold text-foreground">
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