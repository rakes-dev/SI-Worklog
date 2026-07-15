'use client';

import React from 'react';
import type { PaintForm, Job } from '@/types';
import { formatDate, formatCurrency } from '@/utils/helpers';

interface PrintLayoutProps {
  form: PaintForm;
  job: Job;
}

const SIG_LABELS = [
  { key: 'standardInterior' as const, label: 'Standard Interior' },
  { key: 'requestedBy' as const, label: 'Requested By' },
  { key: 'qualityCheckHK' as const, label: 'Quality Check by HK' },
  { key: 'qualityCheckEngg' as const, label: 'Quality Check by Engg' },
  { key: 'measurementCheck' as const, label: 'Measurement Check' },
];

export default function PrintLayout({ form, job }: PrintLayoutProps) {
  return (
    <div className="print-page" style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10pt', color: '#000' }}>
      {/* Title */}
      <div className="print-title">STANDARD INTERIOR</div>

      {/* Header Table */}
      <table className="print-header-table">
        <tbody>
          <tr>
            <td style={{ width: '25%', fontWeight: 'bold' }}>Suit / Public Area Name:</td>
            <td style={{ width: '25%' }}>{form.suitPublicAreaName}</td>
            <td style={{ width: '25%', fontWeight: 'bold' }}>Date:</td>
            <td style={{ width: '25%' }}>{formatDate(form.date)}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold' }}>Work Start Date:</td>
            <td>{formatDate(form.workStartDate)}</td>
            <td style={{ fontWeight: 'bold' }}>Work End Date:</td>
            <td>{formatDate(form.workEndDate)}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold' }}>Submitted to Office:</td>
            <td>{formatDate(form.submittedToOffice)}</td>
            <td style={{ fontWeight: 'bold' }}>Delay:</td>
            <td>{form.delay ? `${form.delay} days` : '—'}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold' }}>Total Sheets:</td>
            <td>{form.totalSheets}</td>
            <td style={{ fontWeight: 'bold' }}>Sheet No.:</td>
            <td>{form.sheetNo}</td>
          </tr>
        </tbody>
      </table>

      {/* Section A */}
      <div className="print-section-header">A. SUMMARY</div>
      <table className="print-table">
        <thead>
          <tr>
            <th className="text-center" style={{ width: '4%' }}>Sl. No.</th>
            <th className="text-left" style={{ width: '20%' }}>Complaint Source</th>
            <th className="text-left" style={{ width: '18%' }}>Paint Type</th>
            <th className="text-center" style={{ width: '8%' }}>Coat</th>
            <th className="text-center" style={{ width: '10%' }}>ARC No.</th>
            <th className="text-right" style={{ width: '8%' }}>Qty</th>
            <th className="text-right" style={{ width: '12%' }}>Rate (₹)</th>
            <th className="text-right" style={{ width: '14%' }}>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {form.summaryRows.map((row) => (
            <tr key={`print-sr-${row.id}`}>
              <td className="text-center">{row.slNo}</td>
              <td>{row.complaintSource}</td>
              <td>{row.paintType}</td>
              <td className="text-center">{row.coat}</td>
              <td className="text-center">{row.arcNo}</td>
              <td className="text-right">{typeof row.qty === 'number' ? row.qty : ''}</td>
              <td className="text-right">{typeof row.rate === 'number' ? formatCurrency(row.rate) : ''}</td>
              <td className="text-right">{row.amount > 0 ? formatCurrency(row.amount) : ''}</td>
            </tr>
          ))}
          {/* Padding rows to fill space */}
          {form.summaryRows.length < 6 &&
            Array.from({ length: 6 - form.summaryRows.length }).map((_, i) => (
              <tr key={`print-sr-pad-${i}`}>
                <td>&nbsp;</td>
                <td />
                <td />
                <td />
                <td />
                <td />
                <td />
                <td />
              </tr>
            ))}
        </tbody>
        <tfoot>
          <tr className="print-total-row">
            <td colSpan={7} className="text-right" style={{ fontWeight: 'bold' }}>
              GRAND TOTAL
            </td>
            <td className="text-right" style={{ fontWeight: 'bold' }}>
              ₹{formatCurrency(form.grandTotal)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Section B */}
      <div className="print-section-header" style={{ marginTop: '8pt' }}>
        B. MEASUREMENT SHEET &nbsp;&nbsp; Total Sheets: {form.totalSheets} &nbsp;&nbsp; Sheet No.: {form.sheetNo}
      </div>
      <table className="print-table">
        <thead>
          <tr>
            <th className="text-center" style={{ width: '4%' }}>Sl. No.</th>
            <th className="text-left" style={{ width: '28%' }}>Location</th>
            <th className="text-center" style={{ width: '8%' }}>Coat</th>
            <th className="text-right" style={{ width: '12%' }}>Length (m)</th>
            <th className="text-right" style={{ width: '12%' }}>Width (m)</th>
            <th className="text-right" style={{ width: '8%' }}>No.</th>
            <th className="text-right" style={{ width: '16%' }}>Total Area (m²)</th>
          </tr>
        </thead>
        <tbody>
          {form.measurementRows.map((row) => (
            <tr key={`print-mr-${row.id}`}>
              <td className="text-center">{row.slNo}</td>
              <td>{row.location}</td>
              <td className="text-center">{row.coat}</td>
              <td className="text-right">{typeof row.length === 'number' ? row.length : ''}</td>
              <td className="text-right">{typeof row.width === 'number' ? row.width : ''}</td>
              <td className="text-right">{typeof row.no === 'number' ? row.no : ''}</td>
              <td className="text-right">{row.totalArea > 0 ? row.totalArea.toFixed(2) : ''}</td>
            </tr>
          ))}
          {form.measurementRows.length < 8 &&
            Array.from({ length: 8 - form.measurementRows.length }).map((_, i) => (
              <tr key={`print-mr-pad-${i}`}>
                <td>&nbsp;</td>
                <td />
                <td />
                <td />
                <td />
                <td />
                <td />
              </tr>
            ))}
        </tbody>
        <tfoot>
          <tr className="print-total-row">
            <td colSpan={6} className="text-right" style={{ fontWeight: 'bold' }}>
              TOTAL AREA
            </td>
            <td className="text-right" style={{ fontWeight: 'bold' }}>
              {form.totalArea.toFixed(2)} m²
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Signature Section */}
      <table className="print-signature-table" style={{ marginTop: '12pt' }}>
        <tbody>
          <tr>
            {SIG_LABELS.map((s) => (
              <td key={`print-sig-${s.key}`} style={{ width: '20%', verticalAlign: 'top', height: '70pt' }}>
                <div className="print-signature-label">{s.label}</div>
                <div style={{ marginTop: '28pt' }}>
                  <div className="print-signature-field">
                    Signature: _______________
                  </div>
                  <div className="print-signature-field" style={{ marginTop: '4pt' }}>
                    Name: {form.signatures[s.key].name || '_______________'}
                  </div>
                  <div className="print-signature-field" style={{ marginTop: '4pt' }}>
                    Date: {form.signatures[s.key].date ? formatDate(form.signatures[s.key].date) : '_______________'}
                  </div>
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {/* Footer */}
      <div style={{ marginTop: '8pt', borderTop: '1px solid #000', paddingTop: '4pt', fontSize: '8pt', display: 'flex', justifyContent: 'space-between' }}>
        <span>Printed: {new Date().toLocaleDateString('en-GB')}</span>
      </div>
    </div>
  );
}