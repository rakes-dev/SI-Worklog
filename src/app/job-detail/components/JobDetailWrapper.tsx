import React, { Suspense } from 'react';
import JobDetailClient from './JobDetailClient';
import { Loader2 } from 'lucide-react';

export default function JobDetailWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Loading job...</p>
          </div>
        </div>
      }
    >
      <JobDetailClient />
    </Suspense>
  );
}