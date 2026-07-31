import type {
  SheetViewerTool,
  SheetViewerToolContext,
  SheetViewerToolClickContext,
  SheetViewerToolDefinition,
} from '../types';

/**
 * Build a configured tool.
 *
 * A tool that needs no options is already a plain `SheetViewerTool` and can go
 * straight into the `tools` prop. This helper is for tools that carry their own
 * settings: it infers `TConfig` from `config`, type-checks every callback
 * against it, and returns a tool with the config bound in.
 *
 * That binding is what keeps the system typed end to end. The `tools` prop
 * stays a homogeneous `SheetViewerTool[]` — no union to widen, no `any`, no
 * config threading through the viewer — while each tool's own options are
 * checked where the tool is written:
 *
 * ```ts
 * const exportTool = defineSheetViewerTool({
 *   id: 'export-selection',
 *   label: 'Export selection',
 *   icon: DownloadIcon,
 *   config: { format: 'csv' as const, includeHeaders: true },
 *   onClick: (ctx, config) => {
 *     // config.format is 'csv', config.includeHeaders is boolean
 *     send(ctx.viewer.getSelectedRangeData(), config.format);
 *   },
 * });
 *
 * <SheetViewer tools={[exportTool]} />
 * ```
 *
 * The config object is captured by reference, so a tool defined inline in
 * render sees whatever that render passed — the same rules as any other prop.
 */
export function defineSheetViewerTool<TConfig>(
  definition: SheetViewerToolDefinition<TConfig>
): SheetViewerTool {
  const { config, onClick, isDisabled, isActive, ...rest } = definition;

  return {
    ...rest,
    onClick: (context: SheetViewerToolClickContext) => onClick(context, config),
    ...(isDisabled
      ? { isDisabled: (context: SheetViewerToolContext) => isDisabled(context, config) }
      : {}),
    ...(isActive
      ? { isActive: (context: SheetViewerToolContext) => isActive(context, config) }
      : {}),
  };
}
