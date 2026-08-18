export const W201_VIEWPORTS: Readonly<{
  wide: Readonly<{ width: 1600; height: 900 }>;
  medium: Readonly<{ width: 1280; height: 720 }>;
  compact: Readonly<{ width: 980; height: 680 }>;
}>;

export function collectW201BrowserMeasurement(
  sourceHead?: string | null | [string | null, { width: number; height: number }],
  requestedViewport?: { width: number; height: number } | null
): Record<string, unknown>;

export function evaluateW201CompactGate(
  measurement: Record<string, unknown>,
  expectedViewport?: { width: number; height: number }
): {
  passed: boolean;
  assertions: Array<{ name: string; passed: boolean; detail: unknown }>;
  hardAssertionSummary: Record<string, boolean>;
};

export function evaluateW201VirtualizationInteraction(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): {
  passed: boolean;
  assertions: Array<{ name: string; passed: boolean; detail: unknown }>;
  scrollOwnershipSummary: Record<string, unknown>;
};

export function evaluateW201ResponsiveGate(
  measurement: Record<string, unknown>,
  expectedViewport: { width: number; height: number }
): {
  passed: boolean;
  assertions: Array<{ name: string; passed: boolean; detail: unknown }>;
  hardAssertionSummary: Record<string, boolean>;
};

export function evaluateW201ProjectionGate(
  measurement: Record<string, unknown>,
  expectedViewport: { width: number; height: number },
  projection: "detached-browse" | "overview"
): {
  passed: boolean;
  assertions: Array<{ name: string; passed: boolean; detail: unknown }>;
  hardAssertionSummary: Record<string, boolean>;
};
