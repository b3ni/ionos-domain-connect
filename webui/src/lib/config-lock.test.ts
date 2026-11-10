import { beforeEach, describe, expect, it, vi } from "vitest";

type Lock = typeof import("@/lib/config-lock");
let lock: Lock;

beforeEach(async () => {
  // The lock lives on globalThis (shared across bundles): start clean.
  delete (globalThis as { __configLock?: unknown }).__configLock;
  vi.resetModules();
  lock = await import("@/lib/config-lock");
});

describe("config lock", () => {
  it("fails fast for a second holder and names the current one", () => {
    const release = lock.tryAcquireConfigLock("updating all domains");
    expect(() => lock.tryAcquireConfigLock("updating a.example.com")).toThrow(
      expect.objectContaining({
        code: "CONFLICT",
        message: expect.stringContaining("(updating all domains)"),
      })
    );
    release();
    expect(() => lock.tryAcquireConfigLock("next")()).not.toThrow();
  });

  it("serves waiters in order, ahead of new fail-fast callers", async () => {
    const order: string[] = [];
    const release = lock.tryAcquireConfigLock("update");
    const first = lock.withConfigLock("save", 1000, () => order.push("save"));
    const second = lock.withConfigLock("remove", 1000, () => order.push("remove"));

    release();
    // The lock is handed to the first waiter directly: an update cannot slip in.
    expect(() => lock.tryAcquireConfigLock("scheduled update")).toThrow();
    await Promise.all([first, second]);
    expect(order).toEqual(["save", "remove"]);
    expect(() => lock.tryAcquireConfigLock("free again")()).not.toThrow();
  });

  it("releases the lock when the critical section throws", async () => {
    await expect(
      lock.withConfigLock("save", 1000, () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    expect(() => lock.tryAcquireConfigLock("after error")()).not.toThrow();
  });

  it("gives up after waitMs and leaves the queue clean", async () => {
    vi.useFakeTimers();
    try {
      const release = lock.tryAcquireConfigLock("long update");
      const waiting = lock.acquireConfigLock("save", 500);
      const assertion = expect(waiting).rejects.toMatchObject({ code: "CONFLICT" });
      await vi.advanceTimersByTimeAsync(500);
      await assertion;
      release();
      // The timed-out waiter must not have been granted the lock.
      expect(() => lock.tryAcquireConfigLock("free")()).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores a double release", () => {
    const release = lock.tryAcquireConfigLock("a");
    release();
    const other = lock.tryAcquireConfigLock("b");
    release(); // must not free b's lock
    expect(() => lock.tryAcquireConfigLock("c")).toThrow();
    other();
  });
});
