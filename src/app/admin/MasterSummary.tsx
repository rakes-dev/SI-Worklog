'use client';

import React, { useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { formatCurrency, formatDate, normalizeKey } from '@/utils/helpers';
import {
  downloadMasterSummaryExcel,
  type MasterExcelSection,
  type MasterExcelRowData,
} from '@/utils/masterSummaryExcel';
import { ChevronDown, ClipboardList, Download, Filter, Loader2, X } from 'lucide-react';

interface MasterRow {
  key: string;
  siteName: string;
  category: string;
  areaName: string;
  workStartDate: string;
  arcNo: string;
  qty: number | '';
  paintType: string;
  totalArea: number;
  amount: number;
}

interface Filters {
  siteName: string[]; // multi-select — multiple sites can be selected
  category: string;
  areaName: string;
  arcNo: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: Filters = {
  siteName: [],
  category: '',
  areaName: '',
  arcNo: '',
  dateFrom: '',
  dateTo: '',
};

export default function MasterSummary() {
  const { forms, categories } = useAppStore();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [siteNameOpen, setSiteNameOpen] = useState(false);

  // Build the flat list of rows from every job + form.
  const allRows = useMemo<MasterRow[]>(() => {
    const out: MasterRow[] = [];

    forms.forEach((form) => {
      if (form.isDeleted) return;

        const category = categories.find((c) => c.id === form.categoryId);
        const categoryName = category?.name?.trim() || '—';

        const summary = (form.summaryRows || []).filter(
          (r) => (r.arcNo && r.arcNo.trim()) || (typeof r.qty === 'number' && r.qty > 0)
        );

        // One master row per summary row that carries ARC NO / QTY data.
        if (summary.length > 0) {
          summary.forEach((r) => {
            out.push({
              key: `${form.id}-${r.id}`,
              siteName: form.siteName?.trim() || '—',
              category: categoryName,
              areaName: form.suitPublicAreaName?.trim() || '—',
              workStartDate: form.workStartDate || '—',
              arcNo: r.arcNo?.trim() || '—',
              qty: r.qty,
              paintType: r.paintType || r.arcNo?.trim() || '',
              totalArea: form.totalArea || 0,
              amount: r.amount || 0,
            });
          });
          return;
        }

        // Fall back to one row per form when a form has no ARC / QTY rows yet.
        if (!form.suitPublicAreaName && !form.workStartDate) return;
        out.push({
          key: `${form.id}`,
          siteName: form.siteName?.trim() || '—',
          category: categoryName,
          areaName: form.suitPublicAreaName?.trim() || '—',
          workStartDate: form.workStartDate || '—',
          arcNo: '—',
          qty: '',
          paintType: '',
          totalArea: form.totalArea || 0,
          amount: form.grandTotal || 0,
        });
      });

    return out;
  }, [forms]);

  // Unique option lists for each filter. Deduplicated case-insensitively so
  // "ITC ROYAL" and "Itc royal" produce a single option (first casing seen).
  const options = useMemo(() => {
    const unique = (pick: (r: MasterRow) => string) =>
      Array.from(
        new Map(
          allRows
            .map(pick)
            .filter((v) => v && v !== '—')
            .map((v) => [normalizeKey(v), v] as [string, string])
        ).values()
      ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    return {
      siteName: unique((r) => r.siteName),
      category: unique((r) => r.category),
      areaName: unique((r) => r.areaName),
      arcNo: unique((r) => r.arcNo),
    };
  }, [allRows]);

  // Apply all active filters.
  const rows = useMemo<MasterRow[]>(() => {
    const q = (v: string) => v.trim().toLowerCase();

    const inRange =
      !filters.dateFrom && !filters.dateTo
        ? () => true
        : (dateStr: string) => {
            // workStartDate is stored as YYYY-MM-DD, so string compare works.
            if (dateStr === '—' || !dateStr) return false;
            if (filters.dateFrom && dateStr < filters.dateFrom) return false;
            if (filters.dateTo && dateStr > filters.dateTo) return false;
            return true;
          };

    return allRows.filter(
      (r) =>
        (filters.siteName.length === 0 ||
          filters.siteName.some((s) => q(r.siteName) === q(s))) &&
        (!filters.category || q(r.category) === q(filters.category)) &&
        (!filters.areaName || q(r.areaName) === q(filters.areaName)) &&
        (!filters.arcNo || q(r.arcNo) === q(filters.arcNo)) &&
        inRange(r.workStartDate)
    );
  }, [allRows, filters]);

  // Totals for the filtered rows — recomputed automatically whenever the
  // filters change, so the sum always reflects the visible dataset.
  const totals = useMemo(() => {
    let qty = 0;
    let area = 0;
    let amount = 0;
    for (const r of rows) {
      if (typeof r.qty === 'number') qty += r.qty;
      area += r.totalArea;
      amount += r.amount;
    }
    return { qty, area, amount };
  }, [rows]);

  const activeCount =
    (filters.siteName.length > 0 ? 1 : 0) +
    (filters.category ? 1 : 0) +
    (filters.areaName ? 1 : 0) +
    (filters.arcNo ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0);

  const setFilter = (key: keyof Filters, value: string | string[]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const clear = () => {
    setFilters(EMPTY_FILTERS);
    setSiteNameOpen(false);
  };

  // Export the currently visible (filtered) rows. Columns are derived from the
  // ARCs actually present (deduped, unknown ones added automatically) and the
  // header labels use the ARC job type. Each filtered summary row becomes its
  // own data row so the exported row count matches the panel.
  const handleExport = () => {
    const sections: MasterExcelSection[] = [];
    const siteMap = new Map<
      string,
      { sec: MasterExcelSection; rowsByKey: Map<string, MasterExcelRowData> }
    >();

    for (const r of rows) {
      const siteLabel = r.siteName !== '—' ? r.siteName : r.category;
      const siteKey = normalizeKey(siteLabel);
      let entry = siteMap.get(siteKey);
      if (!entry) {
        entry = {
          sec: {
            siteName: siteLabel === '—' ? '' : siteLabel,
            category: r.category === '—' ? '' : r.category,
            rows: [],
          },
          rowsByKey: new Map<string, MasterExcelRowData>(),
        };
        siteMap.set(siteKey, entry);
        sections.push(entry.sec);
      }

      const date = r.workStartDate !== '—' ? r.workStartDate : '';
      const desc = r.siteName !== '—' ? r.siteName : ''; // Description = Site Name
      // Each summary row gets its own Excel row (keyed by the source row id),
      // so the exported row count matches the panel row count.
      const rowKey = r.key;
      let dataRow = entry.rowsByKey.get(rowKey);
      if (!dataRow) {
        dataRow = { date, description: desc, key: rowKey, lines: [] };
        entry.rowsByKey.set(rowKey, dataRow);
        entry.sec.rows.push(dataRow);
      }

      if (typeof r.qty === 'number' && r.arcNo !== '—' && r.arcNo.trim()) {
        dataRow.lines.push({
          arc: r.arcNo,
          qty: r.qty,
          jobType: r.paintType,
        });
      }
    }

    downloadMasterSummaryExcel(sections);
  };

  const inputCls =
    'px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  const renderSelect = (label: string, key: keyof Filters, values: string[]) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={filters[key]}
        onChange={(e) => setFilter(key, e.target.value)}
        className={inputCls}
      >
        <option value="">All {label}</option>
        {values.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );

  const toggleSiteName = (value: string) => {
    setFilters((prev) => {
      const next = prev.siteName.includes(value)
        ? prev.siteName.filter((item) => item !== value)
        : [...prev.siteName, value];
      return { ...prev, siteName: next };
    });
    setSiteNameOpen(false);
  };

  const renderSiteNameFilter = (label: string, key: keyof Filters, values: string[]) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="relative min-w-[14rem]">
        <button
          type="button"
          onClick={() => setSiteNameOpen((prev) => !prev)}
          className={`${inputCls} w-full flex items-center justify-between gap-2`}
          aria-expanded={siteNameOpen}
        >
          <span className="truncate text-left">
            {filters.siteName.length > 0
              ? `${filters.siteName.length} Site Name${filters.siteName.length === 1 ? '' : 's'}`
              : 'Site Name'}
          </span>
          <ChevronDown size={14} className={`shrink-0 transition-transform ${siteNameOpen ? 'rotate-180' : ''}`} />
        </button>

        {siteNameOpen && (
          <div className="absolute z-20 mt-2 w-full rounded-md border border-border bg-card shadow-lg overflow-hidden">
            <div className="max-h-64 overflow-auto p-2 space-y-1">
              {values.map((value) => {
                const checked = filters.siteName.includes(value);
                return (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-secondary"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSiteName(value)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                    />
                    <span className="truncate">{value}</span>
                  </label>
                );
              })}
            </div>
            <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              Selection closes automatically after each click.
            </div>
          </div>
        )}
      </div>
    </label>
  );

  return (
    <div className="bg-card border border-border rounded-xl mt-6 overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <ClipboardList size={17} /> Master Summary
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Site details from every job and form across the app.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-tabular text-muted-foreground px-2.5 py-1 rounded-full bg-secondary">
              {rows.length} {rows.length === 1 ? 'row' : 'rows'}
              {activeCount > 0 && ` · ${activeCount} active`}
            </span>
            <button
              onClick={handleExport}
              disabled={rows.length === 0}
              title="Export current rows to Excel"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={14} /> Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-5 pt-4 border-b border-border">
        <div className="flex flex-wrap gap-3">
          {options.category.length > 0 &&
            renderSelect('Category', 'category', options.category)}
          {options.siteName.length > 0 && renderSiteNameFilter('Site Name', 'siteName', options.siteName)}
          {options.areaName.length > 0 && renderSelect('Area Name', 'areaName', options.areaName)}
          {options.arcNo.length > 0 && renderSelect('ARC No', 'arcNo', options.arcNo)}

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Work Start Date</span>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilter('dateFrom', e.target.value)}
                className={inputCls}
                title="From"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilter('dateTo', e.target.value)}
                className={inputCls}
                title="To"
              />
            </div>
          </div>

          {activeCount > 0 && (
            <button
              onClick={clear}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
        {activeCount > 0 && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Filter size={12} /> Showing {rows.length} of {allRows.length} rows.
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-muted-foreground text-sm">
          No rows match the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Site Name
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Category
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Area Name
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Work Start Date
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  ARC No
                </th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Qty
                </th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Total Area
                </th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-foreground">{r.siteName}</td>
                  <td className="px-3 py-2 text-foreground">{r.category}</td>
                  <td className="px-3 py-2 text-foreground">{r.areaName}</td>
                  <td className="px-3 py-2 text-foreground">
                    {r.workStartDate === '—' ? '—' : formatDate(r.workStartDate)}
                  </td>
                  <td className="px-3 py-2 text-foreground">{r.arcNo}</td>
                  <td className="px-3 py-2 text-right font-tabular text-foreground">
                    {typeof r.qty === 'number' ? r.qty : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-tabular text-foreground">
                    {r.totalArea}
                  </td>
                  <td className="px-3 py-2 text-right font-tabular font-semibold text-primary">
                    ₹{formatCurrency(r.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-secondary/50 font-semibold text-foreground">
                <td className="px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total
                </td>
                <td />
                <td />
                <td />
                <td />
                <td className="px-3 py-2.5 text-right font-tabular font-bold">{totals.qty}</td>
                <td className="px-3 py-2.5 text-right font-tabular font-bold">{totals.area}</td>
                <td className="px-3 py-2.5 text-right font-tabular font-bold text-primary">
                  ₹{formatCurrency(totals.amount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
