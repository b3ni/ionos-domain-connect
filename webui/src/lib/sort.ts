import type { DomainView } from "@/lib/domains";

export type SortKey = "name" | "lastUpdatedAt" | "currentIp" | "lastResult";
export type SortDirection = "asc" | "desc";

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

export const DEFAULT_SORT: SortState = { key: "name", direction: "asc" };

const STATUS_RANK: Record<NonNullable<DomainView["lastResult"]>, number> = {
  ok: 0,
  pending: 1,
  error: 2,
};

export function toggleSortState(current: SortState, key: SortKey): SortState {
  if (current.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: "asc" };
}

function compareNonNull(a: DomainView, b: DomainView, key: SortKey): number {
  switch (key) {
    case "name": {
      const folded = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      if (folded !== 0) return folded;
      return a.name.localeCompare(b.name);
    }
    case "lastResult": {
      return (
        STATUS_RANK[a.lastResult ?? "pending"] -
        STATUS_RANK[b.lastResult ?? "pending"]
      );
    }
    case "lastUpdatedAt":
    case "currentIp": {
      const va = a[key];
      const vb = b[key];
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return va < vb ? -1 : va > vb ? 1 : 0;
    }
  }
}

export function sortDomains(domains: DomainView[], sort: SortState): DomainView[] {
  const { key, direction } = sort;
  const dir = direction === "asc" ? 1 : -1;
  return [...domains].sort((a, b) => {
    if (key === "lastUpdatedAt" || key === "currentIp") {
      const aNull = a[key] === null;
      const bNull = b[key] === null;
      if (aNull !== bNull) return aNull ? 1 : -1;
    }
    return dir * compareNonNull(a, b, key);
  });
}
