'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Eye, Copy, Trash2, Printer, MoreVertical,  } from 'lucide-react';
import type { Job, PaintForm } from '@/types';
import { formatDate, formatCurrency, defaultForm } from '@/utils/helpers';
import { useAppStore } from '@/store/useAppStore';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface FormsTableProps {
  job: Job;
  onToast: (type: 'success' | 'error' | 'warning', title: string, msg?: string) => void;
}

export default function FormsTable({ job, onToast }: FormsTableProps) {
  const router = useRouter();
  const { addForm, deleteForm, duplicateForm } = useAppStore();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const handleAddForm = async () => {
    try {
      const form = defaultForm(job.jobName, job.forms.length + 1);
      await addForm(job.id, form);
      onToast('success', 'Form added', `"${form.formName}" created.`);
      router.push(`/form-editor?jobId=${job.id}&formId=${form.id}`);
    } catch (error) {
      console.error('Failed to add form:', error);
      onToast('error', 'Failed to add form', 'Please check your connection and try again.');
    }
  };

  const handleOpenForm = (form: PaintForm) => {
    router.push(`/form-editor?jobId=${job.id}&formId=${form.id}`);
  };

  const handleDuplicate = async (formId: string) => {
    try {
      await duplicateForm(job.id, formId);
      onToast('success', 'Form duplicated', 'Copy created successfully.');
    } catch (error) {
      console.error('Failed to duplicate form:', error);
      onToast('error', 'Duplicate failed', 'Could not duplicate this form.');
    } finally {
      setOpenMenu(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteForm(job.id, deleteTarget);
      onToast('success', 'Form deleted', 'Form removed from this job.');
    } catch (error) {
      console.error('Failed to delete form:', error);
      onToast('error', 'Delete failed', 'Could not delete this form.');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handlePrint = (form: PaintForm) => {
    router.push(`/form-editor?jobId=${job.id}&formId=${form.id}&print=1`);
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="font-semibold text-foreground">Standard Interior Forms</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {job.forms.length} form{job.forms.length !== 1 ? 's' : ''} under this job
          </p>
        </div>
        <button
          onClick={handleAddForm}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity scale-press"
        >
          <Plus size={15} />
          Add Form
        </button>
      </div>

      {job.forms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-3">
            <FileText size={24} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">No forms yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Add a Standard Interior form to start recording measurements and summary data for this job.
          </p>
          <button
            onClick={handleAddForm}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity scale-press"
          >
            <Plus size={15} />
            Add First Form
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-10">#</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Form Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Suit / Area</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Sheets</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Area (m²)</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount (₹)</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {job.forms.map((form, idx) => (
                <tr
                  key={form.id}
                  className="border-b border-border hover:bg-secondary/30 transition-colors cursor-pointer group"
                  onClick={() => handleOpenForm(form)}
                >
                  <td className="px-4 py-3 text-muted-foreground font-tabular text-xs">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-muted-foreground flex-shrink-0" />
                      <span className="truncate max-w-[200px]">{form.formName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[160px]">
                    {form.suitPublicAreaName || '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-tabular text-xs">
                    {formatDate(form.date) || '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-tabular text-muted-foreground text-xs">
                    {form.sheetNo}/{form.totalSheets}
                  </td>
                  <td className="px-4 py-3 text-right font-tabular text-foreground">
                    {form.totalArea.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-tabular font-semibold text-foreground">
                    ₹{formatCurrency(form.grandTotal)}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenForm(form)}
                        title="Open form editor"
                        className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => handlePrint(form)}
                        title="Print this form"
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        <Printer size={14} />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === form.id ? null : form.id)}
                          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        >
                          <MoreVertical size={14} />
                        </button>
                        {openMenu === form.id && (
                          <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-20 w-36 py-1 fade-in">
                            <button
                              onClick={() => handleDuplicate(form.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                            >
                              <Copy size={13} />
                              Duplicate
                            </button>
                            <button
                              onClick={() => { setDeleteTarget(form.id); setOpenMenu(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <Trash2 size={13} />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-secondary/30">
                <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-foreground text-right">
                  Grand Total
                </td>
                <td className="px-4 py-3 text-right font-tabular font-semibold text-foreground text-sm">
                  {job.forms.reduce((s, f) => s + f.totalArea, 0).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right font-tabular font-bold text-primary text-sm">
                  ₹{formatCurrency(job.totalAmount)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Form"
        message="Are you sure you want to delete this form? All measurements and summary data will be permanently removed."
        confirmLabel="Delete Form"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        destructive
      />
    </div>
  );
}