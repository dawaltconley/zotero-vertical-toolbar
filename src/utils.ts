export const ToolbarPosition = ['top', 'left', 'right'] as const;

export type ToolbarPosition = (typeof ToolbarPosition)[number];

export const isToolbarPosition = (value: any): value is ToolbarPosition =>
  ToolbarPosition.some((p) => p === value?.toString());
