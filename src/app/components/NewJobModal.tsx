'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { defaultJob, generateId } from '@/utils/helpers';
import type { Job, JobStatus } from '@/types';

interface NewJobModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (job: Job) => void;
}

interface FormValues {
  jobName: string;
  clientName: string;
  siteAddress: string;
  workStartDate: string;
  workEndDate: string;
  submittedToOffice: string;
  delay: string;
  remarks: string;
  status: JobStatus;
}

export default function NewJobModal({ open, onClose, onCreated }: NewJobModalProps) {
  const { addJob } = useAppStore();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      jobName: '',
      clientName: 'ITC',
      siteAddress: 'Kolkata',
      workStartDate: new Date().toISOString().split('T')[0],
      workEndDate: '',
      submittedToOffice: '',
      delay: '',
      remarks: '',
      status: 'Draft',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    const job: Job = {
      ...defaultJob(),
      ...values,
      id: generateId('job'),
    };
    await addJob(job);
    onCreated(job);
    reset();
    setSaving(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground text-lg">New Painting Job</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 flex flex-col gap-4">
          {/* Job Name */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">
              Job Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('jobName', { required: 'Job name is required' })}
              className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
              placeholder="e.g. Hotel ABC Renovation"
            />
            {errors.jobName && (
              <p className="text-xs text-red-500">{errors.jobName.message}</p>
            )}
          </div>

          {/* Client Name */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Client Name</label>
            <input
              {...register('clientName')}
              className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
              placeholder="e.g. Marriott Hotels Ltd."
            />
          </div>

          {/* Site Address */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Site Address</label>
            <input
              {...register('siteAddress')}
              className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
              placeholder="e.g. 12 MG Road, Bangalore"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">Work Start Date</label>
              <input
                type="date"
                {...register('workStartDate')}
                className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">Work End Date</label>
              <input
                type="date"
                {...register('workEndDate')}
                className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
            </div>
          </div>

          {/* Submitted / Delay */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">Submitted to Office</label>
              <input
                type="date"
                {...register('submittedToOffice')}
                className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">Delay (days)</label>
              <input
                {...register('delay')}
                className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
                placeholder="0"
              />
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Status</label>
            <select
              {...register('status')}
              className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
            >
              {(['Draft', 'Pending', 'Approved'] as JobStatus[]).map(
                (s) => (
                  <option key={`status-opt-${s}`} value={s}>
                    {s}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Remarks */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Remarks</label>
            <textarea
              {...register('remarks')}
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition resize-none"
              placeholder="Any additional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-md border border-border text-foreground hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity scale-press disabled:opacity-60 flex items-center gap-2 min-w-[120px] justify-center"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Job'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}