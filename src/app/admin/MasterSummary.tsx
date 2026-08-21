"use client";

import React, { useMemo, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { formatDate, normalizeKey } from "@/utils/helpers";
import { ClipboardList, Loader2, Filter, X } from "lucide-react";

interface MasterRow {
  key: string;
  siteAddress: string;
  siteName: string;
  areaName: string;
  workStartDate: string;
  arcNo: string;
  qty: number | "";
}

interface Filters {
  siteAddress: string;
  siteName: string;
  areaName: string;
  arcNo: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: Filters = {
  siteAddress: "",
  siteName: "",
  areaName: "",
  arcNo: "",
  dateFrom: "",
  dateTo: "",
};

export default function MasterSummary() {
  const { jobs } = useAppStore();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  // Build the flat list of rows from every job + form.
  const allRows = useMemo<MasterRow[]>(() => {
    const out: MasterRow[] = [];

    jobs.forEach((job) => {
      if (job.isDeleted) return;
      (job.forms || []).forEach((form) => {
        if (form.isDeleted) return;

        const summary = (form.summaryRows || []).filter(
          (r) =>
            (r.arcNo && r.arcNo.trim()) ||
            (typeof r.qty === "number" && r.qty > 0),
        );

        // One master row per summary row that carries ARC NO / QTY data.
        if (summary.length > 0) {
          summary.forEach((r) => {
            out.push({
              key: `${job.id}-${form.id}-${r.id}`,
              siteAddress: job.siteAddress?.trim() || "—",
              siteName: job.siteName?.trim() || "—",
              areaName: form.suitPublicAreaName?.trim() || "—",
              workStartDate: form.workStartDate || "—",
              arcNo: r.arcNo?.trim() || "—",
              qty: r.qty,
            });
          });
          return;
        }

        // Fall back to one row per form when a form has no ARC / QTY rows yet.
        if (!form.suitPublicAreaName && !form.workStartDate) return;
        out.push({
          key: `${job.id}-${form.id}`,
          siteAddress: job.siteAddress?.trim() || "—",
          siteName: job.siteName?.trim() || "—",
          areaName: form.suitPublicAreaName?.trim() || "—",
          workStartDate: form.workStartDate || "—",
          arcNo: "—",
          qty: "",
        });
      });
    });

    return out;
  }, [jobs]);

  // Unique option lists for each filter. Deduplicated case-insensitively so
  // "ITC ROYAL" and "Itc royal" produce a single option (first casing seen).
  const options = useMemo(() => {
    const unique = (pick: (r: MasterRow) => string) =>
      Array.from(
        new Map(
          allRows
            .map(pick)
            .filter((v) => v && v !== "—")
            .map((v) => [normalizeKey(v), v] as [string, string]),
        ).values(),
      ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    return {
      siteAddress: unique((r) => r.siteAddress),
      siteName: unique((r) => r.siteName),
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
            if (dateStr === "—" || !dateStr) return false;
            if (filters.dateFrom && dateStr < filters.dateFrom) return false;
            if (filters.dateTo && dateStr > filters.dateTo) return false;
            return true;
          };

    return allRows.filter(
      (r) =>
        (!filters.siteAddress ||
          q(r.siteAddress) === q(filters.siteAddress)) &&
        (!filters.siteName || q(r.siteName) === q(filters.siteName)) &&
        (!filters.areaName || q(r.areaName) === q(filters.areaName)) &&
        (!filters.arcNo || q(r.arcNo) === q(filters.arcNo)) &&
        inRange(r.workStartDate),
    );
  }, [allRows, filters]);

  const activeCount = Object.values(filters).filter(Boolean).length;

  const setFilter = (key: keyof Filters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const clear = () => setFilters(EMPTY_FILTERS);

  const inputCls =
    "px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  const renderSelect = (
    label: string,
    key: keyof Filters,
    values: string[],
  ) => (
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
          <span className="text-xs font-tabular text-muted-foreground px-2.5 py-1 rounded-full bg-secondary">
            {rows.length} {rows.length === 1 ? "row" : "rows"}
            {activeCount > 0 && ` · ${activeCount} active`}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="px-5 pt-4 border-b border-border">
        <div className="flex flex-wrap gap-3">
          {options.siteAddress.length > 0 &&
            renderSelect("Site Address", "siteAddress", options.siteAddress)}
          {options.siteName.length > 0 &&
            renderSelect("Site Name", "siteName", options.siteName)}
          {options.areaName.length > 0 &&
            renderSelect("Area Name", "areaName", options.areaName)}
          {options.arcNo.length > 0 &&
            renderSelect("ARC No", "arcNo", options.arcNo)}

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              Work Start Date
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilter("dateFrom", e.target.value)}
                className={inputCls}
                title="From"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilter("dateTo", e.target.value)}
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

      {!jobs.length ? (
        <div className="px-5 py-10 text-center text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin inline-block mr-2" />
          Loading jobs…
        </div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-muted-foreground text-sm">
          No rows match the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Site Address
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Site Name
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
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.key}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-2 text-foreground">{r.siteAddress}</td>
                  <td className="px-3 py-2 text-foreground">{r.siteName}</td>
                  <td className="px-3 py-2 text-foreground">{r.areaName}</td>
                  <td className="px-3 py-2 text-foreground">
                    {r.workStartDate === "—"
                      ? "—"
                      : formatDate(r.workStartDate)}
                  </td>
                  <td className="px-3 py-2 text-foreground">{r.arcNo}</td>
                  <td className="px-3 py-2 text-right font-tabular text-foreground">
                    {typeof r.qty === "number" ? r.qty : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}