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
import { LinkIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { addDomainSchema, type AddDomainInput } from "@/lib/validation";
import type { SetupSessionView } from "@/lib/setup-session";

const POLL_MS = 1500;

async function pollSession(
  domain: string,
  stop: () => boolean
): Promise<SetupSessionView | null> {
  while (!stop()) {
    const res = await fetch(`/api/domains/${encodeURIComponent(domain)}/setup`, {
      cache: "no-store",
    });
    if (res.ok) {
      const session: SetupSessionView = await res.json();
      if (session.authUrl || session.state !== "awaiting_authorization") {
        return session;
      }
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return null;
}

export function AddDomainForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState<SetupSessionView | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AddDomainInput>({
    resolver: zodResolver(addDomainSchema),
    defaultValues: { domain: "" },
  });

  useEffect(() => {
    if (
      !session ||
      session.state !== "awaiting_authorization" ||
      session.authUrl
    ) {
      return;
    }
    let cancelled = false;
    void pollSession(session.domain, () => cancelled).then((updated) => {
      if (updated && !cancelled) {
        setSession(updated);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const reset = () => {
    setSession(null);
    setCode("");
    setError(null);
    form.reset();
  };

  const close = () => {
    setOpen(false);
    reset();
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
      const body = (await res.json()) as SetupSessionView & {
        error?: { message: string };
      };
      if (!res.ok) {
        setError(body.error?.message ?? "Could not start the setup.");
        return;
      }
      setSession(body);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitCode = async () => {
    if (!session || code.trim() === "") {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: session.domain, code }),
      });
      const body = (await res.json()) as SetupSessionView & {
        error?: { message: string };
      };
      if (!res.ok) {
        setError(body.error?.message ?? "Could not submit the access code.");
        return;
      }
      const updated = await pollSession(session.domain, () => false);
      if (updated) {
        setSession(updated);
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button>Add domain</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {session ? `Authorize ${session.domain}` : "Add a domain"}
          </DialogTitle>
        </DialogHeader>

        {!session && (
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
        )}

        {session && session.state === "awaiting_authorization" && (
          <div className="grid gap-4">
            {session.authUrl ? (
              <>
                <p className="text-muted-foreground text-sm">
                  Open the authorization link, approve the domain in your DNS
                  provider&apos;s portal, and enter the access code you receive
                  below.
                </p>
                <Button asChild variant="outline">
                  <a href={session.authUrl} target="_blank" rel="noreferrer">
                    <LinkIcon />
                    Open authorization link
                  </a>
                </Button>
                <div className="grid gap-2">
                  <Label htmlFor="code">Access code</Label>
                  <Input
                    id="code"
                    placeholder="Paste the access code here"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Waiting for the provider&apos;s authorization link…
              </p>
            )}
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button
              onClick={submitCode}
              disabled={submitting || !session.authUrl}
            >
              {submitting && <Loader2 className="animate-spin" />}
              Finish setup
            </Button>
          </div>
        )}

        {session?.state === "failed" && (
          <div className="grid gap-4">
            <p className="text-destructive text-sm">
              {session.error ?? "The setup failed."}
            </p>
            <Button variant="outline" onClick={close}>
              Close
            </Button>
          </div>
        )}

        {session?.state === "completed" && (
          <div className="grid gap-4">
            <p className="text-sm">
              {session.domain} has been configured and will be kept up to date.
            </p>
            <Button
              onClick={() => {
                onAdded();
                close();
              }}
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
