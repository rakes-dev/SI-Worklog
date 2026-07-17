'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, Save, Loader2, Upload, Database, Search, Edit2, ArrowLeft, Eye, ArrowUpDown } from 'lucide-react';
import { dbService } from '@/services/db';
import type { ArcItem } from '@/types';
import { generateId } from '@/utils/helpers';
import ToastContainer from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

function defaultArcItem(): ArcItem {
  return {
    id: generateId('arc'),
    arc_no: '',
    coat: '',
    description: '',
    final_rate: '',
    uom: '',
    job_type: '',
  };
}

type ViewState = 'list' | 'add' | 'edit' | 'view';
type SortOrder = 'asc' | 'desc' | 'none';

export default function ArcClient() {
  const { toasts, addToast, removeToast } = useToast();
  const [items, setItems] = useState<ArcItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // View states
  const [view, setView] = useState<ViewState>('list');
  const [selectedItem, setSelectedItem] = useState<ArcItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Form states
  const [formItem, setFormItem] = useState<ArcItem>(defaultArcItem());

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dbService.getAllArcItems();
      setItems(data);
    } catch {
      console.warn('Could not load ARC items from Firestore.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Filtered and sorted items for list view
  const processedItems = useMemo(() => {
    let result = [...items];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.arc_no.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.job_type.toLowerCase().includes(q)
      );
    }

    // Apply natural alphanumeric sorting by ARC No (e.g., 1a, 1b, 1c, 2, 10)
    if (sortOrder !== 'none') {
      result.sort((a, b) => {
        const comparison = a.arc_no.localeCompare(b.arc_no, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [items, searchQuery, sortOrder]);

  const handleAddClick = () => {
    setFormItem(defaultArcItem());
    setView('add');
  };

  const handleEditClick = (item: ArcItem) => {
    setFormItem({ ...item });
    setView('edit');
  };

  const handleViewClick = (item: ArcItem) => {
    setSelectedItem(item);
    setView('view');
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedItem(null);
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => {
      if (prev === 'none') return 'asc';
      if (prev === 'asc') return 'desc';
      return 'none';
    });
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formItem.arc_no.trim() || !formItem.description.trim()) {
      addToast('warning', 'Validation Error', 'ARC No. and Description are required.');
      return;
    }

    setSaving(true);
    try {
      await dbService.saveArcItem(formItem);
      addToast('success', 'ARC Item Saved', `"${formItem.arc_no}" has been saved successfully.`);
      await loadItems();
      setView('list');
    } catch (error) {
      console.error('Failed to save ARC item:', error);
      addToast('error', 'Save Failed', 'Could not save ARC item to Firestore.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (id: string, arcNo: string) => {
    if (!confirm(`Are you sure you want to delete ARC item "${arcNo}"?`)) return;
    try {
      await dbService.deleteArcItem(id);
      addToast('success', 'ARC Item Deleted', `"${arcNo}" has been removed.`);
      await loadItems();
    } catch (error) {
      console.error('Failed to delete ARC item:', error);
      addToast('error', 'Delete Failed', 'Could not delete ARC item.');
    }
  };

  const handleImportCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const lines = text.split('\n').filter((l) => l.trim());
        if (lines.length < 2) {
          addToast('error', 'Invalid CSV', 'CSV must have a header row and at least one data row.');
          return;
        }
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const arcIdx = headers.indexOf('arc_no');
        const coatIdx = headers.indexOf('coat');
        const descIdx = headers.indexOf('description');
        const rateIdx = headers.indexOf('final_rate');
        const uomIdx = headers.indexOf('uom');
        const jobTypeIdx = headers.indexOf('job_type');

        if (arcIdx === -1) {
          addToast('error', 'Invalid CSV', 'CSV must contain an "arc_no" column.');
          return;
        }

        const parsed: ArcItem[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim());
          const arcNo = cols[arcIdx] || '';
          if (!arcNo) continue;
          parsed.push({
            id: generateId('arc'),
            arc_no: arcNo,
            coat: coatIdx >= 0 ? (parseInt(cols[coatIdx], 10) || '') : '',
            description: descIdx >= 0 ? cols[descIdx] || '' : '',
            final_rate: rateIdx >= 0 ? (parseFloat(cols[rateIdx]) || '') : '',
            uom: uomIdx >= 0 ? cols[uomIdx] || '' : '',
            job_type: jobTypeIdx >= 0 ? cols[jobTypeIdx] || '' : '',
          });
        }

        if (parsed.length === 0) {
          addToast('error', 'No data', 'No valid ARC items found in CSV.');
          return;
        }

        await dbService.saveAllArcItems(parsed);
        addToast('success', 'CSV Imported', `${parsed.length} rows imported successfully.`);
        await loadItems();
      } catch (error) {
        console.error('CSV Import failed:', error);
        addToast('error', 'Import Failed', 'Could not parse or save CSV data.');
      }
    };
    input.click();
  };

  return (
    <div className="min-h-full p-4 lg:p-6 xl:p-8 pb-24 lg:pb-8 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Database size={15} />
            <span className="text-foreground font-medium">ARC Master Data</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">ARC Rate Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {items.length} ARC items total
          </p>
        </div>

        {view === 'list' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleImportCSV}
              title="Import from CSV"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors scale-press"
            >
              <Upload size={15} />
              Import CSV
            </button>
            <button
              onClick={handleAddClick}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity scale-press"
            >
              <Plus size={15} />
              Add ARC Item
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Loading ARC data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* LIST VIEW */}
          {view === 'list' && (
            <div className="flex flex-col gap-4">
              {/* Search & Sort Bar */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by ARC No, Job Type, or Description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
                  />
                </div>
                <button
                  onClick={toggleSortOrder}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-border text-sm font-medium transition-colors scale-press ${
                    sortOrder !== 'none'
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'bg-card text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                  title="Toggle natural alphanumeric sorting by ARC No."
                >
                  <ArrowUpDown size={16} />
                  <span>
                    Sort: {sortOrder === 'asc' ? 'ARC No (Asc)' : sortOrder === 'desc' ? 'ARC No (Desc)' : 'None'}
                  </span>
                </button>
              </div>

              {/* Table */}
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide text-left w-10">#</th>
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide text-left min-w-[120px]">ARC No.</th>
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide text-left min-w-[140px]">Job Type</th>
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide text-left min-w-[80px]">Coat</th>
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide text-left min-w-[250px]">Description</th>
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide text-right min-w-[100px]">Final Rate (₹)</th>
                        <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide text-left min-w-[80px]">UOM</th>
                        <th className="px-4 py-3 w-28 text-right" />
                      </tr>
                    </thead>
                    <tbody>
                      {processedItems.map((item, idx) => (
                        <tr key={item.id} className="border-b border-border hover:bg-secondary/20 transition-colors group">
                          <td className="px-4 py-3 text-xs text-muted-foreground font-tabular text-center">{idx + 1}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{item.arc_no}</td>
                          <td className="px-4 py-3 text-foreground">
                            {item.job_type ? (
                              <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                                {item.job_type}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-foreground font-tabular">{item.coat || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground truncate max-w-[250px]" title={item.description}>
                            {item.description}
                          </td>
                          <td className="px-4 py-3 text-right font-tabular font-semibold text-foreground">
                            {item.final_rate !== '' ? `₹${Number(item.final_rate).toFixed(2)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{item.uom || '—'}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleViewClick(item)}
                                title="View details"
                                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => handleEditClick(item)}
                                title="Edit item"
                                className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id, item.arc_no)}
                                title="Delete item"
                                className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {processedItems.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                    <Database size={32} className="text-muted-foreground mb-3" />
                    <h3 className="font-semibold text-foreground mb-1">No ARC items found</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Try adjusting your search query or add a new ARC item.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ADD / EDIT VIEW */}
          {(view === 'add' || view === 'edit') && (
            <div className="max-w-2xl mx-auto bg-card border border-border rounded-lg p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                <button
                  onClick={handleBackToList}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <ArrowLeft size={18} />
                </button>
                <h2 className="text-lg font-semibold text-foreground">
                  {view === 'add' ? 'Add New ARC Item' : `Edit ARC Item: ${formItem.arc_no}`}
                </h2>
              </div>

              <form onSubmit={handleSaveForm} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* ARC No */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      ARC No. <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formItem.arc_no}
                      onChange={(e) => setFormItem({ ...formItem, arc_no: e.target.value })}
                      placeholder="e.g. ARC-001"
                      className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {/* Job Type */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Job Type
                    </label>
                    <input
                      type="text"
                      value={formItem.job_type}
                      onChange={(e) => setFormItem({ ...formItem, job_type: e.target.value })}
                      placeholder="e.g. Civil Repair, Emulsion Painting"
                      className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {/* Coat */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Coat
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formItem.coat}
                      onChange={(e) => setFormItem({ ...formItem, coat: e.target.value === '' ? '' : parseInt(e.target.value, 10) })}
                      placeholder="e.g. 1, 2"
                      className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {/* UOM */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      UOM (Unit of Measurement)
                    </label>
                    <input
                      type="text"
                      value={formItem.uom}
                      onChange={(e) => setFormItem({ ...formItem, uom: e.target.value })}
                      placeholder="e.g. sqm, rft, nos"
                      className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {/* Final Rate */}
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Final Rate (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formItem.final_rate}
                      onChange={(e) => setFormItem({ ...formItem, final_rate: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                      placeholder="e.g. 120.50"
                      className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {/* Description */}
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={formItem.description}
                      onChange={(e) => setFormItem({ ...formItem, description: e.target.value })}
                      placeholder="Detailed description of the painting job or service..."
                      className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-border mt-2">
                  <button
                    type="button"
                    onClick={handleBackToList}
                    className="px-4 py-2 text-sm font-medium rounded-md border border-border text-foreground hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity scale-press disabled:opacity-60 min-w-[100px] justify-center"
                  >
                    {saving ? (
                      <><Loader2 size={14} className="animate-spin" />Saving...</>
                    ) : (
                      <><Save size={14} />Save Item</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* VIEW DETAILS VIEW */}
          {view === 'view' && selectedItem && (
            <div className="max-w-2xl mx-auto bg-card border border-border rounded-lg p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
                <button
                  onClick={handleBackToList}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <ArrowLeft size={18} />
                </button>
                <h2 className="text-lg font-semibold text-foreground">
                  ARC Item Details: {selectedItem.arc_no}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ARC No.</span>
                  <span className="text-sm font-semibold text-foreground">{selectedItem.arc_no}</span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job Type</span>
                  <span className="text-sm text-foreground">
                    {selectedItem.job_type ? (
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                        {selectedItem.job_type}
                      </span>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Coat</span>
                  <span className="text-sm text-foreground">{selectedItem.coat || '—'}</span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">UOM</span>
                  <span className="text-sm text-foreground">{selectedItem.uom || '—'}</span>
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Final Rate</span>
                  <span className="text-base font-bold text-primary">
                    {selectedItem.final_rate !== '' ? `₹${Number(selectedItem.final_rate).toFixed(2)}` : '—'}
                  </span>
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</span>
                  <p className="text-sm text-foreground bg-secondary/30 p-3 rounded-md border border-border whitespace-pre-wrap">
                    {selectedItem.description}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-6 border-t border-border mt-6">
                <button
                  onClick={() => handleEditClick(selectedItem)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Edit2 size={14} />
                  Edit Item
                </button>
                <button
                  onClick={handleBackToList}
                  className="px-4 py-2 text-sm font-medium rounded-md border border-border text-foreground hover:bg-secondary transition-colors"
                >
                  Back to List
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}