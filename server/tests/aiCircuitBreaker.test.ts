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

import {
  generatePitch,
  recordAiProviderProbeSuccess,
  type PitchContext,
} from "../src/services/pitch/generatePitch.js";

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

  it("lets an explicit manual regeneration probe and recover the provider", async () => {
    runtime.current = {
      provider: "openai",
      protocol: "openai",
      apiKey: `manual-recovery-${Date.now()}-${Math.random()}`,
      model: "manual-recovery-test",
      baseUrl: "https://api.openai.com/v1",
      requestsPerMinute: 300,
      configured: true,
      source: "db",
    };
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return new Response("bad key", { status: 401 });
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"observation":"Specific observation","subject":"Fresh pitch","message":"Recovered AI pitch"}',
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const failed = await generatePitch(context);
    const recovered = await generatePitch(
      { ...context, businessName: "Manual Recovery" },
      { forceProviderAttempt: true },
    );

    expect(failed.fallbackReason).toMatch(/401/);
    expect(recovered.provider).toBe("openai");
    expect(recovered.message).toBe("Recovered AI pitch");
    expect(recovered.fallbackReason).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("closes the circuit after a successful settings health probe", async () => {
    runtime.current = {
      provider: "openai",
      protocol: "openai",
      apiKey: `probe-recovery-${Date.now()}-${Math.random()}`,
      model: "probe-recovery-test",
      baseUrl: "https://api.openai.com/v1",
      requestsPerMinute: 300,
      configured: true,
      source: "db",
    };
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return new Response("temporary auth failure", { status: 401 });
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"observation":"Provider recovered","subject":"Recovered","message":"AI is healthy again"}',
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const failed = await generatePitch(context);
    recordAiProviderProbeSuccess(runtime.current!);
    const recovered = await generatePitch({ ...context, businessName: "Probe Recovery" });

    expect(failed.fallbackReason).toMatch(/401/);
    expect(recovered.provider).toBe("openai");
    expect(recovered.fallbackReason).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
