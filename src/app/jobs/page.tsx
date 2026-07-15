import React from 'react';
import { Metadata } from 'next';
import AppLayout from '@/components/AppLayout';
import JobsClient from './components/JobsClient';

export const metadata: Metadata = {
  title: 'Jobs | SI WorkLog',
};

export default function JobsPage() {
  return (
    <AppLayout>
      <JobsClient />
    </AppLayout>
  );
}
