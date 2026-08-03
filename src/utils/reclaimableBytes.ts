export type ReclaimableByteSource = "exact" | "potential" | "legacy" | "none";

export interface ReclaimableBytes {
  bytes: number;
  estimated: boolean;
  source: ReclaimableByteSource;
}

export function resolveReclaimableBytes(input: {
  exact?: number | null;
  potential?: number | null;
  legacy?: number | null;
}): ReclaimableBytes {
  const exact = input.exact ?? 0;
  const potential = input.potential ?? 0;
  const legacy = input.legacy ?? 0;
  if (exact > 0) return { bytes: exact, estimated: false, source: "exact" };
  if (potential > 0) return { bytes: potential, estimated: true, source: "potential" };
  if (legacy > 0) return { bytes: legacy, estimated: false, source: "legacy" };
  return { bytes: 0, estimated: false, source: "none" };
}
