import { describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "../src/lib/app/rateLimit";

describe("checkRateLimit", () => {
  it("blocks after exceeding max within window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const key = "ip:test";
    const windowMs = 1000;

    expect(checkRateLimit(key, 2, windowMs).allowed).toBe(true);
    expect(checkRateLimit(key, 2, windowMs).allowed).toBe(true);
    expect(checkRateLimit(key, 2, windowMs).allowed).toBe(false);

    vi.useRealTimers();
  });

  it("resets after window passes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const key = "ip:reset";
    const windowMs = 1000;

    expect(checkRateLimit(key, 1, windowMs).allowed).toBe(true);
    expect(checkRateLimit(key, 1, windowMs).allowed).toBe(false);

    vi.advanceTimersByTime(1100);
    expect(checkRateLimit(key, 1, windowMs).allowed).toBe(true);

    vi.useRealTimers();
  });
});
