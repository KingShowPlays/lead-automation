import { describe, expect, it } from "vitest";
import { buildQueries, searchPlaces } from "../src/services/discovery/googlePlaces.js";

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

  it("skips permanently/temporarily closed businesses", async () => {
    const results = await searchPlaces("q", "Lagos", "restaurants", {
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
      apiKey: "k",
      fetchImpl: fakeFetch([{ places: [fakePlace("soon", { businessStatus: "FUTURE_OPENING" })] }]),
    });
    expect(results[0].openingSoon).toBe(true);
  });

  it("follows pagination up to maxResults", async () => {
    const page1 = { places: Array.from({ length: 20 }, (_, i) => fakePlace(`p1-${i}`)), nextPageToken: "t2" };
    const page2 = { places: Array.from({ length: 20 }, (_, i) => fakePlace(`p2-${i}`)) };
    const results = await searchPlaces("q", "Lagos", "restaurants", {
      apiKey: "k",
      maxResults: 40,
      fetchImpl: fakeFetch([page1, page2]),
    });
    expect(results).toHaveLength(40);
    expect(results[39].googlePlaceId).toBe("p2-19");
  });

  it("throws a clear error without an API key", async () => {
    await expect(searchPlaces("q", "Lagos", "restaurants", { apiKey: "" })).rejects.toThrow(/GOOGLE_PLACES_API_KEY/);
  });

  it("skips nameless places", async () => {
    const results = await searchPlaces("q", "Lagos", "restaurants", {
      apiKey: "k",
      fetchImpl: fakeFetch([{ places: [{ id: "x" }, fakePlace("named")] }]),
    });
    expect(results.map((r) => r.googlePlaceId)).toEqual(["named"]);
  });
});
