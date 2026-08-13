"use client"

import { useState } from "react";
import { toast } from "sonner";
import { AuthorizationDialog } from "@/components/authorization-dialog";

interface UpdateResponse {
  results?: Record<string, string>;
  error?: { message: string };
}

export function ReauthorizeDomainButton({
  domain,
  onFinished,
}: {
  domain: string;
  onFinished: () => void;
}) {
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    try {
      const res = await fetch(
        `/api/domains/${encodeURIComponent(domain)}/update`,
        { method: "POST" }
      );
      const body = (await res.json()) as UpdateResponse;
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
    } catch {
      toast.error("Could not reach the server.");
    }
    onFinished();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-0.5 block max-w-72 cursor-pointer truncate rounded-sm border-0 bg-transparent p-0 text-left text-xs font-normal text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Run setup again for this domain.
      </button>
      {open && (
        <AuthorizationDialog
          domain={domain}
          onOpenChange={setOpen}
          onCompleted={refresh}
          explanation
          startOnOpen
        />
      )}
    </>
  );
}
