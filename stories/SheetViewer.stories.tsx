import React, { useState, useRef } from 'react';
import { SheetViewer } from '../src/lib';
import type { SheetViewerHandle } from '../src/lib';

export default {
  title: 'SheetViewer',
  component: SheetViewer,
  parameters: {
    layout: 'fullscreen',
  },
};

/**
 * Helper to create a mock CSV file source.
 */
function createMockCsvFile(content: string, fileName = 'mock.csv'): File {
  const blob = new Blob([content], { type: 'text/csv' });
  return new File([blob], fileName, { type: 'text/csv' });
}

const sampleCsv = `Name,Age,City,Score
Alice,30,New York,95
Bob,25,San Francisco,88
Charlie,35,London,92
Diana,28,Tokyo,97
Eve,32,Paris,85
Frank,27,Berlin,91
Grace,29,Sydney,89
Henry,31,Toronto,93
Ivy,26,Mumbai,96
Jack,33,Seoul,87`;

// -- Stories --

export const FromFile = {
  name: 'From CSV File',
  parameters: {
    chromatic: { delay: 2000 },
  },
  render: () => {
    const file = createMockCsvFile(sampleCsv, 'sample_data.csv');
    return (
      <div style={{ height: '100vh', width: '100vw' }}>
        <SheetViewer source={file} />
      </div>
    );
  },
};

export const ViewMode = {
  name: 'View Mode (default)',
  parameters: {
    chromatic: { delay: 2000 },
  },
  render: () => {
    const file = createMockCsvFile(sampleCsv, 'readonly.csv');
    return (
      <div style={{ height: '100vh', width: '100vw' }}>
        <SheetViewer source={file} mode="view" />
      </div>
    );
  },
};

export const EditMode = {
  name: 'Edit Mode',
  parameters: {
    chromatic: { delay: 2000 },
  },
  render: () => {
    const file = createMockCsvFile(sampleCsv, 'editable.csv');
    return (
      <div style={{ height: '100vh', width: '100vw' }}>
        <SheetViewer
          source={file}
          mode="edit"
          onCellChange={(sheet, row, col, value) => {
            console.log(`Cell [${row},${col}] in "${sheet}" changed to: ${value}`);
          }}
        />
      </div>
    );
  },
};

export const WithHighlight = {
  name: 'Navigation with Highlight',
  parameters: {
    chromatic: { delay: 2000 },
  },
  render: () => {
    const file = createMockCsvFile(sampleCsv, 'highlight.csv');
    return (
      <div style={{ height: '100vh', width: '100vw' }}>
        <SheetViewer source={file} highlight="B2:C5" />
      </div>
    );
  },
};

export const WithDownload = {
  name: 'With Download Button',
  parameters: {
    chromatic: { delay: 2000 },
  },
  render: () => {
    const file = createMockCsvFile(sampleCsv, 'downloadable.csv');
    return (
      <div style={{ height: '100vh', width: '100vw' }}>
        <SheetViewer source={file} downloadable />
      </div>
    );
  },
};

export const CustomSize = {
  name: 'Custom Size (600x400)',
  parameters: {
    chromatic: { delay: 2000 },
  },
  render: () => {
    const file = createMockCsvFile(sampleCsv, 'sized.csv');
    return (
      <div style={{ padding: 40, background: '#f5f5f5', height: '100vh' }}>
        <SheetViewer
          source={file}
          width={600}
          height={400}
          className="custom-viewer"
        />
      </div>
    );
  },
};

export const MultipleInstances = {
  name: 'Multiple Instances',
  parameters: {
    chromatic: { delay: 2000 },
  },
  render: () => {
    const file1 = createMockCsvFile(sampleCsv, 'instance1.csv');
    const file2 = createMockCsvFile(
      `Product,Price,Qty\nWidget,9.99,100\nGadget,19.99,50\nDoohickey,4.99,200`,
      'instance2.csv'
    );
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', gap: 8, padding: 8 }}>
        <div style={{ flex: 1 }}>
          <SheetViewer source={file1} height="100%" width="100%" />
        </div>
        <div style={{ flex: 1 }}>
          <SheetViewer source={file2} height="100%" width="100%" />
        </div>
      </div>
    );
  },
};

export const ControlledSheet = {
  name: 'Controlled Active Sheet',
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  render: () => {
    const [currentSheet, setCurrentSheet] = useState<string | undefined>(undefined);
    const file = createMockCsvFile(sampleCsv, 'controlled.csv');
    return (
      <div style={{ height: '100vh', width: '100vw' }}>
        <div style={{ padding: '8px 16px', background: '#e8f0fe', borderBottom: '1px solid #d2e3fc' }}>
          <strong>Active sheet:</strong> {currentSheet || '(auto)'}
        </div>
        <div style={{ flex: 1, height: 'calc(100vh - 40px)' }}>
          <SheetViewer
            source={file}
            activeSheet={currentSheet}
            onSheetChange={(name) => setCurrentSheet(name)}
          />
        </div>
      </div>
    );
  },
};

export const WithRef = {
  name: 'Using Ref Handle',
  parameters: {
    chromatic: { delay: 3000 },
  },
  render: () => {
    const ref = useRef<SheetViewerHandle>(null);
    const file = createMockCsvFile(sampleCsv, 'ref-demo.csv');
    const [info, setInfo] = useState('');

    return (
      <div style={{ height: '100vh', width: '100vw' }}>
        <div style={{ padding: '8px 16px', background: '#e8f0fe', borderBottom: '1px solid #d2e3fc', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => {
            const names = ref.current?.getSheetNames();
            setInfo(`Sheets: ${names?.join(', ')}`);
          }}>Get Sheet Names</button>
          <button onClick={() => {
            const data = ref.current?.getSheetData();
            setInfo(`Rows: ${data?.rows}, Cols: ${data?.cols}`);
          }}>Get Active Sheet Data</button>
          <button onClick={() => {
            ref.current?.setHighlight('A1:C3');
          }}>Highlight A1:C3</button>
          <span>{info}</span>
        </div>
        <div style={{ height: 'calc(100vh - 40px)' }}>
          <SheetViewer ref={ref} source={file} />
        </div>
      </div>
    );
  },
};

export const NoSource = {
  name: 'No Source (Empty State)',
  parameters: {
    chromatic: { disableSnapshot: false },
  },
  render: () => (
    <div style={{ height: 400, width: 600, padding: 40 }}>
      <SheetViewer height={400} width={600} />
    </div>
  ),
};
