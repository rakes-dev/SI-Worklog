'use client';

import React from 'react';

const SIG_LABELS: { key: string; label: string }[] = [
  { key: 'standardInterior', label: 'Standard Interior' },
  { key: 'requestedBy', label: 'Requested By' },
  { key: 'qualityCheckHK', label: 'Quality Check by HK' },
  { key: 'qualityCheckEngg', label: 'Quality Check by Engg' },
  { key: 'measurementCheck', label: 'Measurement Check' },
];

function SigBox({ label }: { label: string }) {
  return (
    <div className="border border-border rounded-lg p-3 flex flex-col gap-2 bg-secondary/20">
      <p className="text-xs font-semibold text-foreground text-center border-b border-border pb-2">
        {label}
      </p>
      <div className="flex flex-col gap-1 flex-1">
        <div className="h-24 border border-dashed border-border rounded bg-input flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Sign here</span>
        </div>
      </div>
    </div>
  );
}

export default function SignatureSection() {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="font-semibold text-foreground text-sm mb-4">Signatures</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {SIG_LABELS.map((s) => (
          <SigBox
            key={`sig-${s.key}`}
            label={s.label}
          />
        ))}
      </div>
    </div>
  );
}