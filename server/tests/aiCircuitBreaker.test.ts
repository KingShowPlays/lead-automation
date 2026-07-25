import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResolvedAi } from "../src/config/runtime.js";

const runtime = vi.hoisted(() => ({
  current: null as ResolvedAi | null,
}));

vi.mock("../src/config/runtime.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/config/runtime.js")>();
  return {
    ...actual,
    getAiRuntime: async () => runtime.current!,
  };
});

import { generatePitch, type PitchContext } from "../src/services/pitch/generatePitch.js";

const context: PitchContext = {
  businessName: "Circuit Test",
  category: "restaurants",
  city: "Accra",
  websiteType: "NO_WEBSITE",
  websiteProblem: "No website",
  outreachChannel: "EMAIL",
  openingSoon: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AI provider circuit breaker", () => {
  it("stops later leads from repeating a provider failure during cooldown", async () => {
    runtime.current = {
      provider: "openai",
      protocol: "openai",
      apiKey: `bad-key-${Date.now()}`,
      model: `circuit-test-${Date.now()}`,
      baseUrl: "https://api.openai.com/v1",
      requestsPerMinute: 300,
      configured: true,
      source: "db",
    };
    const fetchMock = vi.fn(async () => new Response("bad key", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await generatePitch(context);
    const second = await generatePitch({ ...context, businessName: "Second Circuit Test" });

    expect(first.provider).toBe("template");
    expect(first.fallbackReason).toMatch(/401/);
    expect(second.provider).toBe("template");
    expect(second.fallbackReason).toMatch(/cooling down/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
