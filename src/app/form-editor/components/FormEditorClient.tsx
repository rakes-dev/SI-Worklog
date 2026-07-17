'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
  ChevronLeft,
  Save,
  Printer,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { useAppStore } from '@/store/useAppStore';
import type { PaintForm, SummaryRow, MeasurementRow, FormSignatures } from '@/types';
import {
  calcGrandTotal,
  calcTotalArea,
  defaultForm,
  generateId,
  syncSummaryRowsWithMeasurements,
} from '@/utils/helpers';
import FormTopFields from './FormTopFields';
import SummaryTable from './SummaryTable';
import MeasurementTable from './MeasurementTable';
import SignatureSection from './SignatureSection';
import PrintLayout from './PrintLayout';
import ToastContainer from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function FormEditorClient() {
  const params = useSearchParams();
  const router = useRouter();
  const { jobs, addForm, updateForm, loadJobs } = useAppStore();
  const { toasts, addToast, removeToast } = useToast();

  const jobId = params.get('jobId') ?? '';
  const formId = params.get('formId') ?? '';
  const printMode = params.get('print') === '1';

  const job = jobs.find((j) => j.id === jobId);
  const existingForm = job?.forms.find((f) => f.id === formId);

  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([]);
  const [measurementRows, setMeasurementRows] = useState<MeasurementRow[]>([]);
  const [signatures, setSignatures] = useState<FormSignatures | null>(null);
  const [grandTotal, setGrandTotal] = useState(0);
  const [totalArea, setTotalArea] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [initialized, setInitialized] = useState(false);
  const syncedSummaryRows = useMemo(
    () => syncSummaryRowsWithMeasurements(summaryRows, measurementRows),
    [summaryRows, measurementRows]
  );

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<PaintForm>({
    defaultValues: existingForm ?? defaultForm(job?.jobName ?? 'New Job', 1),
  });

  // Initialize state from existing or default form
  useEffect(() => {
    if (initialized) return;
    const src = existingForm ?? defaultForm(job?.jobName ?? 'New Job', 1);
    setSummaryRows(src.summaryRows);
    setMeasurementRows(src.measurementRows);
    setSignatures(src.signatures);
    setGrandTotal(src.grandTotal);
    setTotalArea(src.totalArea);
    reset(src);
    setInitialized(true);
  }, [existingForm, job, initialized, reset]);

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
      setTimeout(() => window.print(), 500);
    }
  }, [printMode, initialized]);

  const buildFormData = useCallback(
    (values: PaintForm): PaintForm => ({
      ...values,
      id: existingForm?.id ?? generateId('form'),
      summaryRows: syncedSummaryRows,
      measurementRows,
      signatures: signatures!,
      grandTotal: calcGrandTotal(syncedSummaryRows),
      totalArea: calcTotalArea(measurementRows),
      updatedAt: new Date().toISOString(),
      createdAt: existingForm?.createdAt ?? new Date().toISOString(),
    }),
    [syncedSummaryRows, measurementRows, signatures, existingForm]
  );

  const onSubmit = async (values: PaintForm) => {
    if (!job || !signatures) return;
    setSaveState('saving');
    try {
      const formData = buildFormData(values);
      if (existingForm) {
        await updateForm(jobId, formData);
      } else {
        await addForm(jobId, formData);
      }
      await loadJobs();
      setSaveState('saved');
      addToast('success', 'Form saved', 'All changes saved successfully.');
      setTimeout(() => setSaveState('idle'), 3000);
    } catch {
      setSaveState('error');
      addToast('error', 'Save failed', 'Could not save form. Please try again.');
    }
  };

  const handlePrint = async (values: PaintForm) => {
    if (!job || !signatures) return;
    // Save first, then print
    const formData = buildFormData(values);
    if (existingForm) {
      await updateForm(jobId, formData);
    } else {
      await addForm(jobId, formData);
    }
    await loadJobs();
    window.print();
  };

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <AlertCircle size={40} className="text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Job not found</h2>
        <p className="text-muted-foreground text-sm mb-5">
          The job associated with this form could not be found.
        </p>
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <ChevronLeft size={16} />
          Back to Dashboard
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

  // Reconstruct current form for print
  const currentFormForPrint: PaintForm = {
    ...(existingForm ?? defaultForm(job.jobName, 1)),
    suitPublicAreaName: '',
    summaryRows: syncedSummaryRows,
    measurementRows,
    signatures,
    grandTotal: calcGrandTotal(syncedSummaryRows),
    totalArea,
  };

  return (
    <>
      {/* Print-only layout */}
      <div className="hidden print:block">
        <PrintLayout form={currentFormForPrint} job={job} />
      </div>

      {/* Screen layout */}
      <div className="no-print min-h-full p-4 lg:p-6 xl:p-8 pb-24 lg:pb-8 max-w-screen-2xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
              <span>/</span>
              <Link
                href={`/job-detail?id=${jobId}`}
                className="hover:text-foreground transition-colors"
              >
                {job.jobName}
              </Link>
              <span>/</span>
              <span className="text-foreground font-medium">
                {existingForm?.formName ?? 'New Form'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-foreground">
                {existingForm?.formName ?? 'New Standard Interior Form'}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {job.clientName} · {job.siteAddress}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(`/job-detail?id=${jobId}`)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors scale-press"
            >
              <ChevronLeft size={15} />
              Back
            </button>

            <button
              type="button"
              onClick={handleSubmit(handlePrint)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border border-border text-foreground hover:bg-secondary transition-colors scale-press"
            >
              <Printer size={15} />
              Print
            </button>

            <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={saveState === 'saving'}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity scale-press disabled:opacity-60 min-w-[110px] justify-center"
            >
              {saveState === 'saving' ? (
                <><Loader2 size={14} className="animate-spin" />Saving...</>
              ) : saveState === 'saved' ? (
                <><CheckCircle2 size={14} />Saved</>
              ) : (
                <><Save size={14} />Save Form</>
              )}
            </button>
          </div>
        </div>

        {/* Unsaved changes banner */}
        {isDirty && saveState === 'idle' && (
          <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
            <AlertCircle size={15} />
            You have unsaved changes — click "Save Form" to keep them.
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
          />

          {/* Section B — Measurement Sheet */}
          <MeasurementTable
            rows={measurementRows}
            onChange={(rows) => setMeasurementRows(rows)}
            totalArea={totalArea}
          />

          {/* Signatures */}
          <SignatureSection
            signatures={signatures}
            onChange={(sigs) => setSignatures(sigs)}
          />

          {/* Sticky Save Bar */}
          <div className="fixed bottom-0 left-0 right-0 lg:left-sidebar lg:left-sidebar-collapsed bg-card border-t border-border px-4 py-3 flex items-center justify-between gap-3 z-20 no-print">
            <div className="flex items-center gap-2 text-sm">
              <FileText size={15} className="text-muted-foreground" />
              <span className="text-muted-foreground">
                Grand Total:{' '}
                <span className="font-semibold font-tabular text-foreground">
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </span>
              <span className="text-muted-foreground hidden sm:inline">·</span>
              <span className="text-muted-foreground hidden sm:inline">
                Total Area:{' '}
                <span className="font-semibold font-tabular text-foreground">
                  {totalArea.toFixed(2)} m²
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSubmit(handlePrint)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-border text-foreground hover:bg-secondary transition-colors scale-press"
              >
                <Printer size={14} />
                <span className="hidden sm:inline">Print A4</span>
              </button>
              <button
                type="submit"
                disabled={saveState === 'saving'}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity scale-press disabled:opacity-60 min-w-[110px] justify-center"
              >
                {saveState === 'saving' ? (
                  <><Loader2 size={14} className="animate-spin" />Saving...</>
                ) : saveState === 'saved' ? (
                  <><CheckCircle2 size={14} />Saved</>
                ) : (
                  <><Save size={14} />Save Form</>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}