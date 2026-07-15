'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Pencil, Copy, Trash2, FileText, MapPin, User, Calendar,  } from 'lucide-react';
import type { Job } from '@/types';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { formatDate, formatCurrency } from '@/utils/helpers';
import { useAppStore } from '@/store/useAppStore';

interface JobCardProps {
  job: Job;
  onDuplicate: (id: string) => void;
  onToast: (type: 'success' | 'error', title: string, msg?: string) => void;
}

export default function JobCard({ job, onDuplicate, onToast }: JobCardProps) {
  const router = useRouter();
  const { deleteJob } = useAppStore();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    await deleteJob(job.id);
    onToast('success', 'Job deleted', `"${job.jobName}" has been removed.`);
    setShowConfirm(false);
    setIsDeleting(false);
  };

  const handleOpen = () => {
    router.push(`/job-detail?id=${job.id}`);
  };

  return (
    <>
      <div
        className={`
          bg-card border border-border rounded-lg p-4 flex flex-col gap-3
          hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer group
          ${isDeleting ? 'opacity-50 pointer-events-none' : ''}
        `}
        onClick={handleOpen}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm truncate">{job.jobName}</h3>
            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
              <User size={11} />
              <span className="truncate">{job.clientName || 'No client set'}</span>
            </div>
          </div>
          <StatusBadge status={job.status} size="sm" />
        </div>

        {/* Meta */}
        <div className="flex flex-col gap-1.5">
          {job.siteAddress && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin size={11} className="flex-shrink-0" />
              <span className="truncate">{job.siteAddress}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar size={11} className="flex-shrink-0" />
            <span>{formatDate(job.workStartDate)}</span>
            {job.workEndDate && (
              <>
                <span>—</span>
                <span>{formatDate(job.workEndDate)}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText size={11} className="flex-shrink-0" />
            <span>
              {job.forms.length} form{job.forms.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Amount */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">Total Amount</span>
          <span className="font-semibold font-tabular text-sm text-foreground">
            ₹{formatCurrency(job.totalAmount)}
          </span>
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleOpen}
            title="Open job"
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors scale-press"
          >
            <Eye size={13} />
            Open
          </button>
          <button
            onClick={() => router.push(`/job-detail?id=${job.id}&edit=true`)}
            title="Edit job"
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors scale-press"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDuplicate(job.id)}
            title="Duplicate job"
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors scale-press"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            title="Delete job — this cannot be undone"
            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors scale-press"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <ConfirmModal
        open={showConfirm}
        title="Delete Job"
        message={`Are you sure you want to delete "${job.jobName}"? All forms and measurements will be permanently removed.`}
        confirmLabel="Delete Job"
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
        destructive
      />
    </>
  );
}