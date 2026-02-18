import React, { useState, useMemo, useCallback, type ComponentType } from 'react';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { useViewerStore, EMPTY_SELECTION } from '../context/ViewerContext';
import { parseRangeExpression, colIndexToLetter } from '../utils/rangeParser';
import type { CellRange } from '../types';

const CHART_TYPES = [
  { id: 'bar', label: 'Bar' },
  { id: 'line', label: 'Line' },
  { id: 'pie', label: 'Pie' },
  { id: 'area', label: 'Area' },
] as const;

const COLORS = [
  '#4285f4', '#ea4335', '#fbbc04', '#34a853',
  '#ff6d01', '#46bdc6', '#7baaf7', '#f07b72',
];

interface ChartData {
  headers: string[];
  categories: string[];
  series: { name: string; data: number[] }[];
}

interface ChartConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ChartComponent: ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any;
}

export default function ChartPanel() {
  const showChartPanel = useViewerStore((s) => s.showChartPanel);
  const toggleChartPanel = useViewerStore((s) => s.toggleChartPanel);
  const chartType = useViewerStore((s) => s.chartType);
  const setChartType = useViewerStore((s) => s.setChartType);
  const sheetData = useViewerStore((s) => (s.activeSheet ? s.sheets[s.activeSheet] : null));
  const currentSelection = useViewerStore(
    (s) => (s.activeSheet ? s.selections[s.activeSheet] : null) ?? EMPTY_SELECTION
  );

  const [rangeInput, setRangeInput] = useState('');
  const [chartRanges, setChartRanges] = useState<CellRange[]>([]);

  const handleApplyRange = useCallback(() => {
    if (!sheetData) return;
    const input = rangeInput || currentSelection.rangeInput || '';
    const ranges = parseRangeExpression(input, sheetData.rows, sheetData.cols);
    setChartRanges(ranges);
  }, [rangeInput, currentSelection.rangeInput, sheetData]);

  const handleUseSelection = useCallback(() => {
    if (currentSelection.rangeInput) {
      setRangeInput(currentSelection.rangeInput);
      if (!sheetData) return;
      const ranges = parseRangeExpression(currentSelection.rangeInput, sheetData.rows, sheetData.cols);
      setChartRanges(ranges);
    }
  }, [currentSelection.rangeInput, sheetData]);

  const chartData = useMemo((): ChartData | null => {
    if (!sheetData || chartRanges.length === 0) return null;

    const range = chartRanges[0];
    const { startRow, startCol, endRow, endCol } = range;

    const headers: string[] = [];
    for (let c = startCol; c <= endCol; c++) {
      headers.push(String(sheetData.data[startRow]?.[c] ?? colIndexToLetter(c)));
    }

    const categories: string[] = [];
    const dataColumns: Record<number, number[]> = {};

    for (let c = startCol + 1; c <= endCol; c++) {
      dataColumns[c] = [];
    }

    for (let r = startRow + 1; r <= endRow; r++) {
      categories.push(String(sheetData.data[r]?.[startCol] ?? `Row ${r + 1}`));
      for (let c = startCol + 1; c <= endCol; c++) {
        const val = parseFloat(String(sheetData.data[r]?.[c])) || 0;
        dataColumns[c].push(val);
      }
    }

    return {
      headers: headers.slice(1),
      categories,
      series: Object.entries(dataColumns).map(([colIdx, values], i) => ({
        name: headers[parseInt(colIdx) - startCol] || `Series ${i + 1}`,
        data: values,
      })),
    };
  }, [sheetData, chartRanges]);

  const chartConfig = useMemo((): ChartConfig | null => {
    if (!chartData) return null;

    const isArea = chartType === 'area';
    const labels = chartData.categories;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseOptions: any = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { font: { size: 11 } },
        },
        tooltip: { enabled: true },
      },
    };

    if (chartType === 'pie') {
      return {
        ChartComponent: Pie,
        data: {
          labels,
          datasets: [{
            data: chartData.series[0]?.data || [],
            backgroundColor: Array.from({ length: labels.length }, (_, i) => COLORS[i % COLORS.length]),
          }],
        },
        options: baseOptions,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ChartComponent: ComponentType<any> = chartType === 'bar' ? Bar : Line;

    return {
      ChartComponent,
      data: {
        labels,
        datasets: chartData.series.map((s, i) => ({
          label: s.name,
          data: s.data,
          backgroundColor: isArea ? `${COLORS[i % COLORS.length]}33` : COLORS[i % COLORS.length],
          borderColor: COLORS[i % COLORS.length],
          borderWidth: chartType === 'bar' ? 1 : 2,
          fill: isArea,
          tension: chartType === 'line' || isArea ? 0.3 : 0,
        })),
      },
      options: {
        ...baseOptions,
        scales: {
          x: {
            ticks: {
              font: { size: 11 },
              maxRotation: labels.length > 10 ? 45 : 0,
              autoSkip: true,
            },
          },
          y: {
            ticks: { font: { size: 11 } },
          },
        },
      },
    };
  }, [chartData, chartType]);

  if (!showChartPanel) return null;

  return (
    <div className="sv-chart-panel">
      <div className="sv-chart-panel-header">
        <h3>Charts</h3>
        <button className="sv-chart-panel-close" onClick={toggleChartPanel}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="sv-chart-panel-controls">
        <div className="sv-chart-type-selector">
          {CHART_TYPES.map((ct) => (
            <button
              key={ct.id}
              className={`sv-chart-type-btn ${chartType === ct.id ? 'active' : ''}`}
              onClick={() => setChartType(ct.id)}
              title={ct.label}
            >
              {ct.label}
            </button>
          ))}
        </div>

        <div className="sv-chart-range-input-group">
          <input
            type="text"
            className="sv-chart-range-input"
            value={rangeInput}
            onChange={(e) => setRangeInput(e.target.value)}
            placeholder="e.g., A1:D10"
            spellCheck={false}
          />
          <button className="sv-chart-apply-btn" onClick={handleApplyRange}>
            Apply
          </button>
          {currentSelection.rangeInput && (
            <button className="sv-chart-use-selection-btn" onClick={handleUseSelection}>
              Use Selection
            </button>
          )}
        </div>
      </div>

      <div className="sv-chart-panel-body">
        {chartConfig ? (
          <div style={{ height: 350, width: '100%' }}>
            <chartConfig.ChartComponent
              data={chartConfig.data}
              options={chartConfig.options}
            />
          </div>
        ) : (
          <div className="sv-chart-placeholder">
            <p>Select a data range to create a chart</p>
            <p className="sv-chart-placeholder-hint">
              Enter a range like <code>A1:D10</code> or select cells in the grid
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
