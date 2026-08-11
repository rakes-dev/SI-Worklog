'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Eye, Copy, Trash2, Printer, MoreVertical, RotateCcw, ChevronUp, ChevronDown, Search, ArrowUpDown } from 'lucide-react';
import type { Job, PaintForm } from '@/types';
import { formatDate, formatCurrency, defaultForm, aggregateAreaUnitLabel } from '@/utils/helpers';
import { useAppStore } from '@/store/useAppStore';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AddFormModal from './AddFormModal';
import type { FormType } from '@/types';

interface FormsTableProps {
  job: Job;
  onToast: (type: 'success' | 'error' | 'warning', title: string, msg?: string) => void;
}

export default function FormsTable({ job, onToast }: FormsTableProps) {
  const router = useRouter();
  const { addForm, updateJob, deleteForm, permanentlyDeleteForm, restoreForm, duplicateForm } = useAppStore();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Filter / sort state
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'position' | 'name' | 'date' | 'area' | 'amount'>('position');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const activeForms = job.forms.filter((f) => !f.isDeleted);
  const deletedForms = job.forms.filter((f) => f.isDeleted);

  const displayForms = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = activeForms.filter((f) => {
      if (!q) return true;
      return (
        f.formName.toLowerCase().includes(q) ||
        (f.suitPublicAreaName || '').toLowerCase().includes(q) ||
        formatDate(f.date).toLowerCase().includes(q)
      );
    });
    if (sortKey !== 'position') {
      list = [...list].sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'name') cmp = a.formName.localeCompare(b.formName);
        else if (sortKey === 'date') cmp = (a.date || '').localeCompare(b.date || '');
        else if (sortKey === 'area') cmp = a.totalArea - b.totalArea;
        else if (sortKey === 'amount') cmp = a.grandTotal - b.grandTotal;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [activeForms, search, sortKey, sortDir]);

  // Determine a unit label for the Total Area column across the displayed forms.
  // Mixed units → shown joined, e.g. "m²/ft²".
  const areaUnitHeader = `Total Area (${aggregateAreaUnitLabel(
    displayForms.flatMap((f) => (f.measurementRows || []).map((r) => r.uom))
  )})`;

  const moveForm = async (formId: string, dir: 'up' | 'down') => {
    const fullForms = [...job.forms];
    const activeIds = job.forms.filter((f) => !f.isDeleted).map((f) => f.id);
    const activeIdx = activeIds.indexOf(formId);
    const targetId = dir === 'up' ? activeIds[activeIdx - 1] : activeIds[activeIdx + 1];
    if (!targetId) return;
    const a = fullForms.findIndex((f) => f.id === formId);
    const b = fullForms.findIndex((f) => f.id === targetId);
    [fullForms[a], fullForms[b]] = [fullForms[b], fullForms[a]];
    try {
      await updateJob({ ...job, forms: fullForms });
      onToast('success', 'Order updated', 'Form reordered successfully.');
    } catch (error) {
      console.error('Failed to reorder form:', error);
      onToast('error', 'Reorder failed', 'Could not reorder this form.');
    }
  };

  const handleAddForm = async (formType: FormType) => {
    try {
      const form = defaultForm(job.siteName, job.forms.length + 1, formType);
      await addForm(job.id, form);
      onToast('success', 'Form added', `"${form.formName}" created.`);
      router.push(`/form-editor?jobId=${job.id}&formId=${form.id}`);
    } catch (error) {
      console.error('Failed to add form:', error);
      onToast('error', 'Failed to add form', 'Please check your connection and try again.');
    } finally {
      setShowTemplateModal(false);
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
      onToast('success', 'Form deleted', 'Form moved to trash. You can restore it anytime.');
    } catch (error) {
      console.error('Failed to delete form:', error);
      onToast('error', 'Delete failed', 'Could not delete this form.');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteTarget) return;
    try {
      await permanentlyDeleteForm(job.id, permanentDeleteTarget);
      onToast('success', 'Form permanently deleted', 'The form has been removed permanently.');
    } catch (error) {
      console.error('Failed to permanently delete form:', error);
      onToast('error', 'Delete failed', 'Could not permanently delete this form.');
    } finally {
      setPermanentDeleteTarget(null);
    }
  };

  const handleRestore = async (formId: string) => {
    try {
      await restoreForm(job.id, formId);
      onToast('success', 'Form restored', 'Form has been restored.');
    } catch (error) {
      console.error('Failed to restore form:', error);
      onToast('error', 'Restore failed', 'Could not restore this form.');
    }
  };

  const handlePrint = (form: PaintForm) => {
    router.push(`/form-editor?jobId=${job.id}&formId=${form.id}&print=1`);
  };

  const renderFormRow = (form: PaintForm, idx: number, isFirst: boolean, isLast: boolean) => (
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
          {sortKey === 'position' && (
            <span className="flex items-center gap-0.5 mr-1">
              <button
                onClick={() => moveForm(form.id, 'up')}
                disabled={isFirst}
                title="Move up"
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={() => moveForm(form.id, 'down')}
                disabled={isLast}
                title="Move down"
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronDown size={14} />
              </button>
            </span>
          )}
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
  );

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="font-semibold text-foreground">Standard Interior Forms</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeForms.length} active form{activeForms.length !== 1 ? 's' : ''} · {deletedForms.length} in trash
          </p>
        </div>
        <button
          onClick={() => setShowTemplateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity scale-press"
        >
          <Plus size={15} />
          Add Form
        </button>
      </div>

      {activeForms.length === 0 && deletedForms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-3">
            <FileText size={24} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">No forms yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Add a Standard Interior form to start recording measurements and summary data for this job.
          </p>
          <button
            onClick={() => setShowTemplateModal(true)}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity scale-press"
          >
            <Plus size={15} />
            Add First Form
          </button>
        </div>
      ) : (
        <>
          {activeForms.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 px-4 py-3 border-b border-border">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, suit/area or date…"
                  className="w-full pl-9 pr-3 py-2 bg-input border border-border rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
                  className="px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="position">Manual order</option>
                  <option value="name">Sort by Name</option>
                  <option value="date">Sort by Date</option>
                  <option value="area">Sort by Area</option>
                  <option value="amount">Sort by Amount</option>
                </select>
                <button
                  onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  disabled={sortKey === 'position'}
                  title={sortDir === 'asc' ? 'Sort ascending' : 'Sort descending'}
                  className="p-2 bg-input border border-border rounded-md text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowUpDown size={15} />
                </button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-10">#</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Form Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Suit / Area</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Sheets</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{areaUnitHeader}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount (₹)</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-44">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayForms.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">
                      {activeForms.length === 0 ? 'No active forms yet.' : 'No forms match your search.'}
                    </td>
                  </tr>
                ) : (
                  displayForms.map((form, idx) =>
                    renderFormRow(form, idx, idx === 0, idx === displayForms.length - 1)
                  )
                )}
              </tbody>
              <tfoot>
                <tr className="bg-secondary/30">
                  <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-foreground text-right">
                    Grand Total
                  </td>
                  <td className="px-4 py-3 text-right font-tabular font-semibold text-foreground text-sm">
                    {displayForms.reduce((s, f) => s + f.totalArea, 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-tabular font-bold text-primary text-sm">
                    ₹{formatCurrency(displayForms.reduce((s, f) => s + f.grandTotal, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* Deleted Forms (Trash) */}
      {deletedForms.length > 0 && (
        <div className="border-t border-border">
          <div className="px-5 py-3 bg-secondary/30 border-b border-border">
            <h3 className="font-medium text-foreground text-sm">Deleted Forms ({deletedForms.length})</h3>
            <p className="text-xs text-muted-foreground mt-0.5">These forms are soft-deleted. Restore them to recover.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">#</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Form Name</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Deleted At</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deletedForms.map((form, idx) => (
                  <tr key={form.id} className="border-b border-border">
                    <td className="px-4 py-2 text-muted-foreground font-tabular text-xs">{idx + 1}</td>
                    <td className="px-4 py-2 text-muted-foreground truncate max-w-[200px]">{form.formName}</td>
                    <td className="px-4 py-2 text-muted-foreground font-tabular text-xs">
                      {formatDate(form.deletedAt || '') || '—'}
                    </td>
                    <td className="px-4 py-2 text-right flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleRestore(form.id)}
                        title="Restore form"
                        className="p-1.5 rounded text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors scale-press"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        onClick={() => setPermanentDeleteTarget(form.id)}
                        title="Delete permanently"
                        className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors scale-press"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddFormModal
        open={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelect={handleAddForm}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Form"
        message="Are you sure you want to delete this form? It will be moved to trash and can be restored anytime."
        confirmLabel="Move to Trash"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        destructive
      />

      <ConfirmModal
        open={!!permanentDeleteTarget}
        title="Permanently Delete Form"
        message="This will remove the form permanently from this job. This action cannot be undone."
        confirmLabel="Delete Permanently"
        onConfirm={handlePermanentDelete}
        onCancel={() => setPermanentDeleteTarget(null)}
        destructive
      />
    </div>
  );
}
