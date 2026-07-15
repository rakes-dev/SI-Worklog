'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors = {
  success: 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300',
  error: 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300',
  warning: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300',
  info: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300',
};

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), 3500);
    return () => clearTimeout(t);
  }, [toast.id, onRemove]);

  const Icon = icons[toast.type];
  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg slide-up ${colors[toast.type]}`}>
      <Icon size={18} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{toast.title}</p>
        {toast.message && <p className="text-xs mt-0.5 opacity-80">{toast.message}</p>}
      </div>
      <button onClick={() => onRemove(toast.id)} className="opacity-60 hover:opacity-100 transition-opacity">
        <X size={14} />
      </button>
    </div>
  );
}

export default function ToastContainer({ toasts, onRemove }: ToastProps) {
  return (
    <div className="fixed bottom-20 lg:bottom-4 right-4 z-50 flex flex-col gap-2 w-80 no-print">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}