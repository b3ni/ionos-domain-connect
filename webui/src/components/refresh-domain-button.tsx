"use client"

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RefreshResponse {
  results?: Record<string, string>;
  error?: { message: string };
}

export function RefreshDomainButton({
  domain,
  onFinished,
}: {
  domain: string;
  onFinished: () => void;
}) {
  const [running, setRunning] = useState(false);

  const refresh = async () => {
    setRunning(true);
    try {
      const res = await fetch(
        `/api/domains/${encodeURIComponent(domain)}/update`,
        { method: "POST" }
      );
      const body = (await res.json()) as RefreshResponse;
      if (!res.ok) {
        toast.error(body.error?.message ?? `Could not update ${domain}.`);
        return;
      }
      const outcome = Object.values(body.results ?? {})[0];
      if (outcome === "error") {
        toast.error(`${domain} update failed.`);
      } else {
        toast.success(`${domain} updated.`);
      }
      onFinished();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Refresh ${domain}`}
      onClick={refresh}
      disabled={running}
    >
      {running ? <Loader2 className="animate-spin" /> : <RefreshCw />}
    </Button>
  );
}
