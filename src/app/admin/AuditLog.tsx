"use client";

import React, { useMemo } from "react";
import { Activity, Building2, FileText, UserRound, Clock3, Layers3 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditLog() {
  const { forms, categories, sites } = useAppStore();

  const entries = useMemo(() => {
    return forms
      .filter((form) => !form.isDeleted)
      .map((form) => {
        const category = categories.find((item) => item.id === form.categoryId);
        const site = sites.find((item) => item.id === form.siteId);
        return {
          id: form.id,
          employee: form.empName?.trim() || form.ownerEmail || "Unassigned",
          email: form.ownerEmail || "—",
          siteName: site?.name || form.siteName || "—",
          categoryName: category?.name || "Uncategorized",
          formName: form.formName || "Untitled form",
          sheetNo: Number(form.sheetNo || 0),
          updatedAt: form.updatedAt || form.createdAt,
          createdAt: form.createdAt,
          month: form.month || "—",
        };
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      );
  }, [categories, forms, sites]);

  const employeeStats = useMemo(() => {
    const map = new Map<
      string,
      { employee: string; email: string; forms: number; lastSeen: string }
    >();

    entries.forEach((entry) => {
      const current = map.get(entry.email || entry.employee) ?? {
        employee: entry.employee,
        email: entry.email,
        forms: 0,
        lastSeen: entry.updatedAt || entry.createdAt,
      };
      current.forms += 1;
      const currentTime = new Date(entry.updatedAt || entry.createdAt).getTime();
      const lastSeenTime = new Date(current.lastSeen || entry.updatedAt || entry.createdAt).getTime();
      if (currentTime > lastSeenTime) {
        current.lastSeen = entry.updatedAt || entry.createdAt;
      }
      map.set(entry.email || entry.employee, current);
    });

    return Array.from(map.values()).sort((a, b) => b.forms - a.forms);
  }, [entries]);

  const latestVisibleActivity = entries[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<UserRound size={16} />}
          label="Employees tracked"
          value={String(new Set(entries.map((item) => item.email || item.employee)).size)}
          accent="bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400"
        />
        <StatCard
          icon={<FileText size={16} />}
          label="Active forms"
          value={String(entries.length)}
          accent="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
        />
        <StatCard
          icon={<Clock3 size={16} />}
          label="Latest activity"
          value={latestVisibleActivity ? formatDateTime(latestVisibleActivity.updatedAt || latestVisibleActivity.createdAt) : "—"}
          accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Activity size={16} className="text-primary" />
          <h2 className="font-semibold text-foreground">Employee activity audit</h2>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 p-5">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Employee summary
            </h3>
            {employeeStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">No employee activity yet.</p>
            ) : (
              <div className="space-y-2">
                {employeeStats.map((stat) => (
                  <div
                    key={stat.email || stat.employee}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-foreground">{stat.employee}</p>
                      <p className="text-xs text-muted-foreground">{stat.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">{stat.forms}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">forms</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recent activity
            </h3>
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No form activity recorded.</p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {entries.slice(0, 12).map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-border bg-secondary/20 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-foreground">{entry.employee}</p>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Sheet {entry.sheetNo || 0}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 size={12} />
                      <span>{entry.siteName}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Layers3 size={12} />
                      <span>{entry.categoryName}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText size={12} />
                      <span>{entry.formName}</span>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Last updated: {formatDateTime(entry.updatedAt || entry.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
      <span className={`inline-flex w-fit rounded-lg p-2 ${accent}`}>{icon}</span>
      <div className="text-lg font-bold font-tabular text-foreground">{value}</div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
