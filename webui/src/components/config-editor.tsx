"use client"

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  FileCode2,
  FileJson,
  Loader2,
  RefreshCw,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ConfigFileState, DomainConfig } from "@/lib/config-store";
import { JsonView } from "@uiw/react-json-view";
import { lightTheme } from "@uiw/react-json-view/light";
import { darkTheme } from "@uiw/react-json-view/dark";

const JsonViewEditor = dynamic(
  () => import("@uiw/react-json-view/editor").then((m) => m.default),
  { ssr: false }
);

const TOKEN_KEYS = new Set(["access_token", "refresh_token"]);

interface Secret {
  placeholder: string;
  real: string;
}

function collectSecrets(parsed: DomainConfig): Secret[] {
  const secrets: Secret[] = [];
  let index = 0;
  for (const entry of Object.values(parsed)) {
    if (!entry || typeof entry !== "object") continue;
    for (const [key, value] of Object.entries(entry)) {
      if (TOKEN_KEYS.has(key) && typeof value === "string" && value) {
        secrets.push({ placeholder: `__SECRET_${index}__`, real: value });
        index += 1;
      }
    }
  }
  return secrets;
}

function applySecrets(
  text: string,
  secrets: Secret[],
  direction: "toPlaceholder" | "toReal"
): string {
  let next = text;
  for (const { placeholder, real } of secrets) {
    const [from, to] =
      direction === "toPlaceholder" ? [real, placeholder] : [placeholder, real];
    next = next.replaceAll(from, to);
  }
  return next;
}

function renameKeyInConfig(
  config: DomainConfig,
  oldKey: string,
  newKey: string
): DomainConfig {
  if (Object.prototype.hasOwnProperty.call(config, oldKey)) {
    const next: DomainConfig = {};
    for (const [key, value] of Object.entries(config)) {
      next[key === oldKey ? newKey : key] = value;
    }
    return next;
  }
  const next: DomainConfig = {};
  for (const [domain, entry] of Object.entries(config)) {
    if (
      entry &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      Object.prototype.hasOwnProperty.call(entry, oldKey)
    ) {
      const nextEntry: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(entry)) {
        nextEntry[key === oldKey ? newKey : key] = value;
      }
      next[domain] = nextEntry as DomainConfig[string];
    } else {
      next[domain] = entry;
    }
  }
  return next;
}

function MaskedValue({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span className="inline-flex items-center gap-1">
      {revealed ? (
        <span className="break-all">{value}</span>
      ) : (
        <span aria-hidden>••••••••</span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-4"
        aria-label={revealed ? "Hide value" : "Show value"}
        onClick={(event) => {
          event.stopPropagation();
          setRevealed((prev) => !prev);
        }}
      >
        {revealed ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
      </Button>
    </span>
  );
}

export function ConfigEditor() {
  const { resolvedTheme } = useTheme();
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ConfigFileState | null>(null);
  const [mode, setMode] = useState<"tree" | "text">("tree");
  const [treeValue, setTreeValue] = useState<unknown>(null);
  const [text, setText] = useState("");
  const [loadedText, setLoadedText] = useState("");
  const [baseRaw, setBaseRaw] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [secretsRevealed, setSecretsRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const requestSeq = useRef(0);

  const themeStyle = resolvedTheme === "dark" ? darkTheme : lightTheme;

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const res = await fetch("/api/config", { cache: "no-store" });
      if (!res.ok) return;
      const state = (await res.json()) as ConfigFileState;
      if (seq !== requestSeq.current) return;
      setView(state);
      setBaseRaw(state.raw);
      setSecretsRevealed(false);
      if (state.parsed) {
        const found = collectSecrets(state.parsed);
        setSecrets(found);
        setTreeValue(state.parsed);
        const masked = applySecrets(state.raw ?? "", found, "toPlaceholder");
        setText(masked);
        setLoadedText(masked);
        setMode("tree");
      } else {
        setSecrets([]);
        setTreeValue(null);
        setText(state.raw ?? "");
        setLoadedText(state.raw ?? "");
        setMode("text");
      }
    } catch {
      if (seq === requestSeq.current) {
        toast.error("Could not load the config file.");
      }
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, []);

  const open = useCallback(() => {
    setOpened(true);
    load();
  }, [load]);

  const reload = useCallback(() => {
    load();
  }, [load]);

  const displayText = useMemo(
    () =>
      applySecrets(text, secrets, secretsRevealed ? "toReal" : "toPlaceholder"),
    [text, secrets, secretsRevealed]
  );

  const treeDirty = useMemo(() => {
    if (!view?.parsed || treeValue === null) return false;
    return JSON.stringify(treeValue) !== JSON.stringify(view.parsed);
  }, [view, treeValue]);

  const textDirty = useMemo(() => {
    const baseline = secretsRevealed
      ? applySecrets(loadedText, secrets, "toReal")
      : loadedText;
    return displayText !== baseline;
  }, [displayText, loadedText, secrets, secretsRevealed]);

  const handleEdit = useCallback(
    (option: {
      value: unknown;
      oldValue: unknown;
      keyName?: string | number;
    }) => {
      if (typeof option.keyName !== "string") return false;
      const newKey = option.value;
      if (typeof newKey !== "string" || newKey.trim() === "") return false;
      if (newKey === option.keyName) return true;
      setTreeValue((prev: unknown) =>
        renameKeyInConfig(prev as DomainConfig, option.keyName as string, newKey)
      );
      return true;
    },
    []
  );

  const beforeCopy = useCallback(
    (copyText: string) => {
      if (secrets.some((secret) => secret.real === copyText)) {
        return "••••••••";
      }
      return copyText;
    },
    [secrets]
  );

  const save = useCallback(async () => {
    if (!view?.exists || saving) return;
    const raw =
      mode === "tree"
        ? JSON.stringify(treeValue, null, 1)
        : applySecrets(text, secrets, "toReal");
    setSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw, baseRaw }),
      });
      const body = (await res.json()) as { error?: { message: string } };
      if (res.status === 409) {
        toast.error(body.error?.message ?? "The config file changed on disk.", {
          action: {
            label: "Reload",
            onClick: reload,
          },
        });
        return;
      }
      if (!res.ok) {
        toast.error(body.error?.message ?? "Could not save the config file.");
        return;
      }
      toast.success("Configuration saved.");
      load();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }, [view, saving, mode, treeValue, text, secrets, baseRaw, load, reload]);

  if (!opened) {
    return (
      <Card className="mt-8">
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Configuración</CardTitle>
            <CardDescription>
              View and edit the domain configuration file
            </CardDescription>
          </div>
          <Button onClick={open}>
            <FileJson />
            Open config editor
          </Button>
        </CardHeader>
      </Card>
    );
  }

  const showTree = mode === "tree" && !!view?.parsed;
  const showText = !view?.parsed || mode === "text";

  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Configuración</CardTitle>
            <CardDescription className="font-mono">
              {view?.path ?? "…"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {view?.parsed && (
              <div className="flex items-center gap-1 rounded-lg border p-1">
                <Button
                  variant={mode === "tree" ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => setMode("tree")}
                  aria-pressed={mode === "tree"}
                >
                  <FileJson />
                  Tree
                </Button>
                <Button
                  variant={mode === "text" ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => setMode("text")}
                  aria-pressed={mode === "text"}
                >
                  <FileCode2 />
                  Text
                </Button>
              </div>
            )}
            {showText && secrets.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setSecretsRevealed((prev) => !prev)}>
                {secretsRevealed ? <EyeOff /> : <Eye />}
                {secretsRevealed ? "Hide secrets" : "Show secrets"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={reload}
              aria-label="Reload config"
            >
              <RefreshCw />
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={!view?.exists || (!treeDirty && !textDirty) || saving}
            >
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 animate-spin" />
            Loading…
          </div>
        )}

        {!loading && view && !view.exists && (
          <p className="text-muted-foreground text-sm">
            The config file does not exist yet. It is created by the
            domain-connect-dyndns CLI when a domain finishes its setup, so
            there is nothing to edit here until then.
          </p>
        )}

        {!loading && view?.exists && !view.parsed && (
          <div className="space-y-3">
            <p className="text-destructive text-sm">{view.parseError}</p>
            <Textarea
              className="font-mono text-xs"
              rows={16}
              value={displayText}
              onChange={(event) => setText(event.target.value)}
              spellCheck={false}
            />
          </div>
        )}

        {!loading && showTree && view?.parsed && (
          <JsonViewEditor
            value={treeValue as object}
            editable
            onEdit={handleEdit}
            style={themeStyle}
            displayDataTypes={false}
            displayObjectSize={false}
            enableClipboard
            beforeCopy={beforeCopy}
          >
            <JsonView.String
              render={(_props, { type, value, keyName }) => {
                if (
                  type === "value" &&
                  typeof value === "string" &&
                  typeof keyName === "string" &&
                  TOKEN_KEYS.has(keyName) &&
                  secrets.some((secret) => secret.real === value)
                ) {
                  return <MaskedValue value={value} />;
                }
                return undefined;
              }}
            />
          </JsonViewEditor>
        )}

        {!loading && showText && view?.parsed && (
          <Textarea
            className="font-mono text-xs"
            rows={16}
            value={displayText}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
          />
        )}
      </CardContent>
    </Card>
  );
}
