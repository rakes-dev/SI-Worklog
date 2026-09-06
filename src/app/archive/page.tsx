"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  FolderOpen,
  Search,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import AppLayout from "@/components/AppLayout";
import type { WorkForm } from "@/types";
import { currentMonth, formatCurrency, formatDate, monthLabel } from "@/utils/helpers";

export default function ArchivePage() {
  const router = useRouter();
  const { forms, sites, categories } = useAppStore();
  const { user, role } = useAuthStore();
  const [search, setSearch] = useState("");
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const filteredForms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return forms.filter((f) => {
      if (f.isDeleted) return false;
      if (role !== "admin" && f.ownerEmail !== user?.email) return false;
      if (q) {
        return (
          f.formName.toLowerCase().includes(q) ||
          f.siteName.toLowerCase().includes(q) ||
          f.empName.toLowerCase().includes(q) ||
          f.month.includes(q)
        );
      }
      return true;
    });
  }, [forms, search, role, user?.email]);

  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, typeof forms>();
    filteredForms.forEach((f) => {
      const month = f.month || "unknown";
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month)!.push(f);
    });
    groups.forEach((group) => {
      group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
    return groups;
  }, [filteredForms]);

  const sortedMonths = useMemo(() => {
    return Array.from(groupedByMonth.keys()).sort().reverse();
  }, [groupedByMonth]);

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  const expandAll = () => setExpandedMonths(new Set(sortedMonths));
  const collapseAll = () => setExpandedMonths(new Set());

  const getSiteName = (siteId: string) => sites.find((s) => s.id === siteId)?.name || "Unknown Site";
  const getCategoryName = (categoryId: string) => categories.find((c) => c.id === categoryId)?.name || "Unknown Category";

  return (
    <AppLayout>
      <div className="min-h-full p-4 lg:p-6 xl:p-8 pb-[calc(6rem_+_env(safe-area-inset-bottom))] lg:pb-8 max-w-screen-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">Sites</Link>
            <span>/</span>
            <span className="text-foreground font-medium">Archive</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <FolderOpen size={22} className="text-primary" />
            Form Archive
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Browse and edit forms from previous months</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="px-3 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">Expand All</button>
          <button onClick={collapseAll} className="px-3 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">Collapse All</button>
        </div>
      </div>

      <div className="relative mb-5 max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by form name, site, employee, or month..." className="w-full pl-9 pr-4 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition" />
      </div>

      <div className="mb-4 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg text-sm text-primary">
        💡 <strong>Current month ({monthLabel(currentMonth())})</strong> forms are shown on the Sites page by default. This archive contains all months.
      </div>

      {sortedMonths.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
            <FileText size={28} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground text-lg mb-1">
            {search ? "No forms match your search" : "No archived forms"}
          </h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            {search ? "Try adjusting your search terms." : "Forms from previous months will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedMonths.map((month) => (
            <MonthGroup key={month} month={month} forms={groupedByMonth.get(month) || []} isExpanded={expandedMonths.has(month)} onToggle={() => toggleMonth(month)} getSiteName={getSiteName} getCategoryName={getCategoryName} router={router} />
          ))}
        </div>
      )}
      </div>
    </AppLayout>
  );
}

function MonthGroup({ month, forms: monthForms, isExpanded, onToggle, getSiteName, getCategoryName, router }: {
  month: string;
  forms: WorkForm[];
  isExpanded: boolean;
  onToggle: () => void;
  getSiteName: (id: string) => string;
  getCategoryName: (id: string) => string;
  router: ReturnType<typeof useRouter>;
}) {
  const isCurrentMonth = month === currentMonth();
  const totalAmount = monthForms.reduce((s, f) => s + (f.grandTotal || 0), 0);
  const totalArea = monthForms.reduce((s, f) => s + (f.totalArea || 0), 0);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30 hover:bg-secondary/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            {isExpanded ? <ChevronDown size={18} className="text-primary" /> : <ChevronRight size={18} className="text-primary" />}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{monthLabel(month)}</span>
              {isCurrentMonth && <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">Current</span>}
            </div>
            <div className="text-sm text-muted-foreground">
              {monthForms.length} form{monthForms.length !== 1 ? "s" : ""} · ₹{formatCurrency(totalAmount)} · {totalArea.toFixed(2)} area
            </div>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="divide-y divide-border">
          {monthForms.map((form) => (
            <div key={form.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">{form.formName}</div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {getSiteName(form.siteId)} · {getCategoryName(form.categoryId)} · {form.empName}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(form.createdAt)} · ₹{formatCurrency(form.grandTotal)} · {form.totalArea.toFixed(2)} area
                </div>
              </div>
              <button onClick={() => router.push(`/form-editor?formId=${form.id}`)} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ml-4" title="View / Edit form">
                <Eye size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
