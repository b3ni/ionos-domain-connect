"use client"

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function RemoveDomainButton({
  domain,
  onRemoved,
}: {
  domain: string;
  onRemoved: () => void;
}) {
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    setRemoving(true);
    try {
      const res = await fetch(
        `/api/domains/${encodeURIComponent(domain)}`,
        { method: "DELETE" }
      );
      const body = (await res.json()) as {
        error?: { message: string };
      };
      if (!res.ok) {
        toast.error(body.error?.message ?? "Could not remove the domain.");
        return;
      }
      toast.success(`${domain} removed.`);
      onRemoved();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Remove ${domain}`}>
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {domain}?</AlertDialogTitle>
          <AlertDialogDescription>
            The domain will no longer be kept up to date. A backup of its
            settings is kept in the container before removal.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={remove} disabled={removing}>
            {removing && <Loader2 className="animate-spin" />}
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
