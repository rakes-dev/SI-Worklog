"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  ChevronLeft,
  Save,
  Printer,
  Loader2,
  FileText,
  FileDown,
  AlertCircle,
  CheckCircle2,
  Copy,
  Files,
} from "lucide-react";
import Link from "next/link";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { dbService } from "@/services/db";
import type {
  Job,
  PaintForm,
  SummaryRow,
  MeasurementRow,
  FormSignatures,
  ArcItem,
  WorkForm,
} from "@/types";
import {
  calcGrandTotal,
  calcTotalArea,
  aggregateAreaUnitLabel,
  defaultForm,
  generateId,
  syncSummaryRowsWithMeasurements,
} from "@/utils/helpers";
import FormTopFields from "./FormTopFields";
import SummaryTable from "./SummaryTable";
import MeasurementTable from "./MeasurementTable";
import SignatureSection from "./SignatureSection";
import PrintLayout from "./PrintLayout";
import PdfExportLayout from "./PdfExportLayout";
import CopyFormModal from "./CopyFormModal";
import { exportPrintLayoutToPdf } from "@/utils/pdfExport";
import { isNativeApp } from "@/utils/nativePdf";
import ToastContainer from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function FormEditorClient() {
  const params = useSearchParams();
  const router = useRouter();
  const { forms, sites, categories, createForm, updateForm, duplicateForm } =
    useAppStore();
  const { user } = useAuthStore();
  const { toasts, addToast, removeToast } = useToast();

  const formId = params.get("formId") ?? "";
  const printMode = params.get("print") === "1";

  const existingForm = forms.find((f) => f.id === formId && !f.isDeleted);
const site = existingForm ? sites.find((s) => s.id === existingForm.siteId) : undefined;
  const category = existingForm
    ? categories.find((c) => c.id === existingForm.categoryId)
    : undefined;

  // Job-shaped object for PrintLayout/PdfExportLayout — they only read the site/
  // employee header fields, so the denormalized WorkForm fields keep the printed
  // output byte-for-byte identical with the legacy layout.


  const job: Job | null = existingForm
    ? {
        id: existingForm.siteId,
        empName: existingForm.empName || "",
        siteName: existingForm.siteName || "",
        siteAddress: existingForm.siteAddress || "",
        remarks: category?.name ?? "",
        forms: [existingForm],
        totalAmount: existingForm.grandTotal || 0,
        userId: existingForm.ownerEmail,
        createdAt: existingForm.createdAt,
        updatedAt: existingForm.updatedAt,
      }
    : null;

  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([]);
  const [measurementRows, setMeasurementRows] = useState<MeasurementRow[]>([]);
  const [signatures, setSignatures] = useState<FormSignatures | null>(null);
  const [grandTotal, setGrandTotal] = useState(0);
  const [totalArea, setTotalArea] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [arcItems, setArcItems] = useState<ArcItem[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // Auto-save state lives in refs so the debounced save never re-triggers
  // itself through render-induced churn: the pending timer, the "last saved"
  // comparison key and the in-flight flag are all read from the latest render.
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedKeyRef = useRef("");
  const autoSavingRef = useRef(false);
  const saveStateRef = useRef<SaveState>("idle");
  const initialLoadCompleteRef = useRef(false);
  const printLayoutRef = useRef<HTMLDivElement>(null);
  const pdfExportRef = useRef<HTMLDivElement>(null);

  const syncedSummaryRows = useMemo(
    () => syncSummaryRowsWithMeasurements(summaryRows, measurementRows),
    [summaryRows, measurementRows],
  );

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isDirty },
  } = useForm<PaintForm>({
    defaultValues: existingForm ?? defaultForm(site?.name ?? "New Form", 1),
  });

  // Fetch ARC items for autocomplete
  useEffect(() => {
    dbService
      .getAllArcItems()
      .then(setArcItems)
      .catch((err) =>
        console.warn("Could not load ARC items for autocomplete:", err),
      );
  }, []);

  // Support creating a new form directly from `?siteId=&categoryId=` — used by the
  // category page (which normally creates first and redirects) and as a safe
  // fallback for deep links straight into the editor.

  const creatingNewRef = useRef(false);
  const [creatingNew, setCreatingNew] = useState(false);
  useEffect(() => {
    if (existingForm || creatingNewRef.current) return;
    const siteId = params.get("siteId");
    const categoryId = params.get("categoryId");
    if (!siteId || !categoryId || !user?.email) return;
    const s = sites.find((x) => x.id === siteId);
    const c = categories.find((x) => x.id === categoryId);
    if (!s || !c) return;
    creatingNewRef.current = true;
    setCreatingNew(true);
    createForm({
      site: s,
      category: c,
      ownerEmail: user.email.trim().toLowerCase(),
      empName: user.displayName || user.email,
    })
      .then((f) => router.replace(`/form-editor?formId=${f.id}`))
      .catch((error) => {
        console.error("Create form failed:", error);
        addToast("error", "Create failed", "Could not create the form. Please try again.");
        creatingNewRef.current = false;
        setCreatingNew(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingForm, sites, categories, params, router, user, createForm]);

  // Initialize state from existing or default form
  useEffect(() => {
    if (initialized) return;
    const src = existingForm ?? defaultForm(site?.name ?? "New Form", 1);
    initialLoadCompleteRef.current = false;
    setHasUnsavedChanges(false);
    setSummaryRows(src.summaryRows);
    setMeasurementRows(src.measurementRows);
    setSignatures(src.signatures);
    setGrandTotal(src.grandTotal);
    setTotalArea(src.totalArea);
    reset(src);
    setInitialized(true);
  }, [existingForm, site, initialized, reset]);

  useEffect(() => {
    if (!initialized) return;
    if (!initialLoadCompleteRef.current) {
      initialLoadCompleteRef.current = true;
      return;
    }
    setHasUnsavedChanges(true);
  }, [initialized, isDirty, summaryRows, measurementRows, signatures]);

  // Recalculate totals when rows change
  useEffect(() => {
    setGrandTotal(calcGrandTotal(syncedSummaryRows));
  }, [syncedSummaryRows]);

  useEffect(() => {
    setTotalArea(calcTotalArea(measurementRows));
  }, [measurementRows]);

  // Auto-print if printMode
  useEffect(() => {
    if (printMode && initialized) {
      // window.print() is a no-op inside the native WebView — the user prints
      // via the Print button (which opens the share sheet) instead.
      if (!isNativeApp()) {
        setTimeout(() => window.print(), 500);
      }
    }
  }, [printMode, initialized]);

  const buildFormData = useCallback(
    (values: PaintForm): WorkForm => ({
      ...(existingForm as WorkForm),
      ...values,
      id: existingForm?.id ?? generateId("form"),
      summaryRows: syncedSummaryRows,
      measurementRows,
      signatures: signatures!,
      grandTotal: calcGrandTotal(syncedSummaryRows),
      totalArea: calcTotalArea(measurementRows),
      updatedAt: new Date().toISOString(),
      createdAt: existingForm?.createdAt ?? new Date().toISOString(),
    }),
    [syncedSummaryRows, measurementRows, signatures, existingForm],
  );

  // --- Auto-save -----------------------------------------------------------
  // Keeps the save-state ref and UI state in sync so delayed "idle" resets only
  // fire for the state they were scheduled for (a later error won't be cleared
  // by an older "saved" reset).
  const setNextSaveState = useCallback((next: SaveState) => {
    saveStateRef.current = next;
    setSaveState(next);
  }, []);

  // A "save key" captures every field that matters but intentionally EXCLUDES
  // the volatile `updatedAt`/`createdAt` timestamps that buildFormData stamps
  // on EVERY call — otherwise the string comparison below would never match and
  // the editor would keep re-saving forever even when nothing changed.
  const buildSaveKey = useCallback((formData: WorkForm): string => {
    const keyForm: Partial<WorkForm> = { ...formData };
    delete keyForm.updatedAt;
    delete keyForm.createdAt;
    return JSON.stringify({
      formData: keyForm,
      summaryRows: formData.summaryRows,
      measurementRows: formData.measurementRows,
    });
  }, []);

  // Key for whatever the user is currently looking at (live field values + the
  // synced rows). Used by both the debounced saver and the flush-on-exit paths.
  const currentSaveKey = useCallback((): string => {
    const values = getValues();
    return buildSaveKey(buildFormData(values));
  }, [getValues, buildFormData, buildSaveKey]);

  // Persists right now if anything has changed since the last successful save.
  // Safe to call from anywhere: it dedupes against lastSavedKeyRef and never
  // starts a second write while one is already in flight.
  const flushAutoSave = useCallback(async (): Promise<void> => {
    if (autoSavingRef.current || !initialized || !existingForm || !signatures) {
      return;
    }
    const key = currentSaveKey();
    if (key === lastSavedKeyRef.current) return;

    autoSavingRef.current = true;
    setNextSaveState("saving");
    try {
      const values = getValues();
      const formData = buildFormData(values);
      await updateForm(formData);
      lastSavedKeyRef.current = key;
      // If the user kept typing while the write was in flight, keep the dirty
      // flag so the debounce effect schedules the follow-up save.
      if (currentSaveKey() === key) {
        setHasUnsavedChanges(false);
      }
      setNextSaveState("saved");
      setTimeout(() => {
        if (saveStateRef.current === "saved") setNextSaveState("idle");
      }, 2000);
    } catch (error) {
      console.error("Auto-save failed:", error);
      setNextSaveState("error");
      setTimeout(() => {
        if (saveStateRef.current === "error") setNextSaveState("idle");
      }, 3000);
    } finally {
      autoSavingRef.current = false;
    }
  }, [
    initialized,
    existingForm,
    signatures,
    currentSaveKey,
    getValues,
    buildFormData,
    updateForm,
  ]);

  // Debounce: 2s after the latest change, persist. Each change resets the
  // timer and the effect's cleanup clears it when the editor re-renders or
  // unmounts — no stale timers can fire after a save has landed.
  useEffect(() => {
    if (!initialized || !existingForm || !signatures || !hasUnsavedChanges)
      return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      void flushAutoSave();
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, existingForm, signatures, hasUnsavedChanges, flushAutoSave]);

  // Flush pending edits when the component unmounts (in-app navigation) so the
  // last window of typing is never silently dropped.
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      if (!autoSavingRef.current && lastSavedKeyRef.current !== currentSaveKey()) {
        void flushAutoSave();
      }
    };
  }, [currentSaveKey, flushAutoSave]);

  // Best-effort flush for tab/window/webview close. A fetch started here may or
  // may not complete before teardown, but it covers the common navigation cases.
  useEffect(() => {
    const onPageHide = () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      if (!autoSavingRef.current && lastSavedKeyRef.current !== currentSaveKey()) {
        void flushAutoSave();
      }
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [currentSaveKey, flushAutoSave]);

  const handleDuplicateForm = async () => {
    if (!existingForm) return;
    try {
      const copy = await duplicateForm(formId);
      if (copy) {
        addToast("success", "Form duplicated", `"${copy.formName}" created.`);
      }
    } catch (error) {
      console.error("Duplicate form failed:", error);
      addToast("error", "Duplicate failed", "Could not duplicate the form.");
    }
  };

  const onSubmit = async (values: PaintForm) => {
    if (!existingForm || !signatures) return;
    setSaveState("saving");
    try {
      const formData = buildFormData(values);
      await updateForm(formData);
      lastSavedKeyRef.current = buildSaveKey(formData);
      setHasUnsavedChanges(false);
      setSaveState("saved");
      addToast("success", "Form saved", "All changes saved successfully.");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch (error) {
      console.error("Save failed:", error);
      setSaveState("error");
      addToast(
        "error",
        "Save failed",
        "Could not save form. Please check your connection and try again.",
      );
    }
  };

  const sanitizeFileName = (s: string) =>
    s
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, " ")
      .trim();

  /** Render the hidden A4 PDF layout and deliver it (download / share sheet). */
  const generateFormPdf = async (
    formName: string,
  ): Promise<"downloaded" | "shared" | "printed" | null> => {
    const root = pdfExportRef.current;
    if (!root || !existingForm) return null;
    const siteName = sanitizeFileName(existingForm.siteName || "Job");
    const name = sanitizeFileName(formName);
    return exportPrintLayoutToPdf(root, `${siteName} - ${name}`);
  };

  const handlePrint = async (values: PaintForm) => {
    if (!existingForm || !signatures) return;
    setSaveState("saving");
    try {
      // Save first, then print
      const formData = buildFormData(values);
      await updateForm(formData);
      lastSavedKeyRef.current = buildSaveKey(formData);
      setHasUnsavedChanges(false);
      setSaveState("saved");
      addToast("success", "Form saved", "Saved before printing.");
      setTimeout(() => setSaveState("idle"), 2000);

      if (isNativeApp()) {
        // window.print() does nothing in the native WebView — render the same
        // A4 PDF and hand it to the OS print framework. On Android this opens
        // the system print dialog (every installed printer service + "Save as
        // PDF"); iOS falls back to the share sheet, which includes Print.
        const formName =
          existingForm?.formName || formData.formName || "Form";
        const root = pdfExportRef.current;
        if (!root) {
          addToast(
            "error",
            "Print failed",
            "Print layout is not ready yet. Please try again.",
          );
          return;
        }
        const siteName = sanitizeFileName(existingForm.siteName || "Job");
        const name = sanitizeFileName(formName);
        const delivered = await exportPrintLayoutToPdf(
          root,
          `${siteName} - ${name}`,
          "print",
        );
        if (delivered === "printed") {
          addToast(
            "success",
            "Print dialog opened",
            "Choose a printer or Save as PDF.",
          );
        } else {
          addToast(
            "success",
            "PDF ready",
            "Choose Print (or Save) from the share sheet.",
          );
        }
      } else {
        window.print();
      }
    } catch (error) {
      console.error("Save before print failed:", error);
      setSaveState("error");
      addToast(
        "error",
        "Save failed",
        "Could not save before printing. Please try again.",
      );
    }
  };

  const handleExportPdf = async (values: PaintForm) => {
    if (!existingForm || !signatures) return;
    setExportingPdf(true);
    try {
      // Save first so the exported PDF reflects the latest data.
      const formData = buildFormData(values);
      await updateForm(formData);
      lastSavedKeyRef.current = buildSaveKey(formData);
      setHasUnsavedChanges(false);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);

      const formName =
        existingForm?.formName || formData.formName || "Form";
      const delivered = await generateFormPdf(formName);
      if (delivered === "downloaded") {
        addToast("success", "PDF exported", `"${formName}" exported as PDF.`);
      } else if (delivered === "shared") {
        addToast(
          "success",
          "PDF ready",
          `"${formName}" saved — print or share it from the sheet.`,
        );
      } else {
        addToast(
          "error",
          "Export failed",
          "Print layout is not ready yet. Please try again.",
        );
      }
    } catch (error) {
      console.error("Export PDF failed:", error);
      addToast("error", "Export failed", "Could not export the form to PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  if (creatingNew) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Creating form...</p>
        </div>
      </div>
    );
  }

  if (!existingForm) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <AlertCircle size={40} className="text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Form not found
        </h2>
        <p className="text-muted-foreground text-sm mb-5">
          This form could not be found. It may have been deleted or the link is invalid.
        </p>
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <ChevronLeft size={16} />
          Back to Sites
        </Link>
      </div>
    );
  }

  if (!initialized || !signatures) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading form...</p>
        </div>
      </div>
    );
  }

  // `job` is non-null here because `!existingForm` returned above.
  const jobForPrint: Job = job as Job;

  // Reconstruct current form for print
  const currentFormForPrint: PaintForm = {
    ...(existingForm ?? defaultForm(site?.name ?? "New Form", 1)),
    suitPublicAreaName: "",
    summaryRows: syncedSummaryRows,
    measurementRows,
    signatures,
    grandTotal: calcGrandTotal(syncedSummaryRows),
    totalArea,
  };
  const formValues = getValues();
  if (formValues.suitPublicAreaName) {
    currentFormForPrint.suitPublicAreaName = formValues.suitPublicAreaName;
  }
  if (formValues.date) {
    currentFormForPrint.date = formValues.date;
  }
  if (formValues.sheetNo) {
    currentFormForPrint.sheetNo = formValues.sheetNo;
  }

  return (
    <>
      {/* Print-only layout */}
      <div className="print-layout" ref={printLayoutRef}>
        <PrintLayout form={currentFormForPrint} job={jobForPrint} />
      </div>

      {/* PDF-export-only layout (hidden on screen; captured by exportPrintLayoutToPdf) */}
      <div className="pdf-export-layout" ref={pdfExportRef}>
        <PdfExportLayout form={currentFormForPrint} job={jobForPrint} />
      </div>

      {/* Screen layout */}
      <div className="no-print min-h-full p-4 lg:p-6 xl:p-8 pb-[calc(8rem_+_env(safe-area-inset-bottom))] lg:pb-8 max-w-screen-2xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Link
                href="/"
                className="hover:text-foreground transition-colors"
              >
                Sites
              </Link>
              <span>/</span>
              <Link
                href={`/site/${existingForm.siteId}`}
                className="hover:text-foreground transition-colors"
              >
                {site?.name ?? existingForm.siteName}
              </Link>
              <span>/</span>
              <span className="text-foreground font-medium">
                {existingForm?.formName ?? "New Form"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-foreground">
                {existingForm?.formName ?? "New Standard Interior Form"}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {existingForm.empName} · {existingForm.siteAddress}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => router.push(`/site/${existingForm.siteId}/category/${existingForm.categoryId}`)}
              title="Back to category"
              className="p-2.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors scale-press"
            >
              <ChevronLeft size={16} />
            </button>

            {existingForm && (
              <>
                <button
                  type="button"
                  onClick={handleDuplicateForm}
                  title="Duplicate form"
                  className="p-2.5 rounded-md border border-border text-foreground hover:bg-secondary transition-colors scale-press"
                >
                  <Copy size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setCopyModalOpen(true)}
                  title="Copy to another site"
                  className="p-2.5 rounded-md border border-border text-foreground hover:bg-secondary transition-colors scale-press"
                >
                  <Files size={16} />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleSubmit(handlePrint)}
              title="Print A4"
              className="p-2.5 rounded-md border border-border text-foreground hover:bg-secondary transition-colors scale-press"
            >
              <Printer size={16} />
            </button>

            <button
              type="button"
              onClick={handleSubmit(handleExportPdf)}
              disabled={exportingPdf}
              title={exportingPdf ? "Exporting..." : "Export PDF"}
              className="p-2.5 rounded-md border border-border text-foreground hover:bg-secondary transition-colors scale-press disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {exportingPdf ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <FileDown size={16} />
              )}
            </button>

            <button
              type="submit"
              disabled={saveState === "saving"}
              title={
                saveState === "saving"
                  ? "Saving..."
                  : saveState === "saved"
                  ? "Saved"
                  : "Save Form"
              }
              className="p-2.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity scale-press disabled:opacity-60"
            >
              {saveState === "saving" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : saveState === "saved" ? (
                <CheckCircle2 size={16} />
              ) : (
                <Save size={16} />
              )}
            </button>
          </div>
        </div>

        {/* Save status banner */}
        {saveState === "error" && (
          <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            <AlertCircle size={15} />
            Couldn't save your changes — check your connection, then press "Save Form" to retry.
          </div>
        )}
        {hasUnsavedChanges && saveState === "idle" && (
          <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
            <AlertCircle size={15} />
            Auto-save is on — your changes will be saved automatically in a moment.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          {/* Top Fields */}
          <FormTopFields register={register} errors={errors} />

          {/* Section A — Summary */}
          <SummaryTable
            rows={syncedSummaryRows}
            onChange={(rows) => setSummaryRows(rows)}
            grandTotal={grandTotal}
            arcItems={arcItems}
            formType={existingForm?.formType ?? "painting"}
          />

          {/* Section B — Measurement Sheet */}
          <MeasurementTable
            rows={measurementRows}
            onChange={(rows) => setMeasurementRows(rows)}
            totalArea={totalArea}
            arcItems={arcItems}
            formType={existingForm?.formType ?? "painting"}
          />

          {/* Signatures */}
          <SignatureSection />

          {/* Sticky Save Bar */}
          <div className="fixed bottom-[calc(3.5rem_+_env(safe-area-inset-bottom))] lg:bottom-0 left-0 right-0 lg:left-sidebar lg:left-sidebar-collapsed bg-card border-t border-border px-3 pt-2 pb-2 flex items-center justify-between gap-2 z-20 no-print">
            <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
              <FileText size={14} className="text-muted-foreground shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold font-tabular text-foreground">
                  ₹
                  {grandTotal.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </span>
                <span className="text-muted-foreground hidden sm:inline whitespace-nowrap">
                  {" "}· {totalArea.toFixed(2)}{" "}
                  {aggregateAreaUnitLabel(measurementRows.map((r) => r.uom))}
                </span>
              </span>
              {saveState === "saving" && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Loader2 size={12} className="animate-spin" />
                  Saving…
                </span>
              )}
              {saveState === "saved" && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 shrink-0">
                  <CheckCircle2 size={12} />
                  Saved
                </span>
              )}
              {saveState === "error" && (
                <span className="inline-flex items-center gap-1 text-xs text-red-500 shrink-0">
                  <AlertCircle size={12} />
                  Save failed
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSubmit(handlePrint)}
                title="Print A4"
                className="p-2 rounded-md border border-border text-foreground hover:bg-secondary transition-colors scale-press"
              >
                <Printer size={15} />
              </button>
              <button
                type="button"
                onClick={handleSubmit(handleExportPdf)}
                disabled={exportingPdf}
                title={exportingPdf ? "Exporting..." : "Export PDF"}
                className="p-2 rounded-md border border-border text-foreground hover:bg-secondary transition-colors scale-press disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {exportingPdf ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <FileDown size={15} />
                )}
              </button>
              <button
                type="submit"
                disabled={saveState === "saving"}
                title={
                  saveState === "saving"
                    ? "Saving..."
                    : saveState === "saved"
                    ? "Saved"
                    : "Save Form"
                }
                className="p-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity scale-press disabled:opacity-60"
              >
                {saveState === "saving" ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : saveState === "saved" ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <Save size={15} />
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      <CopyFormModal
        open={copyModalOpen}
        formId={existingForm?.id ?? ""}
        formName={existingForm?.formName ?? ""}
        sourceSiteId={existingForm?.siteId ?? ""}
        sourceCategoryId={existingForm?.categoryId ?? ""}
        sites={sites}
        categories={categories}
        onClose={() => setCopyModalOpen(false)}
        onCopied={(targetName, newFormName) => {
          addToast(
            "success",
            "Form copied",
            `"${newFormName}" copied to "${targetName}".`,
          );
        }}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
