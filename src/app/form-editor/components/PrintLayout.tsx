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

const FIRST_PAGE_MAX_ROWS_WITH_SUMMARY = 27;
const FIRST_PAGE_MAX_ROWS_WITHOUT_SUMMARY = 31;
const SUBSEQUENT_PAGE_MAX_ROWS = 27;

function isEmptySummaryRow(row: PaintForm['summaryRows'][number]): boolean {
  return (
    (!row.complaintSource.trim() || row.complaintSource.trim() === 'Engineer Dept.') &&
    !row.paintType.trim() &&
    !row.coat.trim() &&
    !row.arcNo.trim() &&
    (row.qty === '' || row.qty === 0) &&
    (row.rate === '' || row.rate === 0) &&
    row.amount === 0
  );
}

function isEmptyMeasurementRow(row: PaintForm['measurementRows'][number]): boolean {
  return (
    !row.jobType?.trim() &&
    !row.location.trim() &&
    !row.coat.trim() &&
    (row.length === '' || row.length === 0) &&
    (row.width === '' || row.width === 0) &&
    (row.no === '' || row.no === 0) &&
    row.totalArea === 0
  );
}

export default function PrintLayout({ form, job }: PrintLayoutProps) {
  const visibleSummaryRows = form.summaryRows.filter((row) => !isEmptySummaryRow(row));
  const visibleMeasurementRows = form.measurementRows.filter((row) => !isEmptyMeasurementRow(row));

  const hasSummaryRows = visibleSummaryRows.length > 0;
  const firstPageLimit = hasSummaryRows
    ? FIRST_PAGE_MAX_ROWS_WITH_SUMMARY
    : FIRST_PAGE_MAX_ROWS_WITHOUT_SUMMARY;

  // Split measurement rows into pages
  const measurementPages: Array<{
    rows: typeof form.measurementRows;
    pageNum: number;
    isLast: boolean;
  }> = [];

  const allRows = visibleMeasurementRows.map((row, index) => ({
    ...row,
    slNo: index + 1,
  }));
  if (allRows.length === 0) {
    measurementPages.push({ rows: [], pageNum: 1, isLast: true });
  } else {
    let currentLimit = firstPageLimit;
    let pageNum = 1;
    while (allRows.length > 0) {
      const chunk = allRows.splice(0, currentLimit);
      measurementPages.push({
        rows: chunk,
        pageNum,
        isLast: allRows.length === 0,
      });
      pageNum++;
      currentLimit = SUBSEQUENT_PAGE_MAX_ROWS;
    }
  }

  const totalPages = measurementPages.length;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          html, body {
            background: #fff !important;
            color: #000 !important;
            padding: 0 !important;
            margin: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }
          .print-page {
            width: 99% !important;
            max-width: 100% !important;
            min-height: 275mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            padding: 0 !important;
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .page-break-after {
            page-break-after: always !important;
            break-after: page !important;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            box-sizing: border-box;
            table-layout: fixed;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
        }
        .print-clean-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #000;
          box-sizing: border-box;
        }
        .print-clean-table th, .print-clean-table td {
          border: 1px solid #000;
          box-sizing: border-box;
          word-wrap: break-word;
        }
      `,
        }}
      />

      {measurementPages.map((page, pageIdx) => {
        const isFirstPage = pageIdx === 0;
        const isLastPage = page.isLast;

        return (
          <div
            key={`print-page-${page.pageNum}`}
            className={`print-page ${!isLastPage ? 'page-break-after' : ''}`}
            style={{
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: '10pt',
              color: '#000',
              padding: '10mm',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '275mm',
              boxSizing: 'border-box',
            }}
          >
            {/* Top Content (Header, Summary, Measurement Sheet) */}
            <div style={{ flex: 1 }}>
              {/* FIRST PAGE HEADER & SUMMARY */}
              {isFirstPage && (
                <>
                  {/* Title */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '5pt',
                      padding: '4pt 0',
                    }}
                  >
                    <span style={{ fontSize: '8pt', fontWeight: 'normal', whiteSpace: 'nowrap' }}>
                      Measurement Sheet No.: {form.sheetNo}
                    </span>
                    <span
                      style={{
                        fontSize: '14pt',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        flex: 1,
                      }}
                    >
                      STANDARD INTERIOR
                    </span>
                    <span style={{ fontSize: '8pt', fontWeight: 'normal', whiteSpace: 'nowrap' }}>
                      Date: {formatDate(form.date)}
                    </span>
                  </div>

                  {/* Header Info Table */}
                  <table className="print-clean-table" style={{ marginBottom: '10pt', fontSize: '8pt' }}>
                    <tbody>
                      <tr>
                        <td style={{ width: '25%', fontWeight: 'bold', padding: '2px', paddingLeft: '4px' }}>
                          Suit / Public Area Name:
                        </td>
                        <td style={{ width: '25%', padding: '2px', paddingLeft: '4px' }}>
                          {form.suitPublicAreaName || '—'}
                        </td>
                        <td style={{ width: '25%', fontWeight: 'bold', padding: '2px', paddingLeft: '4px' }}>Work Start Date:</td>
                        <td style={{ width: '25%', padding: '2px', paddingLeft: '4px' }}>{formatDate(form.workStartDate)}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 'bold', padding: '2px', paddingLeft: '4px' }}>Total Sheets:</td>
                        <td style={{ padding: '2px', paddingLeft: '4px' }}>{form.totalSheets}</td>
                        <td style={{ fontWeight: 'bold', padding: '2px', paddingLeft: '4px' }}>Work End Date:</td>
                        <td style={{ padding: '2px', paddingLeft: '4px' }}>{formatDate(form.workEndDate)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Section A — Summary */}
                  {hasSummaryRows && (
                    <>
                      <div
                        style={{
                          fontWeight: 'bold',
                          marginBottom: '4pt',
                          fontSize: '11pt',
                          border: '1px solid #000',
                          padding: '4px 6px',
                          background: '#f0f0f0',
                        }}
                      >
                        A. SUMMARY
                      </div>
                      <table className="print-clean-table" style={{ marginBottom: '10pt', fontSize: '8pt' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f2f2f2' }}>
                            <th style={{ width: '6%', padding: '4px', textAlign: 'center' }}>
                              Sl. No.
                            </th>
                            <th style={{ width: '20%', padding: '4px', textAlign: 'left' }}>
                              Complaint Source
                            </th>
                            <th style={{ width: '18%', padding: '4px', textAlign: 'left' }}>
                              Paint Type
                            </th>
                            <th style={{ width: '10%', padding: '4px', textAlign: 'center' }}>Coat</th>
                            <th style={{ width: '8%', padding: '4px', textAlign: 'center' }}>
                              ARC No.
                            </th>
                            <th style={{ width: '8%', padding: '4px', textAlign: 'right' }}>Qty</th>
                            <th style={{ width: '14%', padding: '4px', textAlign: 'right' }}>
                              Rate (₹)
                            </th>
                            <th style={{ width: '16%', padding: '4px', textAlign: 'right' }}>
                              Amount (₹)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleSummaryRows.map((row, index) => (
                            <tr key={`print-sr-${row.id}`}>
                              <td style={{ padding: '2px', textAlign: 'center' }}>{index + 1}</td>
                              <td style={{ padding: '2px' }}>{row.complaintSource}</td>
                              <td style={{ padding: '2px' }}>{row.paintType}</td>
                              <td style={{ padding: '2px', textAlign: 'center' }}>{row.coat}</td>
                              <td style={{ padding: '2px', textAlign: 'center' }}>{row.arcNo}</td>
                              <td style={{ padding: '2px', textAlign: 'right' }}>
                                {typeof row.qty === 'number' ? row.qty : ''}
                              </td>
                              <td style={{ padding: '2px', textAlign: 'right' }}>
                                {typeof row.rate === 'number' ? formatCurrency(row.rate) : ''}
                              </td>
                              <td style={{ padding: '2px', textAlign: 'right' }}>
                                {row.amount > 0 ? formatCurrency(row.amount) : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td
                              colSpan={7}
                              style={{
                                fontWeight: 'bold',
                                padding: '5px',
                                textAlign: 'right',
                                borderTop: '2px solid #000',
                              }}
                            >
                              GRAND TOTAL
                            </td>
                            <td
                              style={{
                                fontWeight: 'bold',
                                padding: '5px',
                                textAlign: 'right',
                                borderTop: '2px solid #000',
                              }}
                            >
                              ₹{formatCurrency(form.grandTotal)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </>
                  )}
                </>
              )}

              {/* Section B — Measurement Sheet */}
              <div
                style={{
                  fontWeight: 'bold',
                  marginTop: !isFirstPage || hasSummaryRows ? '10pt' : '0',
                  marginBottom: '4pt',
                  fontSize: '11pt',
                  border: '1px solid #000',
                  padding: '4px 6px',
                  background: '#f0f0f0',
                }}
              >
                B. MEASUREMENT SHEET{' '}
                <span style={{ fontSize: '9pt', fontWeight: 'normal' }}>
                  {totalPages > 1 ? `(Page ${page.pageNum} of ${totalPages})` : ''}
                  &nbsp;&nbsp; Total Sheets: {form.totalSheets}
                </span>
              </div>

              <table className="print-clean-table" style={{ marginBottom: '10pt', fontSize: '8pt' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f2f2f2' }}>
                    <th style={{ width: '6%', padding: '4px', textAlign: 'center' }}>Sl. No.</th>
                    <th style={{ width: '18%', padding: '4px', textAlign: 'left' }}>Job Type</th>
                    <th style={{ width: '30%', padding: '4px', textAlign: 'left' }}>Location</th>
                    <th style={{ width: '8%', padding: '4px', textAlign: 'center' }}>Coat</th>
                    <th style={{ width: '10%', padding: '4px', textAlign: 'right' }}>Length (m)</th>
                    <th style={{ width: '10%', padding: '4px', textAlign: 'right' }}>Width (m)</th>
                    <th style={{ width: '4%', padding: '4px', textAlign: 'right' }}>No.</th>
                    <th style={{ width: '14%', padding: '4px', textAlign: 'right' }}>
                      Total Area (m²)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((row) => (
                    <tr key={`print-mr-${row.id}`}>
                      <td style={{ padding: '2px', textAlign: 'center' }}>{row.slNo}</td>
                      <td style={{ padding: '2px' }}>{row.jobType ?? ''}</td>
                      <td style={{ padding: '2px' }}>{row.location}</td>
                      <td style={{ padding: '2px', textAlign: 'center' }}>{row.coat}</td>
                      <td style={{ padding: '2px', textAlign: 'right' }}>
                        {typeof row.length === 'number' ? row.length : ''}
                      </td>
                      <td style={{ padding: '2px', textAlign: 'right' }}>
                        {typeof row.width === 'number' ? row.width : ''}
                      </td>
                      <td style={{ padding: '2px', textAlign: 'right' }}>
                        {typeof row.no === 'number' ? row.no : ''}
                      </td>
                      <td style={{ padding: '2px', textAlign: 'right' }}>
                        {row.totalArea > 0 ? row.totalArea.toFixed(2) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signature Section & Footer pinned to the bottom on the last page */}
            {isLastPage && (
              <div>
                <div className="avoid-break">
                  <table className="print-clean-table" style={{ border: 'none'}}>
                    <tbody>
                      <tr>
                        {SIG_LABELS.map((s) => (
                          <td
                            key={`print-sig-${s.key}`}
                            style={{
                              width: '20%',
                              verticalAlign: 'top',
                              padding: '5px',
                              height: '30pt',
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 'bold',
                                borderBottom: '1px solid #eee',
                                paddingBottom: '3px',
                                fontSize: '8.5pt',
                              }}
                            >
                              {s.label}
                            </div>
                            <div style={{ marginTop: '12pt', fontSize: '8pt' }}>
                              <div style={{ borderBottom: '1px dashed #999', paddingBottom: '2px' }}>
                                Sign:
                              </div>
                            </div>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div
                  style={{
                    marginTop: '8pt',
                    // borderTop: '1px solid #000',
                    paddingTop: '4pt',
                    fontSize: '8pt',
                    color: '#555',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Document Ref: SI-PM-01</span>
                  <span>
                    Page {page.pageNum} of {totalPages}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}