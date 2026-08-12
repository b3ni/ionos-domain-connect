"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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

export function DomainTable({
  domains,
  actions,
}: {
  domains: DomainView[];
  actions?: (domain: DomainView) => ReactNode;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Domain</TableHead>
          <TableHead>Last update</TableHead>
          <TableHead>Current IP</TableHead>
          <TableHead className="text-right">Status</TableHead>
          {actions && <TableHead className="w-12" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {domains.map((domain) => {
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
                  <p
                    className="mt-0.5 max-w-72 truncate text-xs font-normal text-muted-foreground"
                    title={domain.lastError}
                  >
                    {domain.lastError}
                  </p>
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
