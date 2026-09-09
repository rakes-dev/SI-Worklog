'use client';

import React, { useState } from 'react';
import { feetToMeters, metersToFeet } from '@/utils/helpers';

interface FtInInputProps {
  /** Stored value in METERS (source of truth). */
  value: number | '';
  disabled?: boolean;
  onChange: (v: number | '') => void;
}

/**
 * Feet + inches dual input for cft / rft / sqft rows. The user enters feet and inches;
 * it is converted to meters for storage.
 */
export default function FtInInput({ value, disabled = false, onChange }: FtInInputProps) {
  const totalFt = typeof value === 'number' && Number.isFinite(value) ? metersToFeet(value) : 0;
  const whole = Math.floor(totalFt);
  const fracIn = (totalFt - whole) * 12;

  const [ft, setFt] = useState(whole ? String(whole) : '');
  const [inch, setInch] = useState(fracIn ? String(parseFloat(fracIn.toFixed(3))) : '');

  const emit = (f: string, i: string) => {
    const fv = parseFloat(f);
    const iv = parseFloat(i);
    const ff = Number.isFinite(fv) ? fv : 0;
    const ii = Number.isFinite(iv) ? iv : 0;
    const total = ff + ii / 12;
    onChange(total > 0 ? parseFloat(feetToMeters(total).toFixed(6)) : '');
  };

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        inputMode="decimal"
        value={ft}
        disabled={disabled}
        onChange={(e) => {
          setFt(e.target.value);
          emit(e.target.value, inch);
        }}
        placeholder="ft"
        className="w-14 px-1.5 py-1 bg-input border border-transparent rounded text-right text-xs font-tabular text-foreground focus:outline-none focus:border-ring focus:bg-card transition disabled:opacity-40"
      />
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        value={inch}
        disabled={disabled}
        onChange={(e) => {
          setInch(e.target.value);
          emit(ft, e.target.value);
        }}
        placeholder="in"
        className="w-14 px-1.5 py-1 bg-input border border-transparent rounded text-right text-xs font-tabular text-foreground focus:outline-none focus:border-ring focus:bg-card transition disabled:opacity-40"
      />
    </div>
  );
}
