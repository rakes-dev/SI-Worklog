'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-md fade-in">
        <div className="flex items-start gap-3 p-5">
          <div className={`p-2 rounded-full ${destructive ? 'bg-red-100 dark:bg-red-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}>
            <AlertTriangle size={20} className={destructive ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground text-base">{title}</h3>
            <p className="text-muted-foreground text-sm mt-1">{message}</p>
          </div>
          <button onClick={onCancel} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-md border border-border text-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors scale-press ${
              destructive
                ? 'bg-red-600 hover:bg-red-700 text-white' :'bg-primary text-primary-foreground hover:opacity-90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}