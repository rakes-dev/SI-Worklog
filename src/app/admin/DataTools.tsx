"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  DatabaseBackup,
  Download,
  FileUp,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { dbService } from "@/services/db";
import { useAppStore } from "@/store/useAppStore";
import ToastContainer from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { downloadJSON } from "@/utils/helpers";

interface DataToolsProps {
  showBackup?: boolean;
}

export default function DataTools({ showBackup = true }: DataToolsProps) {
  const { loadAll } = useAppStore();
  const { toasts, addToast, removeToast } = useToast();
  const [busy, setBusy] = useState<"export" | "import" | "migrate" | null>(null);

  const handleExport = async () => {
    setBusy("export");
    try {
      const data = await dbService.exportAllForms();
      downloadJSON(data, `si-worklog-forms-backup-${Date.now()}.json`);
      addToast("success", "Backup complete", "All forms saved as JSON.");
    } catch (error) {
      console.error("Export failed:", error);
      addToast("error", "Export failed", "Could not export forms.");
    } finally {
      setBusy(null);
    }
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setBusy("import");
      try {
        const text = await file.text();
        const result = await dbService.importForms(text);
        await loadAll();
        addToast(
          result.errors > 0 ? "warning" : "success",
          `Imported ${result.imported} forms`,
          result.errors > 0 ? `${result.errors} entries skipped.` : "Backup restored.",
        );
      } catch (error) {
        console.error("Import failed:", error);
        addToast("error", "Import failed", "Not a valid backup file.");
      } finally {
        setBusy(null);
      }
    };
    input.click();
  };

  const handleMigrate = async () => {
    if (!window.confirm(
      "This copies every form inside the old 'jobs' collection into the new 'forms' collection. " +
        "The old jobs are never deleted — they remain as a backup. Continue?",
    )) return;
    setBusy("migrate");
    try {
      const result = await dbService.migrateLegacyJobs();
      await loadAll();
      addToast(
        "success",
        "Migration complete",
        `${result.migrated} forms migrated (${result.totalForms} total, ${result.skipped} jobs skipped).`,
      );
    } catch (error) {
      console.error("Migration failed:", error);
      addToast("error", "Migration failed", "Admins only — check the Firestore rules allow reading 'jobs'.");
    } finally {
      setBusy(null);
    }
  };

  if (!showBackup) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 mt-6">
      <div className="flex items-center gap-2 mb-1">
        <DatabaseBackup size={17} className="text-primary" />
        <h2 className="font-semibold text-foreground">Data Tools</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Backup your forms to JSON, restore from a backup, or migrate the legacy
        "jobs" collection into the new per-form model. Nothing is ever deleted automatically.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleExport}
          disabled={busy !== null}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-60"
        >
          {busy === "export" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Export Backup (JSON)
        </button>

        <button
          onClick={handleImport}
          disabled={busy !== null}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-60"
        >
          {busy === "import" ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
          Restore from Backup
        </button>

        <button
          onClick={handleMigrate}
          disabled={busy !== null}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800 transition-colors disabled:opacity-60"
        >
          {busy === "migrate" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
          Migrate Legacy Jobs → Forms
        </button>
      </div>

      <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
        <AlertTriangle size={12} className="flex-shrink-0" />
        The old "jobs" documents stay untouched — they are the safety net for the migration.
      </p>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}