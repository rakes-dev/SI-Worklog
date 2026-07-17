import React, { Suspense } from 'react';
import ArcClient from './ArcClient';
import { Loader2 } from 'lucide-react';

export default function ArcWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Loading ARC management...</p>
          </div>
        </div>
      }
    >
      <ArcClient />
    </Suspense>
  );
}