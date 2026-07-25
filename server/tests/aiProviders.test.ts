import { describe, expect, it, vi } from "vitest";
import {
  callAnthropic,
  callOpenAICompatible,
  runAiPrompt,
  runAiPromptWithRetry,
  sanitizeProse,
  type AiRequestLimiter,
} from "../src/services/pitch/generatePitch.js";
import type { ResolvedAi } from "../src/config/runtime.js";

function ai(overrides: Partial<ResolvedAi> = {}): ResolvedAi {
  return {
    provider: "openai",
    protocol: "openai",
    apiKey: "sk-test",
    model: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
    requestsPerMinute: 30,
    configured: true,
    source: "db",
    ...overrides,
  };
}

const okJson = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("callOpenAICompatible", () => {
  it("sends response_format only to api.openai.com", async () => {
    const f = vi.fn(async () => okJson('{"observation":"o","subject":"s","message":"m"}')) as unknown as typeof fetch;
    await callOpenAICompatible("prompt", ai(), f);
    const body = JSON.parse((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("omits response_format for NVIDIA / custom endpoints", async () => {
    const f = vi.fn(async () => okJson('{"observation":"o","subject":"s","message":"m"}')) as unknown as typeof fetch;
    await callOpenAICompatible("prompt", ai({ provider: "nvidia", baseUrl: "https://integrate.api.nvidia.com/v1" }), f);
    const body = JSON.parse((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.response_format).toBeUndefined();
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer sk-test" });
  });

  it("omits the Authorization header when no key (local server)", async () => {
    const f = vi.fn(async () => okJson("{}")) as unknown as typeof fetch;
    await callOpenAICompatible("p", ai({ provider: "custom", apiKey: "", baseUrl: "http://localhost:11434/v1" }), f);
    const headers = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].headers;
    expect(headers.Authorization).toBeUndefined();
  });

  it("throws with the provider name and status on error", async () => {
    const f = vi.fn(async () => new Response("bad", { status: 401 })) as unknown as typeof fetch;
    await expect(callOpenAICompatible("p", ai({ provider: "nvidia" }), f)).rejects.toThrow(/nvidia error 401/);
  });
});

describe("callAnthropic", () => {
  it("uses the messages endpoint and returns text content", async () => {
    const f = vi.fn(async () =>
      new Response(JSON.stringify({ content: [{ type: "text", text: "hello" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ) as unknown as typeof fetch;
    const r = await callAnthropic("p", ai({ provider: "anthropic", protocol: "anthropic", baseUrl: "https://api.anthropic.com" }), f);
    expect(r.text).toBe("hello");
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init as RequestInit).headers).toMatchObject({ "x-api-key": "sk-test", "anthropic-version": "2023-06-01" });
  });
});

describe("runAiPrompt", () => {
  it("routes by protocol", async () => {
    const f = vi.fn(async () => okJson('{"subject":"s","message":"m"}')) as unknown as typeof fetch;
    await runAiPrompt("p", ai({ protocol: "openai" }), f);
    expect((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain("/chat/completions");
  });

  it("throws when no provider protocol is set", async () => {
    await expect(runAiPrompt("p", ai({ protocol: "none", configured: false }))).rejects.toThrow(/No AI provider/);
  });

  it("globally cools down and retries a provider 429", async () => {
    let calls = 0;
    const blocked: number[] = [];
    const sleeps: number[] = [];
    const limiter: AiRequestLimiter = {
      waitTurn: async () => undefined,
      blockFor: (ms) => blocked.push(ms),
    };
    const f = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("quota", { status: 429, headers: { "retry-after": "90" } });
      }
      return okJson('{"observation":"o","subject":"s","message":"m"}');
    }) as typeof fetch;

    const result = await runAiPromptWithRetry("p", ai(), {
      fetchImpl: f,
      limiter,
      sleepImpl: async (ms) => {
        sleeps.push(ms);
      },
      random: () => 0,
    });

    expect(result.provider).toBe("openai");
    expect(calls).toBe(2);
    expect(blocked).toEqual([90_000]);
    expect(sleeps).toEqual([5_000]);
  });

  it("does not retry permanent AI authentication failures", async () => {
    let calls = 0;
    const limiter: AiRequestLimiter = {
      waitTurn: async () => undefined,
      blockFor: () => undefined,
    };
    const f = (async () => {
      calls += 1;
      return new Response("bad key", { status: 401 });
    }) as typeof fetch;

    await expect(
      runAiPromptWithRetry("p", ai(), {
        fetchImpl: f,
        limiter,
        sleepImpl: async () => undefined,
      }),
    ).rejects.toThrow(/openai error 401/);
    expect(calls).toBe(1);
  });
});

describe("sanitizeProse (house style enforced on model output)", () => {
  it("replaces em and en dashes with commas", () => {
    expect(sanitizeProse("We build sites — fast — for you")).toBe("We build sites, fast, for you");
    expect(sanitizeProse("range 3–4 weeks")).toBe("range 3, 4 weeks");
  });
  it("straightens curly quotes", () => {
    expect(sanitizeProse("“Hello” and ‘hi’")).toBe('"Hello" and \'hi\'');
  });
  it("leaves clean prose untouched", () => {
    expect(sanitizeProse("A plain sentence, nothing fancy.")).toBe("A plain sentence, nothing fancy.");
  });
});
