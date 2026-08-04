'use client';

import React from 'react';
import type { UseFormRegister, FieldErrors } from 'react-hook-form';
import type { PaintForm } from '@/types';

interface FormTopFieldsProps {
  register: UseFormRegister<PaintForm>;
  errors: FieldErrors<PaintForm>;
}

export default function FormTopFields({ register, errors }: FormTopFieldsProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wide">
        Form Header
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Suit / Public Area Name <span className="text-red-500">*</span>
          </label>
          <input
            {...register('suitPublicAreaName', { required: 'Required' })}
            className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g. Suite 201, Lobby, Ground Floor"
          />
          {errors.suitPublicAreaName && (
            <p className="text-xs text-red-500">{errors.suitPublicAreaName.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Form Name
          </label>
          <input
            {...register('formName')}
            className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</label>
          <input
            type="date"
            {...register('date')}
            className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Sheets</label>
          <input
            type="number"
            min={1}
            {...register('totalSheets', { valueAsNumber: true, min: 1 })}
            className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring font-tabular"
          />
        </div>
      </div>
    </div>
  );
}