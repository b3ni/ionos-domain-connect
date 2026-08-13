"use client"

import { useCallback, useState } from "react";
import type { DomainList as DomainListData } from "@/lib/domains";
import { DomainTable } from "@/components/domain-table";
import { AddDomainForm } from "@/components/add-domain-form";
import { RefreshDomainButton } from "@/components/refresh-domain-button";
import { RemoveDomainButton } from "@/components/remove-domain-button";
import { UpdateNowButton } from "@/components/update-now-button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DomainList({ initial }: { initial: DomainListData }) {
  const [data, setData] = useState(initial);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/domains", { cache: "no-store" });
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // keep the current view on transient errors
    }
  }, []);

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Managed domains
          </h1>
          <p className="text-muted-foreground text-sm">
            Subdomains kept up to date with your current IP address
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UpdateNowButton onFinished={refresh} />
          <AddDomainForm onAdded={refresh} />
        </div>
      </div>

      {data.configError ? (
        <Card>
          <CardHeader>
            <CardTitle>Configuration error</CardTitle>
            <CardDescription>
              The updater config could not be read. Make sure it is mounted at
              /config.json and is valid JSON.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : data.domains.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No managed domains yet</CardTitle>
            <CardDescription>
              Add your first subdomain and it will be kept up to date
              automatically.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card size="sm">
          <CardContent className="px-0">
            <DomainTable
              domains={data.domains}
              actions={(domain) => (
                <div className="flex justify-end gap-1">
                  <RefreshDomainButton
                    domain={domain.name}
                    onFinished={refresh}
                  />
                  <RemoveDomainButton domain={domain.name} onRemoved={refresh} />
                </div>
              )}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
