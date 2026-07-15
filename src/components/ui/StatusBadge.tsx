import React from 'react';
import type { JobStatus } from '@/types';
import { statusColor } from '@/utils/helpers';

interface StatusBadgeProps {
  status: JobStatus | string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${statusColor(status)} ${
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
      }`}
    >
      {status}
    </span>
  );
}