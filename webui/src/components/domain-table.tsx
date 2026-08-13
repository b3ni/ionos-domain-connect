"use client"

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ReauthorizeDomainButton } from "@/components/reauthorize-domain-button";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SORT,
  sortDomains,
  toggleSortState,
  type SortKey,
  type SortState,
} from "@/lib/sort";
import type { DomainView } from "@/lib/domains";
import type { ReactNode } from "react";

const RESULT_META: Record<
  NonNullable<DomainView["lastResult"]>,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  ok: { label: "Up to date", variant: "default" },
  error: { label: "Update failed", variant: "destructive" },
  pending: { label: "Pending", variant: "secondary" },
};

const formatTime = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString() : "—";

const needsResync = (error: string): boolean =>
  error.includes("Failed to get async token") || error.includes("NOTFOUND_SESSION");

function SortableHeader({
  label,
  sortKey,
  sort,
  onSortChange,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSortChange: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = active
    ? sort.direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;
  return (
    <TableHead
      className={className}
      aria-sort={
        active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSortChange(sortKey)}
        className="inline-flex cursor-pointer items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {label}
        <Icon
          aria-hidden
          className={cn("h-3.5 w-3.5", active ? "" : "text-muted-foreground/60")}
        />
      </button>
    </TableHead>
  );
}

export function DomainTable({
  domains,
  actions,
  onFinished,
}: {
  domains: DomainView[];
  actions?: (domain: DomainView) => ReactNode;
  onFinished?: () => void;
}) {
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const sorted = useMemo(() => sortDomains(domains, sort), [domains, sort]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHeader
            label="Domain"
            sortKey="name"
            sort={sort}
            onSortChange={(key) => setSort((s) => toggleSortState(s, key))}
          />
          <SortableHeader
            label="Last update"
            sortKey="lastUpdatedAt"
            sort={sort}
            onSortChange={(key) => setSort((s) => toggleSortState(s, key))}
          />
          <SortableHeader
            label="Current IP"
            sortKey="currentIp"
            sort={sort}
            onSortChange={(key) => setSort((s) => toggleSortState(s, key))}
          />
          <SortableHeader
            label="Status"
            sortKey="lastResult"
            sort={sort}
            onSortChange={(key) => setSort((s) => toggleSortState(s, key))}
            className="text-right"
          />
          {actions && <TableHead className="w-12" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((domain) => {
          const meta =
            RESULT_META[domain.lastResult ?? "pending"] ?? RESULT_META.pending;
          return (
            <TableRow key={domain.name}>
              <TableCell className="font-medium">
                <a
                  href={`https://${domain.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {domain.name}
                </a>
                {domain.lastResult === "error" && domain.lastError && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="mt-0.5 block max-w-72 cursor-pointer truncate rounded-sm border-0 bg-transparent p-0 text-left text-xs font-normal text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {domain.lastError}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs break-words">
                      {domain.lastError}
                    </TooltipContent>
                  </Tooltip>
                )}
                {domain.lastResult === "error" &&
                  domain.lastError &&
                  needsResync(domain.lastError) && (
                    <ReauthorizeDomainButton
                      domain={domain.name}
                      onFinished={onFinished ?? (() => {})}
                    />
                  )}
              </TableCell>
              <TableCell className="tabular-nums">
                {formatTime(domain.lastUpdatedAt)}
              </TableCell>
              <TableCell className="font-mono text-muted-foreground">
                {domain.currentIp ?? "—"}
              </TableCell>
              <TableCell className="text-right">
                <Badge variant={meta.variant}>{meta.label}</Badge>
              </TableCell>
              {actions && (
                <TableCell className="text-right">
                  {actions(domain)}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
