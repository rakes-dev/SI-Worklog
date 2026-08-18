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
  Cell,
} from "recharts";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import UserManagement from "./UserManagement";
import { formatCurrency } from "@/utils/helpers";
import {
  Loader2,
  LogOut,
  ArrowLeft,
  LayoutDashboard,
  FileText,
  Briefcase,
  Building2,
  Users,
} from "lucide-react";

type Timeline = "day" | "week" | "month";
const TIMELINES: { key: Timeline; label: string }[] = [
  { key: "day", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];
const BAR_COLORS = [
  "#2563EB",
  "#16A34A",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#EC4899",
  "#84CC16",
];

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function startOfWeek(): number {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d.getTime();
}
function isSameMonth(ts: number): boolean {
  const d = new Date(ts),
    n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}
function inTimeline(ts: number, t: Timeline): boolean {
  if (t === "day") return ts >= startOfToday();
  if (t === "week") return ts >= startOfWeek();
  return isSameMonth(ts);
}

export default function AdminPage() {
  const router = useRouter();
  const { user, status, role, logOut } = useAuthStore();
  const { jobs, loadJobs } = useAppStore();

  const [location, setLocation] = useState<string>("all");
  const [timeline, setTimeline] = useState<Timeline>("day");
  const [tab, setTab] = useState<"overview" | "users">("overview");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    loadJobs().catch(() => {});
  }, [loadJobs]);

  const metrics = useMemo(() => {
    const all = jobs.length
      ? jobs.flatMap((j) =>
          (j.forms || []).map((f) => ({
            form: f,
            job: j,
            ts: new Date(f.createdAt || j.createdAt).getTime() || 0,
          })),
        )
      : [];

    const locations = Array.from(
      new Set(
        jobs.map((j) => j.siteAddress?.trim() || j.siteName).filter(Boolean),
      ),
    ).sort();

    const filtered =
      location === "all"
        ? all
        : all.filter(
            (x) => (x.job.siteAddress?.trim() || x.job.siteName) === location,
          );

    const totalValue = filtered.reduce(
      (s, x) => s + (x.form.grandTotal || 0),
      0,
    );

    const emp = new Map<string, { forms: number; value: number }>();
    filtered.forEach((x) => {
      const name = x.job.empName?.trim() || "Unassigned";
      const cur = emp.get(name) || { forms: 0, value: 0 };
      cur.forms += 1;
      cur.value += x.form.grandTotal || 0;
      emp.set(name, cur);
    });
    const employeeStats = Array.from(emp.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.value - a.value);

    const locMap = new Map<string, { forms: number; value: number }>();
    all.forEach((x) => {
      const name = x.job.siteAddress?.trim() || x.job.siteName || "—";
      const cur = locMap.get(name) || { forms: 0, value: 0 };
      cur.forms += 1;
      cur.value += x.form.grandTotal || 0;
      locMap.set(name, cur);
    });
    const locationByValue = Array.from(locMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.value - a.value);

    const timelineFormsArr = filtered.filter((x) => inTimeline(x.ts, timeline));
    const timelineValue = timelineFormsArr.reduce(
      (s, x) => s + (x.form.grandTotal || 0),
      0,
    );

    return {
      locations,
      filteredForms: filtered.length,
      totalValue,
      employeeStats,
      locationByValue,
      timelineForms: timelineFormsArr.length,
      timelineValue,
    };
  }, [jobs, location, timeline]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (status !== "authenticated" || !user) return null;

  if (role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="text-5xl mb-4">🛡️</div>
        <h1 className="text-xl font-semibold text-foreground">
          Admin Access Required
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          You are signed in as {user?.email}, but your account is not an admin.
          Only admins can view this dashboard.
        </p>
        <div className="flex items-center gap-2 mt-5">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft size={15} /> Back to app
          </Link>
          <button
            onClick={logOut}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </div>
    );
  }

  const {
    locations,
    filteredForms,
    totalValue,
    employeeStats,
    locationByValue,
    timelineForms,
    timelineValue,
  } = metrics;

  return (
    <div className="min-h-screen bg-background p-4 lg:p-6 xl:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">
              App
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Admin Dashboard</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <LayoutDashboard size={22} /> Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {user?.email || user?.displayName || "Signed in"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft size={15} /> App
          </Link>
          <button
            onClick={logOut}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </div>

      {/* Section nav */}
      <div className="flex items-center gap-1 bg-card border border-border rounded-md p-1 w-fit mb-5">
        <button
          onClick={() => setTab("overview")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === "overview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
        >
          <span className="flex items-center gap-1.5">
            <LayoutDashboard size={15} /> Overview
          </span>
        </button>
        <button
          onClick={() => setTab("users")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === "users" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
        >
          <span className="flex items-center gap-1.5">
            <Users size={15} /> User Management
          </span>
        </button>
      </div>

      {tab === "overview" && (
        <>
          {/* Location filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-muted-foreground" />
              <label className="text-sm font-medium text-foreground">
                Location:
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All locations</option>
                {locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1 bg-card border border-border rounded-md p-1">
              {TIMELINES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTimeline(t.key)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${timeline === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<FileText size={18} />}
              label={`Forms (${TIMELINES.find((t) => t.key === timeline)?.label.toLowerCase()})`}
              value={`${timelineForms}`}
              sub={`${formatCurrency(timelineValue)} value`}
              accent="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            />
            <StatCard
              icon={<Briefcase size={18} />}
              label="Total Forms"
              value={`${filteredForms}`}
              sub="across this filter"
              accent="bg-violet-500/10 text-violet-600 dark:text-violet-400"
            />
            <StatCard
              icon={<Building2 size={18} />}
              label="Total Value"
              value={`₹${formatCurrency(totalValue)}`}
              sub={location === "all" ? "all locations" : location}
              accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              icon={<Users size={18} />}
              label="Employees"
              value={`${employeeStats.length}`}
              sub="employees in view"
              accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-1">
                Value by Location
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Total form value per site
              </p>
              {locationByValue.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={locationByValue}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      height={54}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v: number | string) => [
                        `₹${formatCurrency(Number(v))}`,
                        "Value",
                      ]}
                    />
                    <Bar dataKey="value">
                      {locationByValue.map((_, i) => (
                        <Cell
                          key={i}
                          fill={BAR_COLORS[i % BAR_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-1">
                Forms Done By
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Number of forms per employee
              </p>
              {employeeStats.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={employeeStats}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      height={54}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar
                      dataKey="forms"
                      fill="#2563EB"
                      name="Forms"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Employee breakdown table */}
          <div className="bg-card border border-border rounded-xl mt-6 overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">
                Employee Breakdown
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Forms and value per employee in the current filter
              </p>
            </div>
            {employeeStats.length === 0 ? (
              <div className="px-5 py-10 text-center text-muted-foreground text-sm">
                No data yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Employee
                    </th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Forms
                    </th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {employeeStats.map((e) => (
                    <tr
                      key={e.name}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-5 py-2.5 text-foreground">{e.name}</td>
                      <td className="px-5 py-2.5 text-right font-tabular text-foreground">
                        {e.forms}
                      </td>
                      <td className="px-5 py-2.5 text-right font-tabular font-semibold text-primary">
                        ₹{formatCurrency(e.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === "users" && <UserManagement />}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className={`inline-flex p-2.5 rounded-lg mb-3 ${accent}`}>
        {icon}
      </div>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className="text-2xl font-bold font-tabular text-foreground mt-1">
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-1 truncate">{sub}</div>
    </div>
  );
}

function Empty() {
  return (
    <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
      No data available.
    </div>
  );
}
