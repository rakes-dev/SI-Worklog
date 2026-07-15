'use client';

import React from 'react';
import { Briefcase, Clock, CheckCircle, DollarSign, FileText } from 'lucide-react';
import type { Job } from '@/types';
import { formatCurrency } from '@/utils/helpers';
import Icon from '@/components/ui/AppIcon';


interface DashboardStatsProps {
  jobs: Job[];
}

export default function DashboardStats({ jobs }: DashboardStatsProps) {
  const total = jobs.length;
  const pending = jobs.filter((j) => j.status === 'Pending').length;
  // const submitted = jobs.filter((j) => j.status === 'Submitted').length;
  const approved = jobs.filter((j) => j.status === 'Approved').length;
  // const rejected = jobs.filter((j) => j.status === 'Rejected').length;
  const totalForms = jobs.reduce((s, j) => s + j.forms.length, 0);
  const totalValue = jobs.reduce((s, j) => s + j.totalAmount, 0);

  const stats = [
    {
      key: 'stat-total',
      label: 'Total Jobs',
      value: total,
      icon: Briefcase,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      isCurrency: false,
    },
    {
      key: 'stat-pending',
      label: 'Pending',
      value: pending,
      icon: Clock,
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      isCurrency: false,
      alert: pending > 0,
    },
    {
      key: 'stat-approved',
      label: 'Approved',
      value: approved,
      icon: CheckCircle,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
      isCurrency: false,
    },
    {
      key: 'stat-forms',
      label: 'Total Forms',
      value: totalForms,
      icon: FileText,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      isCurrency: false,
    },
    {
      key: 'stat-value',
      label: 'Total Job Value',
      value: totalValue,
      icon: DollarSign,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      isCurrency: true,
      wide: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.key}
            className={`bg-card border rounded-lg p-4 flex flex-col gap-2 ${
              s.alert ? 'border-yellow-400 dark:border-yellow-600' : 'border-border'
            }`}
          >
            <div className={`w-8 h-8 rounded-md flex items-center justify-center ${s.bg}`}>
              <Icon size={16} className={s.color} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                {s.label}
              </p>
              <p className={`text-xl font-bold font-tabular text-foreground mt-0.5`}>
                {s.isCurrency ? `₹${formatCurrency(s.value as number)}` : s.value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}