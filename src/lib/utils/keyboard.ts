import type { SheetViewerKeyboardConfig } from '../types';

/** Every keyboard group resolved to a concrete boolean. */
export type ResolvedKeyboardConfig = Required<SheetViewerKeyboardConfig>;

/** All groups enabled — what the viewer uses when nothing is configured. */
export const ALL_KEYBOARD_INTERACTIONS: ResolvedKeyboardConfig = {
  navigation: true,
  editing: true,
  clipboard: true,
  history: true,
  search: true,
};

const NO_KEYBOARD_INTERACTIONS: ResolvedKeyboardConfig = {
  navigation: false,
  editing: false,
  clipboard: false,
  history: false,
  search: false,
};

/**
 * Normalize the `keyboardInteractions` prop into one flat set of booleans, so
 * every call site checks a plain flag instead of re-deriving the union.
 *
 * `undefined` and `true` mean "everything on", `false` means "everything off",
 * and an object turns off only the groups it names.
 */
export function resolveKeyboardConfig(
  value: boolean | SheetViewerKeyboardConfig | undefined
): ResolvedKeyboardConfig {
  if (value === undefined || value === true) return ALL_KEYBOARD_INTERACTIONS;
  if (value === false) return NO_KEYBOARD_INTERACTIONS;
  return {
    navigation: value.navigation ?? true,
    editing: value.editing ?? true,
    clipboard: value.clipboard ?? true,
    history: value.history ?? true,
    search: value.search ?? true,
  };
}

/** True when two resolved configs enable exactly the same groups. */
export function isSameKeyboardConfig(
  a: ResolvedKeyboardConfig,
  b: ResolvedKeyboardConfig
): boolean {
  return (
    a.navigation === b.navigation &&
    a.editing === b.editing &&
    a.clipboard === b.clipboard &&
    a.history === b.history &&
    a.search === b.search
  );
}
