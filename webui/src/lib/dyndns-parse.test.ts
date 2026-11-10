import { describe, expect, it } from "vitest";
import {
  failureReasonForDomain,
  lastMeaningfulLine,
  outcomeForDomain,
} from "@/lib/dyndns";
import {
  BANNER,
  NOTFOUND_SESSION,
  configuredIncorrectly,
  failed,
  upToDate,
  updated,
} from "@/test/cli-output";

describe("outcomeForDomain", () => {
  const stdout =
    BANNER +
    upToDate("a.example.com") +
    updated("b.example.com") +
    failed("c.example.com", NOTFOUND_SESSION);

  it("reads each domain's own block of an `update --all` run", () => {
    expect(outcomeForDomain("a.example.com", stdout)).toBe("unchanged");
    expect(outcomeForDomain("b.example.com", stdout)).toBe("ok");
    expect(outcomeForDomain("c.example.com", stdout)).toBe("error");
  });

  it("does not match a domain that is a suffix of another one", () => {
    const out = BANNER + updated("home.example.com") + failed("example.com", "boom");
    expect(outcomeForDomain("home.example.com", out)).toBe("ok");
    expect(outcomeForDomain("example.com", out)).toBe("error");
  });

  it("is unknown when the run produced nothing for the domain", () => {
    expect(outcomeForDomain("a.example.com", BANNER)).toBe("unknown");
  });

  it("detects a misconfigured domain listed after a successful one", () => {
    // The CLI prints this before (and instead of) "Read <domain> config."
    const out = BANNER + updated("a.example.com") + configuredIncorrectly("b.example.com");
    expect(outcomeForDomain("b.example.com", out)).toBe("error");
    expect(outcomeForDomain("a.example.com", out)).toBe("ok");
  });

  it("does not take another domain's status for a domain with no output", () => {
    const out = BANNER + configuredIncorrectly("b.example.com") + updated("a.example.com");
    expect(outcomeForDomain("c.example.com", out)).toBe("unknown");
  });
});

describe("failureReasonForDomain", () => {
  it("returns the error line, not the status line or progress", () => {
    const stdout =
      BANNER + updated("a.example.com") + failed("c.example.com", NOTFOUND_SESSION);
    expect(failureReasonForDomain("c.example.com", stdout, "")).toBe(NOTFOUND_SESSION);
  });

  it("does not pick up text from other domains' blocks", () => {
    const stdout =
      BANNER + failed("a.example.com", "error of a") + failed("c.example.com", "error of c");
    expect(failureReasonForDomain("a.example.com", stdout, "")).toBe("error of a");
  });

  it("uses the last meaningful stderr line of a traceback", () => {
    const stderr = [
      "Traceback (most recent call last):",
      '  File "/usr/local/bin/domain-connect-dyndns", line 8, in <module>',
      "    sys.exit(main())",
      "           ^^^^^^",
      "requests.exceptions.ConnectionError: Max retries exceeded",
    ].join("\n");
    const stdout = BANNER + "\nRead a.example.com config.\n";
    expect(failureReasonForDomain("a.example.com", stdout, stderr)).toBe(
      "requests.exceptions.ConnectionError: Max retries exceeded"
    );
  });

  it("uses the rejection line of a misconfigured domain as its reason", () => {
    const stdout = BANNER + updated("a.example.com") + configuredIncorrectly("b.example.com");
    expect(failureReasonForDomain("b.example.com", stdout, "")).toBe(
      "Domain b.example.com configured incorrectly. Rerun setup."
    );
  });

  it("does not take a following domain's rejection as its own reason", () => {
    const stdout =
      BANNER + failed("a.example.com", "error of a") + configuredIncorrectly("b.example.com");
    expect(failureReasonForDomain("a.example.com", stdout, "")).toBe("error of a");
  });

  it("returns null when only status markers remain", () => {
    const stdout = BANNER + "\nRead a.example.com config.\nCould not update DNS records.\n";
    expect(failureReasonForDomain("a.example.com", stdout, "")).toBeNull();
  });

  it("truncates very long reasons", () => {
    const stdout = BANNER + failed("a.example.com", "x".repeat(2000));
    expect(failureReasonForDomain("a.example.com", stdout, "")).toHaveLength(500);
  });
});

describe("lastMeaningfulLine", () => {
  it("prefers stderr and skips traceback frames", () => {
    const stderr = 'Traceback (most recent call last):\n  File "x.py", line 1\nValueError: bad code\n';
    expect(lastMeaningfulLine(BANNER + "Please open\n", stderr)).toBe("ValueError: bad code");
  });

  it("falls back to stdout without the banner", () => {
    expect(
      lastMeaningfulLine(BANNER + "Domain a.example.com has been successfully configured.\n", "")
    ).toBe("Domain a.example.com has been successfully configured.");
    expect(lastMeaningfulLine(BANNER, "")).toBe("");
  });
});
