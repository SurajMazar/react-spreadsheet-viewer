import { describe, it, expect } from 'vitest';
import {
  ALL_KEYBOARD_INTERACTIONS,
  isSameKeyboardConfig,
  resolveKeyboardConfig,
} from '../keyboard';

describe('resolveKeyboardConfig', () => {
  it('enables every group when the prop is omitted', () => {
    expect(resolveKeyboardConfig(undefined)).toEqual(ALL_KEYBOARD_INTERACTIONS);
  });

  it('enables every group for true', () => {
    expect(resolveKeyboardConfig(true)).toEqual({
      navigation: true,
      editing: true,
      clipboard: true,
      history: true,
      search: true,
    });
  });

  it('disables every group for false', () => {
    expect(resolveKeyboardConfig(false)).toEqual({
      navigation: false,
      editing: false,
      clipboard: false,
      history: false,
      search: false,
    });
  });

  it('turns off only the groups an object names', () => {
    expect(resolveKeyboardConfig({ clipboard: false, history: false })).toEqual({
      navigation: true,
      editing: true,
      clipboard: false,
      history: false,
      search: true,
    });
  });

  it('treats an empty object as all-enabled', () => {
    expect(resolveKeyboardConfig({})).toEqual(ALL_KEYBOARD_INTERACTIONS);
  });

  it('keeps explicit true values', () => {
    expect(resolveKeyboardConfig({ navigation: true, search: false }).navigation).toBe(true);
    expect(resolveKeyboardConfig({ navigation: true, search: false }).search).toBe(false);
  });
});

describe('isSameKeyboardConfig', () => {
  it('is true for configs enabling the same groups', () => {
    expect(
      isSameKeyboardConfig(resolveKeyboardConfig(true), resolveKeyboardConfig({}))
    ).toBe(true);
  });

  it('is false when any group differs', () => {
    expect(
      isSameKeyboardConfig(resolveKeyboardConfig(true), resolveKeyboardConfig({ search: false }))
    ).toBe(false);
  });
});
