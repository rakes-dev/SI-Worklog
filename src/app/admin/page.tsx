"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import AppLayout from "@/components/AppLayout";
import UserManagement from "./UserManagement";
import MasterSummary from "./MasterSummary";
import SiteCategoryManager from "./SiteCategoryManager";
import DataTools from "./DataTools";
import { formatCurrency, normalizeKey, currentMonth, monthLabel } from "@/utils/helpers";
import {
  Loader2,
  LogOut,
  Building2,
  FileText,
  IndianRupee,
  Users,
  ClipboardList,
  Layers,
  Ruler,
} from "lucide-react";

type Tab = "overview" | "manage" | "master" | "users";

const TAB_LABELS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Overview", icon: <ClipboardList size={15} /> },
  { key: "manage", label: "Sites & Categories", icon: <Building2 size={15} /> },
  { key: "master", label: "Master Summary", icon: <FileText size={15} /> },
  { key: "users", label: "Users", icon: <Users size={15} /> },
];
export default function AdminPage() {
  const router = useRouter();
  const { user, status, role, authorized, logOut } = useAuthStore();
    const { forms, sites, categories, isLoadingData } = useAppStore();
  const [tab, setTab] = useState<Tab>("overview");
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    forms.forEach((f) => {
      if (!f.isDeleted && f.month) months.add(f.month);
    });
    return Array.from(months).sort().reverse();
  }, [forms]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (availableMonths.length > 0) return currentMonth();
    return "";
  });

  useEffect(() => {
    // If the selected month is no longer available (e.g. after a refresh),
    // default to the current month or the first available.
    if (selectedMonth && !availableMonths.includes(selectedMonth)) {
      if (availableMonths.length > 0) {
        setSelectedMonth(availableMonths[0]);
      } else {
        setSelectedMonth("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableMonths]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  // Redirect non-admin non-viewer users who navigate here directly. The Sidebar
  // already hides the Admin link from them, but this guards the route itself.
  useEffect(() => {
    if (status === "authenticated" && role !== "admin" && role !== "admin_viewer") {
      router.replace("/");
    }
  }, [status, role, router]);

  // Restrict admin_viewer to the overview tab only.
  useEffect(() => {
    if (status === "authenticated" && role === "admin_viewer" && tab !== "overview") {
      setTab("overview");
    }
  }, [status, role, tab]);

    const activeForms = useMemo(() => {
    return forms.filter((f) => !f.isDeleted && (selectedMonth === "" || f.month === selectedMonth));
  }, [forms, selectedMonth]);
  const totalValue = activeForms.reduce((s, f) => s + (f.grandTotal ||0),0);

  const totalArea = activeForms.reduce((s, f) => s + (f.totalArea ||0),0);

  const siteStats = useMemo(() => {
    const map = new Map<string, { name: string; forms: number; value: number }>();
    activeForms.forEach((f) => {
      const key = f.siteId || normalizeKey(f.siteName);
      const cur = map.get(key) || { name: f.siteName || "—", forms:0, value:0 };
      cur.forms +=1;
      cur.value +=f.grandTotal ||0;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.forms - a.forms);
  }, [activeForms]);

  const empStats = useMemo(() => {
    const map = new Map<string, { name: string; forms: number; value: number }>();
    activeForms.forEach((f) => {
      const name = f.empName?.trim() || "Unassigned";
      const cur = map.get(name) || { name, forms:0, value:0 };
      cur.forms +=1;
      cur.value +=f.grandTotal ||0;
      map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.forms - a.forms);
  }, [activeForms]);

  const catStats = useMemo(() => {
    const map = new Map<string, { name: string; forms: number; value: number }>();
    activeForms.forEach((f) => {
      const cat = categories.find((c) => c.id === f.categoryId);
      const name = cat?.name || "Unsorted";
      const key = cat?.id || name;
      const cur = map.get(key) || { name, forms:0, value:0 };
      cur.forms +=1;
      cur.value +=f.grandTotal ||0;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.forms - a.forms);
  }, [activeForms, categories]);

  const chartData = useMemo(() => {
    const days: { label: string; forms: number }[] = [];
    for (let i = -29; i <=0; i++) {
      const d = new Date();
      d.setHours(0,0,0,0);
      d.setDate(d.getDate() + i);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      const dayForms = activeForms.filter((f) => {
        const fd = new Date(f.createdAt);
        fd.setHours(0,0,0,0);
        return fd.getTime() === d.getTime();
      }).length;
      days.push({ label, forms: dayForms });
    }
    return days;
  }, [activeForms]);
if (isLoadingData) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 size={32} className="animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading data…</span>
        </div>
      </AppLayout>
    );
  }

  if (status !== "authenticated") {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-full p-4 lg:p-6 xl:p-8 pb-[calc(6rem_+_env(safe-area-inset-bottom))] lg:pb-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">
              Sites
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Admin</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Layers size={22} className="text-primary" />
            Admin Panel
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {user?.email} · {activeForms.length} forms · ₹{formatCurrency(totalValue)}
          </p>
        </div>
        <button
          onClick={logOut}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TAB_LABELS
          .filter((t) => role === "admin_viewer" ? t.key === "overview" : true)
          .map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
{tab === "overview" && (
        <>
                  {/* Month filter */}
        <div className="mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-foreground">Filter by month:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All time</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
              {availableMonths.length === 0 && <option value={currentMonth()}>{monthLabel(currentMonth())} (current)</option>}
            </select>
            {selectedMonth && selectedMonth !== currentMonth() && (
              <button
                onClick={() => setSelectedMonth(currentMonth())}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Reset to current month
              </button>
            )}
          </div>
        </div>

        {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
            <StatCard
              icon={<FileText size={16} />}
              label="Forms"
              value={String(activeForms.length)}
              accent="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
            />
            <StatCard
              icon={<IndianRupee size={16} />}
              label="Total Value"
              value={`₹${formatCurrency(totalValue)}`}
              accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
            />
            <StatCard
              icon={<Ruler size={16} />}
              label="Total Area"
              value={`${totalArea.toFixed(2)}`}
              accent="bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
            />
            <StatCard
              icon={<Building2 size={16} />}
              label="Sites"
              value={String(sites.filter((s) => s.isActive).length)}
              accent="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
            />
            <StatCard
              icon={<ClipboardList size={16} />}
              label="Categories"
              value={String(categories.filter((c) => c.isActive).length)}
              accent="bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400"
            />
            <StatCard
              icon={<Users size={16} />}
              label="Employees"
              value={String(empStats.length)}
              accent="bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"
            />
          </div>


          <div className="bg-card border border-border rounded-xl p-5 mb-6">
            <h2 className="font-semibold text-foreground">Forms — Last 30 Days</h2>
            <div className="h-[220px] mt-4">
              {chartData.some((d) => d.forms > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="forms" fill="#2563EB" radius={[3, 3, 0, 0]} name="Forms" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No forms yet. Please create a form from a site category first.
                </div>
              )}
            </div>

          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BreakdownTable title="Site Breakdown" rows={siteStats} />
            <BreakdownTable title="Employee Breakdown" rows={empStats} />
          </div>
          <div className="mt-6">
            <BreakdownTable title="Category Breakdown" rows={catStats} />
          </div>
        </>)}

      {tab === "manage" && <SiteCategoryManager />}
      {tab === "master" && <MasterSummary />}
      {tab === "users" && <UserManagement />}
      {tab === "overview" && <DataTools showBackup />}
      </div>
    </AppLayout>
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
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <span className={`inline-flex p-2 rounded-lg w-fit ${accent}`}>{icon}</span>
      <span className="text-lg font-bold font-tabular text-foreground truncate">{value}</span>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  );
}

function BreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; forms: number; value: number }[];
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Forms and value per grouping</p>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-muted-foreground text-sm">
          No data yet.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</th>
              <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Forms</th>
              <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-border last:border-0">
                <td className="px-5 py-2.5 text-foreground truncate max-w-[240px]">{r.name}</td>
                <td className="px-5 py-2.5 text-right font-tabular text-foreground">{r.forms}</td>
                <td className="px-5 py-2.5 text-right font-tabular font-semibold text-primary">
                  ₹{formatCurrency(r.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
