"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LinkIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { SetupSessionView } from "@/lib/setup-session";

const POLL_MS = 1500;

/**
 * Polls the setup session until `until(session)` is satisfied.
 * Never returns early while the authorization URL is present but the
 * session is still in progress (FR-013).
 */
async function pollSession(
  domain: string,
  until: (s: SetupSessionView) => boolean,
  stop: () => boolean
): Promise<SetupSessionView | null> {
  while (!stop()) {
    const res = await fetch(
      `/api/domains/${encodeURIComponent(domain)}/setup`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const session: SetupSessionView = await res.json();
      if (until(session)) {
        return session;
      }
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return null;
}

/**
 * Mounted only while the authorization is in progress (parents render it
 * conditionally), so all state resets naturally on each open.
 */
export function AuthorizationDialog({
  domain,
  onOpenChange,
  explanation,
  onCompleted,
  startOnOpen = false,
}: {
  domain: string;
  onOpenChange: (open: boolean) => void;
  /** Show the re-setup explanation (why it failed, what re-authorizing does). */
  explanation?: boolean;
  onCompleted: () => void;
  /** Start a new setup session on mount (re-setup). Default: reuse the
   * session the caller already started (add flow via POST /api/domains). */
  startOnOpen?: boolean;
}) {
  const [session, setSession] = useState<SetupSessionView | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/domains/${encodeURIComponent(domain)}/setup`,
          { method: startOnOpen ? "POST" : "GET", cache: "no-store" }
        );
        const body = (await res.json()) as SetupSessionView & {
          error?: { message: string };
        };
        if (!res.ok) {
          if (!cancelled) {
            setError(body.error?.message ?? "Could not start the setup.");
          }
          return;
        }
        if (!cancelled) {
          setSession(body);
        }
      } catch {
        if (!cancelled) {
          setError("Could not reach the server.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [domain, startOnOpen]);

  useEffect(() => {
    if (
      !session ||
      session.state !== "awaiting_authorization" ||
      session.authUrl
    ) {
      return;
    }
    let cancelled = false;
    void pollSession(
      domain,
      (s) => !!s.authUrl,
      () => cancelled
    ).then((updated) => {
      if (updated && !cancelled) {
        setSession(updated);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session, domain]);

  useEffect(() => {
    if (session?.state !== "completed") {
      return;
    }
    toast.success(`${domain} configured.`);
    onCompleted();
    onOpenChange(false);
  }, [session, domain, onCompleted, onOpenChange]);

  const submitCode = async () => {
    if (code.trim() === "") {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/domains/${encodeURIComponent(domain)}/setup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        }
      );
      const body = (await res.json()) as SetupSessionView & {
        error?: { message: string };
      };
      if (!res.ok) {
        setError(body.error?.message ?? "Could not submit the access code.");
        return;
      }
      const updated = await pollSession(
        domain,
        (s) => s.state !== "awaiting_authorization",
        () => false
      );
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
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Authorize {domain}</DialogTitle>
        </DialogHeader>

        {explanation && (
          <div className="grid gap-2 text-sm text-muted-foreground">
            <p>
              This domain&apos;s connection authorization has expired or was
              replaced on the provider side, so updates now fail.
            </p>
            <p>
              Re-authorizing reconnects the domain. It does not remove the
              domain and does not change its DNS records.
            </p>
          </div>
        )}

        {!session && error && <p className="text-destructive text-sm">{error}</p>}

        {session && session.state === "awaiting_authorization" && (
          <div className="grid gap-4">
            {session.authUrl ? (
              <>
                <p className="text-muted-foreground text-sm">
                  Open the authorization link, approve the domain in your DNS
                  provider&apos;s portal, and enter the access code you
                  receive below.
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
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
