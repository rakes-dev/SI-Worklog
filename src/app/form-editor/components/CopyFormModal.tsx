"use client";

import React, { useState } from "react";
import { X, Copy, Loader2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import type { Job } from "@/types";

interface CopyFormModalProps {
  open: boolean;
  sourceJobId: string;
  formId: string;
  formName: string;
  jobs: Job[];
  onClose: () => void;
  onCopied: (targetJobName: string, newFormName: string) => void;
}

export default function CopyFormModal({
  open,
  sourceJobId,
  formId,
  formName,
  jobs,
  onClose,
  onCopied,
}: CopyFormModalProps) {
  const { copyFormToJob } = useAppStore();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const candidates = jobs
    .filter((j) => j.id !== sourceJobId)
    .sort((a, b) => (a.siteName || "").localeCompare(b.siteName || ""));

  const handleCopy = async () => {
    if (!targetId) {
      setErrorMsg("Please select a target job first.");
      return;
    }
    setCopying(true);
    setErrorMsg("");
    try {
      await copyFormToJob(sourceJobId, formId, targetId);
      const target = jobs.find((j) => j.id === targetId);
      onCopied(target?.siteName || "Job", `${formName} (Copy)`);
      setTargetId(null);
      onClose();
    } catch (error) {
      console.error("Copy form to job failed:", error);
      setErrorMsg("Copy failed. Please try again.");
    } finally {
      setCopying(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground text-lg">
              Copy Form to Another Job
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">
              {formName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No other jobs available to copy into.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {candidates.map((job) => {
                const selected = targetId === job.id;
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => {
                      setTargetId(job.id);
                      setErrorMsg("");
                    }}
                    className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-md border text-left transition-colors scale-press ${
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border hover:bg-secondary"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {job.siteName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {job.empName} · {job.forms?.length ?? 0} forms
                      </div>
                    </div>
                    <span
                      className={`shrink-0 w-4 h-4 rounded-full border ${
                        selected ? "border-primary bg-primary" : "border-border"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          )}

          {errorMsg && <p className="text-xs text-red-500 mt-3">{errorMsg}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md border border-border text-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCopy}
            disabled={copying || !targetId}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed scale-press"
          >
            {copying ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Copy size={14} />
            )}
            {copying ? "Copying..." : "Copy Form"}
          </button>
        </div>
      </div>
    </div>
  );
}
