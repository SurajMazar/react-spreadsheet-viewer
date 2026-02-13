import { useMemo, type ComponentType } from 'react';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { useViewerStore, EMPTY_RANGES } from '../context/ViewerContext';
import type { ChartOverlay as ChartOverlayType } from '../types';

// Register only the Chart.js components we use (tree-shaking)
ChartJS.register(
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler
);

const COL_WIDTH = 100;
const ROW_HEIGHT = 26;

const COLORS = [
  '#4285f4', '#ea4335', '#fbbc04', '#34a853',
  '#ff6d01', '#46bdc6', '#7baaf7', '#f07b72',
];

function generateColors(count: number): string[] {
  return Array.from({ length: count }, (_, i) => COLORS[i % COLORS.length]);
}

interface ChartJsConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ChartComponent: ComponentType<any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any;
}

export default function ChartOverlays() {
  const activeSheet = useViewerStore((s) => s.activeSheet);
  const overlays = useViewerStore(
    (s) => (s.activeSheet ? s.chartOverlays[s.activeSheet] : null) ?? EMPTY_RANGES
  ) as ChartOverlayType[];

  if (!overlays || overlays.length === 0) return null;

  return (
    <>
      {overlays.map((chart, idx) => (
        <ChartOverlayItem
          key={`${activeSheet}-chart-${idx}`}
          chart={chart}
        />
      ))}
    </>
  );
}

function ChartOverlayItem({ chart }: { chart: ChartOverlayType }) {
  const left = chart.anchorCol * COL_WIDTH + chart.offsetX;
  const top = chart.anchorRow * ROW_HEIGHT + chart.offsetY;

  const { data, options, ChartComponent } = useMemo(
    () => buildChartJsConfig(chart),
    [chart]
  );

  if (!ChartComponent) return null;

  return (
    <div
      className="sv-chart-overlay"
      style={{
        position: 'absolute',
        left,
        top,
        width: chart.width,
        height: chart.height,
        zIndex: 10,
        pointerEvents: 'auto',
        background: 'rgba(255,255,255,0.97)',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        padding: '4px',
      }}
    >
      <ChartComponent data={data} options={options} />
    </div>
  );
}

function buildChartJsConfig(chart: ChartOverlayType): ChartJsConfig {
  const { chartType, series, title } = chart;
  const categories = series[0]?.categories || [];
  const labels = categories.map(String);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        display: series.length > 1 || (series[0]?.name && series[0].name !== 'Series 1'),
        position: 'bottom',
        labels: { font: { size: 10 } },
      },
      tooltip: { enabled: true },
      ...(title ? { title: { display: true, text: title, font: { size: 12 } } } : {}),
    },
  };

  if (chartType === 'pie') {
    return {
      ChartComponent: Pie,
      data: {
        labels,
        datasets: [
          {
            data: series[0]?.values || [],
            backgroundColor: generateColors(labels.length),
          },
        ],
      },
      options: {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          legend: { display: labels.length <= 12, position: 'bottom', labels: { font: { size: 10 } } },
        },
      },
    };
  }

  const isArea = chartType === 'area';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ChartComponent: ComponentType<any> = chartType === 'bar' ? Bar : Line;

  return {
    ChartComponent,
    data: {
      labels,
      datasets: series.map((s, i) => ({
        label: s.name,
        data: s.values,
        backgroundColor: isArea
          ? `${COLORS[i % COLORS.length]}33`
          : COLORS[i % COLORS.length],
        borderColor: COLORS[i % COLORS.length],
        borderWidth: chartType === 'bar' ? 1 : 2,
        fill: isArea,
        tension: chartType === 'line' || isArea ? 0.3 : 0,
        pointRadius: chartType === 'line' || isArea ? 1 : 0,
      })),
    },
    options: {
      ...baseOptions,
      scales: {
        x: {
          ticks: {
            font: { size: 9 },
            maxRotation: labels.length > 10 ? 45 : 0,
            autoSkip: true,
            maxTicksLimit: 15,
          },
        },
        y: {
          ticks: { font: { size: 9 } },
          grid: { color: '#e8e8e8' },
        },
      },
    },
  };
}
