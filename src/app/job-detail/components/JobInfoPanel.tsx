'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pencil, Save, X, Loader2 } from 'lucide-react';
import type { Job, JobStatus } from '@/types';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatDate } from '@/utils/helpers';
import { useAppStore } from '@/store/useAppStore';

interface JobInfoPanelProps {
  job: Job;
  onSaved: () => void;
}

type FormValues = Omit<Job, 'id' | 'forms' | 'totalAmount' | 'createdAt' | 'updatedAt'>;

export default function JobInfoPanel({ job, onSaved }: JobInfoPanelProps) {
  const { updateJob } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      jobName: job.jobName,
      clientName: job.clientName,
      siteAddress: job.siteAddress,
      workStartDate: job.workStartDate,
      workEndDate: job.workEndDate,
      submittedToOffice: job.submittedToOffice,
      delay: job.delay,
      remarks: job.remarks,
      status: job.status,
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    await updateJob({ ...job, ...values, updatedAt: new Date().toISOString() });
    setSaving(false);
    setEditing(false);
    onSaved();
  };

  if (!editing) {
    return (
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Job Information</h2>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors scale-press"
          >
            <Pencil size={13} />
            Edit
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[
            { label: 'Job Name', value: job.jobName },
            { label: 'Client Name', value: job.clientName },
            { label: 'Site Address', value: job.siteAddress },
            { label: 'Status', value: <StatusBadge status={job.status} /> },
            { label: 'Work Start', value: formatDate(job.workStartDate) },
            { label: 'Work End', value: formatDate(job.workEndDate) || '—' },
            { label: 'Submitted to Office', value: formatDate(job.submittedToOffice) || '—' },
            { label: 'Delay', value: job.delay ? `${job.delay} days` : '—' },
          ].map((item, i) => (
            <div key={`info-${i}`} className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {item.label}
              </span>
              <span className="text-sm text-foreground">{item.value || '—'}</span>
            </div>
          ))}
          {job.remarks && (
            <div className="col-span-full flex flex-col gap-0.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Remarks
              </span>
              <span className="text-sm text-foreground">{job.remarks}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">Edit Job Information</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { reset(); setEditing(false); }}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Job Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('jobName', { required: 'Required' })}
              className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.jobName && <p className="text-xs text-red-500">{errors.jobName.message}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client Name</label>
            <input {...register('clientName')} className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Site Address</label>
            <input {...register('siteAddress')} className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Work Start Date</label>
            <input type="date" {...register('workStartDate')} className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Work End Date</label>
            <input type="date" {...register('workEndDate')} className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Submitted to Office</label>
            <input type="date" {...register('submittedToOffice')} className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Delay (days)</label>
            <input {...register('delay')} className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
            <select {...register('status')} className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {(['Draft', 'Pending', 'Approved'] as JobStatus[]).map((s) => (
                <option key={`edit-status-${s}`} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Remarks</label>
            <textarea {...register('remarks')} rows={2} className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => { reset(); setEditing(false); }} className="px-4 py-2 text-sm font-medium rounded-md border border-border text-foreground hover:bg-secondary transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity scale-press disabled:opacity-60 flex items-center gap-2 min-w-[100px] justify-center">
            {saving ? <><Loader2 size={14} className="animate-spin" />Saving...</> : <><Save size={14} />Save Changes</>}
          </button>
        </div>
      </form>
    </div>
  );
}