import { readConfig, type DomainConfigEntry } from "@/lib/config-store";

export interface DomainView {
  name: string;
  lastUpdatedAt: string | null;
  lastResult: "ok" | "error" | "pending" | null;
  currentIp: string | null;
}

export interface DomainList {
  domains: DomainView[];
  configError: string | null;
}

const MAX_KEY = (a?: number, b?: number): number | undefined => {
  const nums = [a, b].filter((n): n is number => typeof n === "number");
  return nums.length ? Math.max(...nums) : undefined;
};

function toView(entry: DomainConfigEntry, name: string): DomainView {
  const lastSuccess = entry.last_success;
  const lastAttempt = entry.last_attempt;
  const lastCheck = entry.last_dns_check;
  const lastTs = MAX_KEY(MAX_KEY(lastSuccess, lastAttempt), lastCheck);

  let lastResult: DomainView["lastResult"] = null;
  if (lastSuccess !== undefined && lastAttempt !== undefined) {
    lastResult = lastSuccess > lastAttempt ? "ok" : "error";
  } else if (lastSuccess !== undefined) {
    lastResult = "ok";
  } else if (lastAttempt !== undefined) {
    lastResult = "error";
  } else if (lastTs !== undefined) {
    lastResult = "pending";
  }

  const ip = entry.ip ?? {};
  const currentIp = ip.IPv4 ?? ip.IP ?? ip.IPv6 ?? null;

  return {
    name,
    lastUpdatedAt: lastTs ? new Date(lastTs * 1000).toISOString() : null,
    lastResult,
    currentIp,
  };
}

/** Read model for the UI: config.json + CLI-persisted update state. */
export function getDomains(): DomainList {
  let config;
  try {
    config = readConfig();
  } catch {
    return { domains: [], configError: `Could not read config file` };
  }
  const domains = Object.keys(config)
    .map((name) => toView(config[name], name))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { domains, configError: null };
}

export function isManaged(domain: string): boolean {
  try {
    return domain in readConfig();
  } catch {
    return false;
  }
}
