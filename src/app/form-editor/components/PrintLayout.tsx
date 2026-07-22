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
    <div 
      className="print-page" 
      style={{ 
        fontFamily: 'Arial, Helvetica, sans-serif', 
        fontSize: '10pt', 
        color: '#000',
        width: '100%',
        boxSizing: 'border-box',
        padding: '12.7mm' // MS Word Narrow Margin Config (0.5 inch / 12.7mm)
      }}
    >
      {/* Global Print Layout CSS Injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            margin: 12.7mm; /* Forces system print engine to respect MS Word Narrow margins */
          }
          body { background: #fff; color: #000; padding: 0; margin: 0; }
          .print-page { width: 100% !important; max-width: 100% !important; padding: 0 !important; }
          table { page-break-inside: auto; width: 100%; border-collapse: collapse; box-sizing: border-box; table-layout: fixed; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
        }
        /* Resets standard borders to prevent ghost right-edge columns */
        .print-clean-table {
          width: 100%;
          border-collapse: collapse;
          border-left: 1px solid #000;
          border-top: 1px solid #000;
          box-sizing: border-box;
        }
        .print-clean-table th, .print-clean-table td {
          border-right: 1px solid #000;
          border-bottom: 1px solid #000;
          box-sizing: border-box;
          word-wrap: break-word;
        }
      `}} />

      {/* Title */}
      <div className="print-title" style={{ fontSize: '14pt', fontWeight: 'bold', textAlign: 'center', marginBottom: '12pt' }}>
        STANDARD INTERIOR
      </div>

      {/* Header Table */}
      <table className="print-clean-table" style={{ marginBottom: '12pt' }}>
        <tbody>
          <tr>
            <td style={{ width: '25%', fontWeight: 'bold', padding: '4px' }}>Suit / Public Area Name:</td>
            <td style={{ width: '25%', padding: '4px' }}>{form.suitPublicAreaName}</td>
            <td style={{ width: '25%', fontWeight: 'bold', padding: '4px' }}>Date:</td>
            <td style={{ width: '25%', padding: '4px' }}>{formatDate(form.date)}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', padding: '4px' }}>Work Start Date:</td>
            <td style={{ padding: '4px' }}>{formatDate(form.workStartDate)}</td>
            <td style={{ fontWeight: 'bold', padding: '4px' }}>Work End Date:</td>
            <td style={{ padding: '4px' }}>{formatDate(form.workEndDate)}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', padding: '4px' }}>Submitted to Office:</td>
            <td style={{ padding: '4px' }}>{formatDate(form.submittedToOffice)}</td>
            <td style={{ fontWeight: 'bold', padding: '4px' }}>Delay:</td>
            <td style={{ padding: '4px' }}>{form.delay ? `${form.delay} days` : '—'}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', padding: '4px' }}>Total Sheets:</td>
            <td style={{ padding: '4px' }}>{form.totalSheets}</td>
            <td style={{ fontWeight: 'bold', padding: '4px' }}>Sheet No.:</td>
            <td style={{ padding: '4px' }}>{form.sheetNo}</td>
          </tr>
        </tbody>
      </table>

      {/* Section A */}
      <div className="print-section-header" style={{ fontWeight: 'bold', marginBottom: '4pt', fontSize: '11pt' }}>
        A. SUMMARY
      </div>
      <table className="print-clean-table" style={{ marginBottom: '12pt' }}>
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th className="text-center" style={{ width: '6%', padding: '4px' }}>Sl. No.</th>
            <th className="text-left" style={{ width: '20%', padding: '4px', textAlign: 'left' }}>Complaint Source</th>
            <th className="text-left" style={{ width: '18%', padding: '4px', textAlign: 'left' }}>Paint Type</th>
            <th className="text-center" style={{ width: '8%', padding: '4px' }}>Coat</th>
            <th className="text-center" style={{ width: '10%', padding: '4px' }}>ARC No.</th>
            <th className="text-right" style={{ width: '8%', padding: '4px', textAlign: 'right' }}>Qty</th>
            <th className="text-right" style={{ width: '14%', padding: '4px', textAlign: 'right' }}>Rate (₹)</th>
            <th className="text-right" style={{ width: '16%', padding: '4px', textAlign: 'right' }}>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {form.summaryRows.map((row) => (
            <tr key={`print-sr-${row.id}`}>
              <td className="text-center" style={{ padding: '4px', textAlign: 'center' }}>{row.slNo}</td>
              <td style={{ padding: '4px' }}>{row.complaintSource}</td>
              <td style={{ padding: '4px' }}>{row.paintType}</td>
              <td className="text-center" style={{ padding: '4px', textAlign: 'center' }}>{row.coat}</td>
              <td className="text-center" style={{ padding: '4px', textAlign: 'center' }}>{row.arcNo}</td>
              <td className="text-right" style={{ padding: '4px', textAlign: 'right' }}>{typeof row.qty === 'number' ? row.qty : ''}</td>
              <td className="text-right" style={{ padding: '4px', textAlign: 'right' }}>{typeof row.rate === 'number' ? formatCurrency(row.rate) : ''}</td>
              <td className="text-right" style={{ padding: '4px', textAlign: 'right' }}>{row.amount > 0 ? formatCurrency(row.amount) : ''}</td>
            </tr>
          ))}
          {form.summaryRows.length < 6 &&
            Array.from({ length: 6 - form.summaryRows.length }).map((_, i) => (
              <tr key={`print-sr-pad-${i}`}>
                <td style={{ padding: '4px' }}>&nbsp;</td>
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
            <td colSpan={7} style={{ fontWeight: 'bold', padding: '6px', textAlign: 'right' }}>
              GRAND TOTAL
            </td>
            <td style={{ fontWeight: 'bold', padding: '6px', textAlign: 'right' }}>
              ₹{formatCurrency(form.grandTotal)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Section B */}
      <div className="print-section-header" style={{ fontWeight: 'bold', marginTop: '14pt', marginBottom: '4pt', fontSize: '11pt' }}>
        B. MEASUREMENT SHEET &nbsp;&nbsp; <span style={{ fontSize: '9pt', fontWeight: 'normal' }}>Total Sheets: {form.totalSheets} &nbsp;&nbsp; Sheet No.: {form.sheetNo}</span>
      </div>
      <table className="print-clean-table" style={{ marginBottom: '12pt' }}>
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th className="text-center" style={{ width: '6%', padding: '4px' }}>Sl. No.</th>
            <th className="text-left" style={{ width: '18%', padding: '4px', textAlign: 'left' }}>Job Type</th>
            <th className="text-left" style={{ width: '22%', padding: '4px', textAlign: 'left' }}>Location</th>
            <th className="text-center" style={{ width: '8%', padding: '4px' }}>Coat</th>
            <th className="text-right" style={{ width: '10%', padding: '4px', textAlign: 'right' }}>Length (m)</th>
            <th className="text-right" style={{ width: '10%', padding: '4px', textAlign: 'right' }}>Width (m)</th>
            <th className="text-right" style={{ width: '8%', padding: '4px', textAlign: 'right' }}>No.</th>
            <th className="text-right" style={{ width: '18%', padding: '4px', textAlign: 'right' }}>Total Area (m²)</th>
          </tr>
        </thead>
        <tbody>
          {form.measurementRows.map((row) => (
            <tr key={`print-mr-${row.id}`}>
              <td className="text-center" style={{ padding: '4px', textAlign: 'center' }}>{row.slNo}</td>
              <td style={{ padding: '4px' }}>{row.jobType ?? ''}</td>
              <td style={{ padding: '4px' }}>{row.location}</td>
              <td className="text-center" style={{ padding: '4px', textAlign: 'center' }}>{row.coat}</td>
              <td className="text-right" style={{ padding: '4px', textAlign: 'right' }}>{typeof row.length === 'number' ? row.length : ''}</td>
              <td className="text-right" style={{ padding: '4px', textAlign: 'right' }}>{typeof row.width === 'number' ? row.width : ''}</td>
              <td className="text-right" style={{ padding: '4px', textAlign: 'right' }}>{typeof row.no === 'number' ? row.no : ''}</td>
              <td className="text-right" style={{ padding: '4px', textAlign: 'right' }}>{row.totalArea > 0 ? row.totalArea.toFixed(2) : ''}</td>
            </tr>
          ))}
          {form.measurementRows.length < 8 &&
            Array.from({ length: 8 - form.measurementRows.length }).map((_, i) => (
              <tr key={`print-mr-pad-${i}`}>
                <td style={{ padding: '4px' }}>&nbsp;</td>
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
            <td colSpan={7} style={{ fontWeight: 'bold', padding: '6px', textAlign: 'right' }}>
              TOTAL AREA
            </td>
            <td style={{ fontWeight: 'bold', padding: '6px', textAlign: 'right' }}>
              {form.totalArea.toFixed(2)} m²
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Signature Section */}
      <div className="avoid-break" style={{ marginTop: '16pt' }}>
        <table className="print-clean-table">
          <tbody>
            <tr>
              {SIG_LABELS.map((s) => (
                <td 
                  key={`print-sig-${s.key}`} 
                  style={{ 
                    width: '20%', 
                    verticalAlign: 'top', 
                    padding: '6px',
                    minHeight: '85pt' 
                  }}
                >
                  <div className="print-signature-label" style={{ fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '4px', fontSize: '9pt' }}>
                    {s.label}
                  </div>
                  <div style={{ marginTop: '35pt', fontSize: '8.5pt' }}>
                    <div className="print-signature-field" style={{ borderBottom: '1px dashed #999', paddingBottom: '2px', marginBottom: '6px' }}>
                      Sign:
                    </div>
                    <div className="print-signature-field" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                      Name: {form.signatures[s.key].name || ''}
                    </div>
                    <div className="print-signature-field">
                      Date: {form.signatures[s.key].date ? formatDate(form.signatures[s.key].date) : ''}
                    </div>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '15pt', borderTop: '1px solid #000', paddingTop: '4pt', fontSize: '8pt', color: '#555', display: 'flex', justifyContent: 'space-between' }}>
        <span>Document Ref: SI-PM-{form.sheetNo || '01'}</span>
        <span>Page {form.sheetNo || 1} of {form.totalSheets || 1}</span>
      </div>
    </div>
  );
}