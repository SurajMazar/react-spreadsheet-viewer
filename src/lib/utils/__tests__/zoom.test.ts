import { describe, it, expect } from 'vitest';
import {
  clampZoom,
  stepZoom,
  formatZoomLabel,
  scaleToZoom,
  ZOOM_LEVELS,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
} from '../zoom';

describe('clampZoom', () => {
  it('leaves in-range values alone', () => {
    expect(clampZoom(1)).toBe(1);
    expect(clampZoom(0.75)).toBe(0.75);
  });

  it('clamps to the bounds', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    expect(clampZoom(50)).toBe(MAX_ZOOM);
    expect(clampZoom(3, 0.5, 2)).toBe(2);
    expect(clampZoom(0.1, 0.5, 2)).toBe(0.5);
  });

  it('tolerates bounds passed the wrong way round', () => {
    expect(clampZoom(5, 2, 0.5)).toBe(2);
  });

  it('falls back to the default for unusable numbers', () => {
    expect(clampZoom(NaN)).toBe(DEFAULT_ZOOM);
    expect(clampZoom(Infinity)).toBe(DEFAULT_ZOOM);
    expect(clampZoom(0)).toBe(DEFAULT_ZOOM);
    expect(clampZoom(-2)).toBe(DEFAULT_ZOOM);
  });
});

describe('stepZoom', () => {
  it('moves to the next level up', () => {
    expect(stepZoom(1, 'in')).toBe(1.25);
    expect(stepZoom(0.5, 'in')).toBe(0.75);
  });

  it('moves to the next level down', () => {
    expect(stepZoom(1, 'out')).toBe(0.9);
    expect(stepZoom(2, 'out')).toBe(1.5);
  });

  it('steps past an off-list zoom rather than snapping backwards', () => {
    expect(stepZoom(1.1, 'in')).toBe(1.25);
    expect(stepZoom(1.1, 'out')).toBe(1);
  });

  it('stops at the highest and lowest level, never past them', () => {
    const highest = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
    const lowest = ZOOM_LEVELS[0];

    // Stepping must stay on the ladder the picker offers, not run on to
    // maxZoom/minZoom — 200% is the top rung, not 400%.
    expect(stepZoom(highest, 'in')).toBe(highest);
    expect(stepZoom(lowest, 'out')).toBe(lowest);
  });

  it('does not step past the last level even when the bounds allow more', () => {
    expect(stepZoom(2, 'in', ZOOM_LEVELS, 0.25, 4)).toBe(2);
    expect(stepZoom(0.5, 'out', ZOOM_LEVELS, 0.25, 4)).toBe(0.5);
  });

  it('steps back on to the ladder from an off-list zoom outside it', () => {
    // setZoom can put the viewer past the top level; stepping down returns it.
    expect(stepZoom(3, 'out', ZOOM_LEVELS, 0.25, 4)).toBe(2);
    expect(stepZoom(0.3, 'in', ZOOM_LEVELS, 0.25, 4)).toBe(0.5);
  });

  it('is a no-op when the level list is empty', () => {
    expect(stepZoom(1, 'in', [])).toBe(1);
    expect(stepZoom(1, 'out', [])).toBe(1);
  });

  it('honours a custom level list', () => {
    expect(stepZoom(1, 'in', [1, 4])).toBe(4);
    expect(stepZoom(4, 'out', [1, 4])).toBe(1);
  });

  it('ignores junk entries in the level list', () => {
    expect(stepZoom(1, 'in', [1, NaN, 0, -1, 1.5])).toBe(1.5);
  });

  it('never leaves the bounds when levels fall outside them', () => {
    expect(stepZoom(1, 'in', [1, 2], 0.5, 1.5)).toBe(1.5);
  });
});

describe('formatZoomLabel', () => {
  it('renders whole percentages', () => {
    expect(formatZoomLabel(1)).toBe('100%');
    expect(formatZoomLabel(0.5)).toBe('50%');
    expect(formatZoomLabel(0.9)).toBe('90%');
    expect(formatZoomLabel(1.25)).toBe('125%');
  });
});

describe('scaleToZoom', () => {
  it('scales and rounds to whole pixels', () => {
    expect(scaleToZoom(100, 1)).toBe(100);
    expect(scaleToZoom(100, 0.5)).toBe(50);
    expect(scaleToZoom(26, 0.75)).toBe(20);
    expect(scaleToZoom(26, 1.25)).toBe(33);
  });

  it('never collapses a measurement to zero', () => {
    expect(scaleToZoom(1, MIN_ZOOM)).toBe(1);
  });
});
