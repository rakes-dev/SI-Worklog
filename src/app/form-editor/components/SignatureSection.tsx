'use client';

import React from 'react';
import type { FormSignatures, SignatureEntry } from '@/types';

interface SignatureSectionProps {
  signatures: FormSignatures;
  onChange: (sigs: FormSignatures) => void;
}

const SIG_LABELS: { key: keyof FormSignatures; label: string }[] = [
  { key: 'standardInterior', label: 'Standard Interior' },
  { key: 'requestedBy', label: 'Requested By' },
  { key: 'qualityCheckHK', label: 'Quality Check by HK' },
  { key: 'qualityCheckEngg', label: 'Quality Check by Engg' },
  { key: 'measurementCheck', label: 'Measurement Check' },
];

function SigBox({
  label,
  entry,
  onChange,
}: {
  label: string;
  entry: SignatureEntry;
  onChange: (e: SignatureEntry) => void;
}) {
  return (
    <div className="border border-border rounded-lg p-3 flex flex-col gap-2 bg-secondary/20">
      <p className="text-xs font-semibold text-foreground text-center border-b border-border pb-2">
        {label}
      </p>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Signature</label>
        <div className="h-12 border border-dashed border-border rounded bg-input flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Sign here</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Name</label>
        <input
          value={entry.name}
          onChange={(e) => onChange({ ...entry, name: e.target.value })}
          className="w-full px-2 py-1.5 rounded border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring transition"
          placeholder="Full name"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Date</label>
        <input
          type="date"
          value={entry.date}
          onChange={(e) => onChange({ ...entry, date: e.target.value })}
          className="w-full px-2 py-1.5 rounded border border-border bg-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring transition"
        />
      </div>
    </div>
  );
}

export default function SignatureSection({ signatures, onChange }: SignatureSectionProps) {
  const update = (key: keyof FormSignatures, entry: SignatureEntry) => {
    onChange({ ...signatures, [key]: entry });
  };

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="font-semibold text-foreground text-sm mb-4">Signatures</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {SIG_LABELS.map((s) => (
          <SigBox
            key={`sig-${s.key}`}
            label={s.label}
            entry={signatures[s.key]}
            onChange={(e) => update(s.key, e)}
          />
        ))}
      </div>
    </div>
  );
}