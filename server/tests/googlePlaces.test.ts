import { describe, expect, it } from "vitest";
import {
  buildQueries,
  PlacesRateLimiter,
  searchPlaces,
  type PlacesRequestLimiter,
} from "../src/services/discovery/googlePlaces.js";

const noWaitLimiter: PlacesRequestLimiter = {
  waitTurn: async () => undefined,
  blockFor: () => undefined,
};

const noDelay = {
  rateLimiter: noWaitLimiter,
  sleepImpl: async (_ms: number) => undefined,
  random: () => 0,
};

function fakePlace(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    displayName: { text: `Business ${id}` },
    formattedAddress: `${id} Street, Lagos`,
    location: { latitude: 6.5, longitude: 3.3 },
    businessStatus: "OPERATIONAL",
    nationalPhoneNumber: "0803 123 4567",
    googleMapsUri: `https://maps.google.com/?cid=${id}`,
    types: ["restaurant"],
    rating: 4.4,
    userRatingCount: 120,
    ...overrides,
  };
}

function fakeFetch(pages: Array<Record<string, unknown>>): typeof fetch {
  let call = 0;
  return (async () => {
    const body = pages[Math.min(call, pages.length - 1)];
    call++;
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

describe("buildQueries", () => {
  it("builds city x category matrix", () => {
    const qs = buildQueries(["Lagos", "Abuja"], ["restaurants", "hotels"]);
    expect(qs).toHaveLength(4);
    expect(qs[0]).toEqual({ query: "restaurants in Lagos", city: "Lagos", category: "restaurants" });
    expect(qs.map((q) => q.query)).toContain("hotels in Abuja");
  });
});

describe("searchPlaces", () => {
  it("maps places to DiscoveredBusiness", async () => {
    const results = await searchPlaces("restaurants in Lagos", "Lagos", "restaurants", {
      ...noDelay,
      apiKey: "test-key",
      fetchImpl: fakeFetch([{ places: [fakePlace("a"), fakePlace("b", { websiteUri: "https://b.example" })] }]),
    });
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      googlePlaceId: "a",
      businessName: "Business a",
      city: "Lagos",
      category: "restaurants",
      phone: "0803 123 4567",
      openingSoon: false,
      searchQuery: "restaurants in Lagos",
    });
    expect(results[1].websiteUrl).toBe("https://b.example");
  });

  it("uses the balanced 60 requests/minute default", async () => {
    const observedRates: number[] = [];
    await searchPlaces("q", "Lagos", "restaurants", {
      apiKey: "k",
      fetchImpl: fakeFetch([{ places: [fakePlace("paced")] }]),
      rateLimiter: {
        waitTurn: async (requestsPerMinute) => {
          observedRates.push(requestsPerMinute);
        },
        blockFor: () => undefined,
      },
      sleepImpl: async () => undefined,
    });
    expect(observedRates).toEqual([60]);
  });

  it("skips permanently/temporarily closed businesses", async () => {
    const results = await searchPlaces("q", "Lagos", "restaurants", {
      ...noDelay,
      apiKey: "k",
      fetchImpl: fakeFetch([
        {
          places: [
            fakePlace("open"),
            fakePlace("gone", { businessStatus: "CLOSED_PERMANENTLY" }),
            fakePlace("paused", { businessStatus: "CLOSED_TEMPORARILY" }),
          ],
        },
      ]),
    });
    expect(results.map((r) => r.googlePlaceId)).toEqual(["open"]);
  });

  it("flags FUTURE_OPENING as openingSoon", async () => {
    const results = await searchPlaces("q", "Abuja", "hotels", {
      ...noDelay,
      apiKey: "k",
      fetchImpl: fakeFetch([{ places: [fakePlace("soon", { businessStatus: "FUTURE_OPENING" })] }]),
    });
    expect(results[0].openingSoon).toBe(true);
  });

  it("follows pagination up to maxResults", async () => {
    const page1 = { places: Array.from({ length: 20 }, (_, i) => fakePlace(`p1-${i}`)), nextPageToken: "t2" };
    const page2 = { places: Array.from({ length: 20 }, (_, i) => fakePlace(`p2-${i}`)) };
    const results = await searchPlaces("q", "Lagos", "restaurants", {
      ...noDelay,
      apiKey: "k",
      maxResults: 40,
      fetchImpl: fakeFetch([page1, page2]),
    });
    expect(results).toHaveLength(40);
    expect(results[39].googlePlaceId).toBe("p2-19");
  });

  it("throws a clear error without an API key", async () => {
    await expect(searchPlaces("q", "Lagos", "restaurants", { ...noDelay, apiKey: "" })).rejects.toThrow(
      /GOOGLE_PLACES_API_KEY/,
    );
  });

  it("skips nameless places", async () => {
    const results = await searchPlaces("q", "Lagos", "restaurants", {
      ...noDelay,
      apiKey: "k",
      fetchImpl: fakeFetch([{ places: [{ id: "x" }, fakePlace("named")] }]),
    });
    expect(results.map((r) => r.googlePlaceId)).toEqual(["named"]);
  });

  it("honours Retry-After, blocks all Places traffic and retries a 429", async () => {
    const blocked: number[] = [];
    const sleeps: number[] = [];
    let calls = 0;
    const limiter: PlacesRequestLimiter = {
      waitTurn: async () => undefined,
      blockFor: (ms) => blocked.push(ms),
    };
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("quota", { status: 429, headers: { "retry-after": "90" } });
      }
      return new Response(JSON.stringify({ places: [fakePlace("recovered")] }), { status: 200 });
    }) as typeof fetch;

    const results = await searchPlaces("q", "Lagos", "restaurants", {
      apiKey: "k",
      fetchImpl,
      rateLimiter: limiter,
      sleepImpl: async (ms) => {
        sleeps.push(ms);
      },
      random: () => 0,
    });

    expect(results[0].googlePlaceId).toBe("recovered");
    expect(calls).toBe(2);
    expect(blocked).toEqual([90_000]);
    expect(sleeps).toContain(5_000);
  });

  it("stops after the bounded 429 retry sequence", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response("quota", { status: 429 });
    }) as typeof fetch;

    await expect(
      searchPlaces("q", "Lagos", "restaurants", {
        ...noDelay,
        apiKey: "k",
        fetchImpl,
      }),
    ).rejects.toThrow("Places API rate limited (429)");
    expect(calls).toBe(5);
  });

  it("does not retry permanent Places 4xx errors", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response("forbidden", { status: 403 });
    }) as typeof fetch;

    await expect(
      searchPlaces("q", "Lagos", "restaurants", {
        ...noDelay,
        apiKey: "k",
        fetchImpl,
      }),
    ).rejects.toThrow("Places API error 403");
    expect(calls).toBe(1);
  });
});

describe("PlacesRateLimiter", () => {
  it("serialises requests at the configured rate and applies a global cooldown", async () => {
    let now = 0;
    const sleeps: number[] = [];
    const limiter = new PlacesRateLimiter(
      () => now,
      async (ms) => {
        sleeps.push(ms);
        now += ms;
      },
    );

    await limiter.waitTurn(30);
    await limiter.waitTurn(30);
    limiter.blockFor(60_000);
    await limiter.waitTurn(30);

    expect(sleeps).toEqual([2_000, 60_000]);
  });
});
