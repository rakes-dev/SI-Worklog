'use client';

import React from 'react';
import type { PaintForm, Job } from '@/types';
import { formatDate, formatCurrency, calcAreaUnitLabel, aggregateAreaUnitLabel, linearUnitLabel, linearCellValue, linearUnitSuffix } from '@/utils/helpers';

interface PdfExportLayoutProps {
  form: PaintForm;
  job: Job;
}

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
    (row.height === '' || row.height === 0) &&
    (row.length === '' || row.length === 0) &&
    (row.width === '' || row.width === 0) &&
    (row.no === '' || row.no === 0) &&
    row.totalArea === 0
  );
}

const SIG_LABELS = [
  { key: 'standardInterior' as const, label: 'Standard Interior' },
  { key: 'requestedBy' as const, label: 'Requested By' },
  { key: 'qualityCheckHK' as const, label: 'Quality check by HK' },
  { key: 'qualityCheckEngg' as const, label: 'Quality check by Engg' },
  { key: 'measurementCheck' as const, label: 'Measurement Check' },
];

const FIRST_PAGE_MAX_ROWS = 27;
const SUBSEQUENT_PAGE_MAX_ROWS = 32;

const CELL_PAD = { padding: '2px 4px' } as const;

export default function PdfExportLayout({ form, job }: PdfExportLayoutProps) {
  const isCarpenter = form.formType === 'carpenter';
  const visibleSummaryRows = form.summaryRows.filter((r) => !isEmptySummaryRow(r));
  const visibleMeasurementRows = form.measurementRows.filter((r) => !isEmptyMeasurementRow(r));
  const hasSummaryRows = visibleSummaryRows.length > 0;

  // Pagination (mirrors the print layout): page 1 carries the header + summary
  // + the first batch of measurement rows; later pages continue the rows.
  const locationDeduction = visibleMeasurementRows.reduce((total, row) => {
    const locLen = (row.location ?? '').length;
    return total + Math.floor(locLen / 35);
  }, 0);
  const summaryDeduction = visibleSummaryRows.length > 5 ? 1 : 0;
  const firstPageLimit = hasSummaryRows
    ? Math.max(1, FIRST_PAGE_MAX_ROWS - locationDeduction - summaryDeduction)
    : FIRST_PAGE_MAX_ROWS;

  const allRows = visibleMeasurementRows.map((row, index) => ({ ...row, slNo: index + 1 }));
  const pages: Array<{ rows: typeof form.measurementRows; pageNum: number; isLast: boolean }> = [];
  if (allRows.length === 0) {
    pages.push({ rows: [], pageNum: 1, isLast: true });
  } else {
    let limit = firstPageLimit;
    let pageNum = 1;
    const remaining = [...allRows];
    while (remaining.length > 0) {
      const chunk = remaining.splice(0, limit);
      pages.push({ rows: chunk, pageNum, isLast: remaining.length === 0 });
      pageNum += 1;
      limit = SUBSEQUENT_PAGE_MAX_ROWS;
    }
  }

  const areaUnit = aggregateAreaUnitLabel(visibleMeasurementRows.map((r) => r.uom));

  // Linear column (Length/Width/Height) header label & cell formatting.
  // Uniform feet-based rows -> "Length (ft)"; uniform meters -> "Length (m)";
  // mixed UOMs -> plain "Length" and the unit (m / ft) is appended after each
  // number in the cell.
  const linUnit = linearUnitLabel(visibleMeasurementRows.map((r) => r.uom));
  const isMixedLinear = linUnit === 'm/ft';
  const linHeader = (what: string) => (isMixedLinear ? what : `${what} (${linUnit})`);
  const linCell = (uom: string | undefined, value: number | '') =>
    value === '' ? '' : `${linearCellValue(uom, value)}${isMixedLinear ? ` ${linearUnitSuffix(uom)}` : ''}`;

  return (
    <div
      className="pdf-export-root"
      style={{
        width: 794,
        background: '#ffffff',
        color: '#000000',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '10pt',
      }}
    >
      <style>{`
        .pdf-page {
          width: 794px;
          min-height: 1123px;
          box-sizing: border-box;
          padding: 10mm;
          display: flex;
          flex-direction: column;
          background: #ffffff;
        }
        .pdf-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: separate;
          border-spacing: 0;
          border-top: 0.5px solid #000000;
          border-left: 0.5px solid #000000;
        }
        .pdf-table th, .pdf-table td {
          box-sizing: border-box;
          vertical-align: middle;
          padding: 2px 4px;
          word-wrap: break-word;
          border-right: 0.5px solid #000000;
          border-bottom: 0.5px solid #000000;
        }
        .pdf-section {
          font-weight: bold;
          font-size: 11pt;
          padding: 3px 6px;
          margin-bottom: 4pt;
          border: 0.5px solid #000000;
          background: #f0f0f0;
        }
      `}</style>

      {pages.map((page, pageIdx) => {
        const isFirstPage = pageIdx === 0;
        const isLastPage = page.isLast;

        return (
          <div key={`pdf-page-${page.pageNum}`} className="pdf-page">
            {/* ===== First page header & summary ===== */}
            {isFirstPage && (
              <div style={{ flex: 'none' }}>
                {/* Title */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5pt' }}>
                  <span style={{ fontSize: '8pt', whiteSpace: 'nowrap' }}>
                    Measurement Sheet No.: {form.sheetNo}
                  </span>
                  <span style={{ fontSize: '14pt', fontWeight: 'bold', textAlign: 'center', flex: 1 }}>
                    STANDARD INTERIOR
                  </span>
                  <span style={{ fontSize: '8pt', whiteSpace: 'nowrap' }}>Date: {formatDate(form.date)}</span>
                </div>

                {/* Header info table */}
                <table className="pdf-table" style={{ marginBottom: '8pt', fontSize: '8pt' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '25%', fontWeight: 'bold', ...CELL_PAD }}>Suit / Public Area Name:</td>
                      <td style={{ width: '25%', ...CELL_PAD }}>{form.suitPublicAreaName || '—'}</td>
                      <td style={{ width: '25%', fontWeight: 'bold', ...CELL_PAD }}>Work Start Date:</td>
                      <td style={{ width: '25%', ...CELL_PAD }}>{formatDate(form.workStartDate)}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', ...CELL_PAD }}>Total Sheets:</td>
                      <td style={CELL_PAD}>{form.totalSheets}</td>
                      <td style={{ fontWeight: 'bold', ...CELL_PAD }}>Work End Date:</td>
                      <td style={CELL_PAD}>{formatDate(form.workEndDate)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Section A — Summary */}
                {hasSummaryRows && (
                  <>
                    <div className="pdf-section">A. SUMMARY</div>
                    <table className="pdf-table" style={{ marginBottom: '8pt', fontSize: '8pt' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f2f2f2' }}>
                          <th style={{ width: '6%', textAlign: 'center' }}>Sl. No.</th>
                          <th style={{ width: '20%', textAlign: 'left' }}>Complaint Source</th>
                          <th style={{ width: '18%', textAlign: 'left' }}>Paint Type</th>
                          {!isCarpenter && (
                            <th style={{ width: '10%', textAlign: 'center' }}>Coat</th>
                          )}
                          <th style={{ width: '8%', textAlign: 'center' }}>ARC No.</th>
                          <th style={{ width: '8%', textAlign: 'right' }}>Qty</th>
                          <th style={{ width: '14%', textAlign: 'right' }}>Rate (₹)</th>
                          <th style={{ width: '16%', textAlign: 'right' }}>Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleSummaryRows.map((row, index) => (
                          <tr key={`pdf-sr-${row.id}`}>
                            <td style={{ textAlign: 'center', ...CELL_PAD }}>{index + 1}</td>
                            <td style={CELL_PAD}>{row.complaintSource}</td>
                            <td style={CELL_PAD}>{row.paintType}</td>
                            {!isCarpenter && (
                              <td style={{ textAlign: 'center', ...CELL_PAD }}>{row.coat}</td>
                            )}
                            <td style={{ textAlign: 'center', ...CELL_PAD }}>{row.arcNo}</td>
                            <td style={{ textAlign: 'right', ...CELL_PAD }}>
                              {typeof row.qty === 'number' ? row.qty.toFixed(2) : ''}
                            </td>
                            <td style={{ textAlign: 'right', ...CELL_PAD }}>
                              {typeof row.rate === 'number' ? formatCurrency(row.rate) : ''}
                            </td>
                            <td style={{ textAlign: 'right', ...CELL_PAD }}>
                              {row.amount > 0 ? formatCurrency(row.amount) : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={isCarpenter ? 6 : 7} style={{ fontWeight: 'bold', textAlign: 'right', ...CELL_PAD }}>
                            GRAND TOTAL
                          </td>
                          <td style={{ fontWeight: 'bold', textAlign: 'right', ...CELL_PAD }}>
                            ₹{formatCurrency(form.grandTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </>
                )}
              </div>
            )}

            {/* Measurement rows for this page */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div className="pdf-section" style={{ marginTop: isFirstPage && hasSummaryRows ? '8pt' : 0 }}>
                B. MEASUREMENT SHEET
              </div>
              <table className="pdf-table" style={{ fontSize: '8pt' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f2f2f2' }}>
                    <th style={{ width: '6%', textAlign: 'center' }}>Sl. No.</th>
                    <th style={{ width: '18%', textAlign: 'left' }}>Job Type</th>
                    <th style={{ width: '30%', textAlign: 'left' }}>Location</th>
                    <th style={{ width: '12%', textAlign: 'center' }}>{isCarpenter ? linHeader('Height') : 'Coat'}</th>
                    <th style={{ width: '10%', textAlign: 'right' }}>{linHeader('Length')}</th>
                    <th style={{ width: '10%', textAlign: 'right' }}>{linHeader('Width')}</th>
                    <th style={{ width: '4%', textAlign: 'right' }}>No.</th>
                    <th style={{ width: '10%', textAlign: 'right' }}>Total Area ({areaUnit})</th>
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((row) => (
                    <tr key={`pdf-mr-${row.id}`}>
                      <td style={{ textAlign: 'center', ...CELL_PAD }}>{row.slNo}</td>
                      <td style={CELL_PAD}>{row.jobType ?? ''}</td>
                      <td style={CELL_PAD}>{row.location}</td>
                      <td style={{ textAlign: 'center', ...CELL_PAD }}>
                        {isCarpenter ? linCell(row.uom, row.height) : row.coat}
                      </td>
                      <td style={{ textAlign: 'right', ...CELL_PAD }}>
                        {linCell(row.uom, row.length)}
                      </td>
                      <td style={{ textAlign: 'right', ...CELL_PAD }}>
                        {linCell(row.uom, row.width)}
                      </td>
                      <td style={{ textAlign: 'right', ...CELL_PAD }}>
                        {typeof row.no === 'number' ? row.no : ''}
                      </td>
                      <td style={{ textAlign: 'right', ...CELL_PAD }}>
                        {row.totalArea > 0
                          ? `${row.totalArea.toFixed(2)} ${calcAreaUnitLabel(row.uom)}`
                          : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signature section on the last page */}
            {isLastPage && (
              <div style={{ marginTop: 'auto', paddingTop: '14pt' }}>
                <div
                  style={{
                    fontFamily: 'Arial, Helvetica, sans-serif',
                    fontSize: '8.5pt',
                    marginBottom: '2pt',
                  }}
                >
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      {SIG_LABELS.map((s) => (
                        <td
                          key={`pdf-sig-${s.key}`}
                          style={{ width: '20%', verticalAlign: 'top', padding: '5px', height: '30pt', border: '0.5px solid #000'}}
                        >
                          <div style={{ fontWeight: 'bold', borderBottom: '0.5px solid #000', paddingBottom: '3px', fontSize: '8.5pt' }}>
                            {s.label}
                          </div>
                          <div style={{ marginTop: '12pt', fontSize: '8pt' }}>
                            <div style={{ borderBottom: '0.5px dashed #999', paddingBottom: '2px' }}>Sign:</div>
                          </div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

