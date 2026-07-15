'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Filter, Upload, Download, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { JobStatus } from '@/types';
import DashboardStats from './DashboardStats';
import JobCard from './JobCard';
import NewJobModal from './NewJobModal';
import ToastContainer from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { dbService, } from '@/services/db';
import { downloadJSON } from '@/utils/helpers';

const STATUS_FILTERS: { key: string; label: string; value: JobStatus | 'All' }[] = [
  { key: 'filter-all', label: 'All Jobs', value: 'All' },
  { key: 'filter-draft', label: 'Draft', value: 'Draft' },
  { key: 'filter-pending', label: 'Pending', value: 'Pending' },
  { key: 'filter-approved', label: 'Approved', value: 'Approved' },
];

export default function DashboardClient() {
  const router = useRouter();
  const { jobs, loadJobs, duplicateJob } = useAppStore();
  const { toasts, addToast, removeToast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'All'>('All');
  const [showNewJob, setShowNewJob] = useState(false);
  const [importing, setImporting] = useState(false);

  const filtered = useMemo(() => {
    let list = jobs;
    if (statusFilter !== 'All') {
      list = list.filter((j) => j.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (j) =>
          j.jobName.toLowerCase().includes(q) ||
          j.clientName.toLowerCase().includes(q) ||
          j.siteAddress.toLowerCase().includes(q) ||
          j.forms.some((f) => f.suitPublicAreaName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [jobs, search, statusFilter]);

  const handleDuplicate = async (id: string) => {
    try {
      const newJob = await duplicateJob(id);
      addToast('success', 'Job duplicated', `"${newJob.jobName}" created.`);
    } catch {
      addToast('error', 'Duplicate failed', 'Could not duplicate this job.');
    }
  };

  const handleExport = async () => {
    const data = await dbService.exportAllJobs();
    downloadJSON(data, `paintpro-export-${Date.now()}.json`);
    addToast('success', 'Export complete', 'All jobs saved as JSON.');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setImporting(true);
      const text = await file.text();
      const result = await dbService.importJobs(text);
      await loadJobs();
      addToast(
        result.errors > 0 ? 'warning' : 'success',
        `Imported ${result.imported} jobs`,
        result.errors > 0 ? `${result.errors} errors skipped.` : undefined
      );
      setImporting(false);
    };
    input.click();
  };

  return (
    <div className="min-h-full p-4 lg:p-6 xl:p-8 pb-20 lg:pb-8 max-w-screen-2xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {jobs.length} job{jobs.length !== 1 ? 's' : ''} · last updated just now
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            disabled={importing}
            title="Import jobs from JSON"
            className="p-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors scale-press"
          >
            <Upload size={16} />
          </button>
          <button
            onClick={handleExport}
            title="Export all jobs as JSON"
            className="p-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors scale-press"
          >
            <Download size={16} />
          </button>
          <button
            onClick={() => loadJobs()}
            title="Refresh jobs"
            className="p-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors scale-press"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowNewJob(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity scale-press"
          >
            <Plus size={16} />
            New Job
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6">
        <DashboardStats jobs={jobs} />
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by job name, client, site, suit name..."
            className="w-full pl-9 pr-4 py-2.5 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
          />
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1 scrollbar-thin">
        {STATUS_FILTERS.map((f) => {
          const count =
            f.value === 'All'
              ? jobs.length
              : jobs.filter((j) => j.status === f.value).length;
          return (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all scale-press ${
                statusFilter === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
              <span
                className={`text-xs font-tabular px-1.5 py-0.5 rounded-full ${
                  statusFilter === f.value
                    ? 'bg-white/20 text-white' :'bg-muted text-muted-foreground'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Job Cards Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
            <Filter size={28} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground text-lg mb-1">
            {search || statusFilter !== 'All' ? 'No jobs match your filters' : 'No jobs yet'}
          </h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            {search || statusFilter !== 'All' ?'Try adjusting your search or clearing the status filter.' :'Create your first painting job to get started. Each job can contain multiple Standard Interior forms.'}
          </p>
          {!search && statusFilter === 'All' && (
            <button
              onClick={() => setShowNewJob(true)}
              className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity scale-press"
            >
              <Plus size={16} />
              Create First Job
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onDuplicate={handleDuplicate}
              onToast={addToast}
            />
          ))}
        </div>
      )}

      {/* FAB for mobile */}
      <button
        onClick={() => setShowNewJob(true)}
        className="fixed bottom-20 right-4 lg:hidden w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity scale-press z-20 no-print"
        aria-label="Create new job"
      >
        <Plus size={24} />
      </button>

      <NewJobModal
        open={showNewJob}
        onClose={() => setShowNewJob(false)}
        onCreated={(job) => {
          addToast('success', 'Job created', `"${job.jobName}" is ready.`);
          router.push(`/job-detail?id=${job.id}`);
        }}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}