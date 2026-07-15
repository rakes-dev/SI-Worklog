'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Filter, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { JobStatus } from '@/types';
import JobCard from '@/app/components/JobCard';
import NewJobModal from '@/app/components/NewJobModal';
import ToastContainer from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

const STATUS_FILTERS: { key: string; label: string; value: JobStatus | 'All' }[] = [
  { key: 'filter-all', label: 'All', value: 'All' },
  { key: 'filter-draft', label: 'Draft', value: 'Draft' },
  { key: 'filter-pending', label: 'Pending', value: 'Pending' },
  { key: 'filter-approved', label: 'Approved', value: 'Approved' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function JobsClient() {
  const router = useRouter();
  const { jobs, duplicateJob } = useAppStore();
  const { toasts, addToast, removeToast } = useToast();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'All'>('All');
  const [showNewJob, setShowNewJob] = useState(false);

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    const isCurrentMonth =
      selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
    if (isCurrentMonth) return; // Don't go beyond current month
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const isCurrentMonth =
    selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  const filtered = useMemo(() => {
    let list = jobs.filter((j) => {
      const d = new Date(j.createdAt);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });

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
  }, [jobs, selectedMonth, selectedYear, statusFilter, search]);

  const handleDuplicate = async (id: string) => {
    try {
      const newJob = await duplicateJob(id);
      addToast('success', 'Job duplicated', `"${newJob.jobName}" created.`);
    } catch {
      addToast('error', 'Duplicate failed', 'Could not duplicate this job.');
    }
  };

  // Count jobs for the selected month (for status filter badges)
  const monthJobs = useMemo(() => {
    return jobs.filter((j) => {
      const d = new Date(j.createdAt);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [jobs, selectedMonth, selectedYear]);

  return (
    <div className="min-h-full p-4 lg:p-6 xl:p-8 pb-20 lg:pb-8 max-w-screen-2xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Jobs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} job{filtered.length !== 1 ? 's' : ''} in {MONTH_NAMES[selectedMonth]} {selectedYear}
          </p>
        </div>
        <button
          onClick={() => setShowNewJob(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity scale-press"
        >
          <Plus size={16} />
          New Job
        </button>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center gap-3 mb-5 bg-card border border-border rounded-lg px-4 py-3 w-fit">
        <Calendar size={16} className="text-muted-foreground" />
        <button
          onClick={handlePrevMonth}
          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          title="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-foreground min-w-[130px] text-center">
          {MONTH_NAMES[selectedMonth]} {selectedYear}
          {isCurrentMonth && (
            <span className="ml-2 text-xs text-primary font-normal">(Current)</span>
          )}
        </span>
        <button
          onClick={handleNextMonth}
          disabled={isCurrentMonth}
          className={`p-1 rounded transition-colors ${
            isCurrentMonth
              ? 'text-muted-foreground/30 cursor-not-allowed'
              : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
          }`}
          title="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by job name, client, site, suit name..."
          className="w-full pl-9 pr-4 py-2.5 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
        />
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1 scrollbar-thin">
        {STATUS_FILTERS.map((f) => {
          const count =
            f.value === 'All'
              ? monthJobs.length
              : monthJobs.filter((j) => j.status === f.value).length;
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
            {search || statusFilter !== 'All' ?'No jobs match your filters'
              : `No jobs in ${MONTH_NAMES[selectedMonth]} ${selectedYear}`}
          </h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            {search || statusFilter !== 'All' ?'Try adjusting your search or clearing the status filter.'
              : isCurrentMonth
              ? 'Create your first job for this month to get started.'
              : 'Use the month navigator to browse other months.'}
          </p>
          {!search && statusFilter === 'All' && isCurrentMonth && (
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
