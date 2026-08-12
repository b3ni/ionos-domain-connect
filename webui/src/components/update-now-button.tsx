"use client"

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UpdateResponse {
  results?: Record<string, string>;
  error?: { message: string };
}

export function UpdateNowButton({ onFinished }: { onFinished: () => void }) {
  const [running, setRunning] = useState(false);

  const update = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/update", { method: "POST" });
      const body = (await res.json()) as UpdateResponse;
      if (!res.ok) {
        toast.error(body.error?.message ?? "Update failed.");
        return;
      }
      const results = Object.values(body.results ?? {});
      const failed = results.filter((r) => r === "error").length;
      if (failed > 0) {
        toast.error(
          `Update finished with ${failed} failed domain${failed > 1 ? "s" : ""}.`
        );
      } else {
        toast.success("All domains updated.");
      }
      onFinished();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Button variant="outline" onClick={update} disabled={running}>
      {running ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      Update now
    </Button>
  );
}
