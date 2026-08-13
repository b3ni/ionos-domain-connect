"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { addDomainSchema, type AddDomainInput } from "@/lib/validation";
import { AuthorizationDialog } from "@/components/authorization-dialog";

export function AddDomainForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [domain, setDomain] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AddDomainInput>({
    resolver: zodResolver(addDomainSchema),
    defaultValues: { domain: "" },
  });

  const close = () => {
    setOpen(false);
    setDomain(null);
    setError(null);
    form.reset();
  };

  const start = async (values: AddDomainInput) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        setError(body.error?.message ?? "Could not start the setup.");
        return;
      }
      setDomain(values.domain);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        open={open && !domain}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogTrigger asChild>
          <Button>Add domain</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a domain</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit(start)}
            className="grid gap-4"
            noValidate
          >
            <div className="grid gap-2">
              <Label htmlFor="domain">Subdomain</Label>
              <Input
                id="domain"
                placeholder="home.example.com"
                {...form.register("domain")}
              />
              {form.formState.errors.domain && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.domain.message}
                </p>
              )}
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              Start setup
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {open && domain && (
        <AuthorizationDialog
          domain={domain}
          onOpenChange={(next) => (next ? setOpen(true) : close())}
          onCompleted={onAdded}
        />
      )}
    </>
  );
}
