'use client';

import React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChevronLeft, Printer } from 'lucide-react';
import Link from 'next/link';
import { useAppStore } from '@/store/useAppStore';
import JobInfoPanel from './JobInfoPanel';
import FormsTable from './FormsTable';
import ToastContainer from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/helpers';
import StatusBadge from '@/components/ui/StatusBadge';

export default function JobDetailClient() {
  const params = useSearchParams();
  const router = useRouter();
  const { jobs, loadJobs } = useAppStore();
  const { toasts, addToast, removeToast } = useToast();

  const jobId = params?.get('id');
  const job = jobs?.find((j) => j?.id === jobId);

  if (!jobId || !job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
          <Printer size={28} className="text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Job not found</h2>
        <p className="text-muted-foreground text-sm mb-5">
          This job may have been deleted or the link is invalid.
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

  return (
    <div className="min-h-full p-4 lg:p-6 xl:p-8 pb-20 lg:pb-8 max-w-screen-2xl mx-auto">
      {/* Breadcrumb + Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">{job?.jobName}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{job?.jobName}</h1>
            <StatusBadge status={job?.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {job?.clientName} · {job?.forms?.length} form{job?.forms?.length !== 1 ? 's' : ''} ·{' '}
            <span className="font-tabular font-semibold text-foreground">
              ₹{formatCurrency(job?.totalAmount)}
            </span>{' '}
            total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router?.back()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors scale-press"
          >
            <ChevronLeft size={15} />
            Back
          </button>
        </div>
      </div>
      {/* Job Info Panel */}
      <div className="mb-5">
        <JobInfoPanel
          job={job}
          onSaved={() => {
            loadJobs();
            addToast('success', 'Job updated', 'Changes saved successfully.');
          }}
        />
      </div>
      {/* Forms Table */}
      <FormsTable job={job} onToast={addToast} />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}