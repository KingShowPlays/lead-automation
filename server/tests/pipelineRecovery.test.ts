import { describe, expect, it } from "vitest";
import { SearchRun } from "../src/models/SearchRun.js";
import { recoverableQueriesForRun } from "../src/services/pipeline/runPipeline.js";

describe("discovery run recovery", () => {
  it("returns failed and unattempted queries but never repeats successes", () => {
    const run = new SearchRun({
      plannedQueries: [
        { query: "restaurants in Accra", city: "Accra", category: "restaurants" },
        { query: "salons in Accra", city: "Accra", category: "salons" },
        { query: "hotels in Accra", city: "Accra", category: "hotels" },
      ],
      queries: [
        {
          query: "restaurants in Accra",
          city: "Accra",
          category: "restaurants",
          found: 20,
          created: 20,
          duplicates: 0,
          suppressed: 0,
        },
        {
          query: "salons in Accra",
          city: "Accra",
          category: "salons",
          found: 0,
          created: 0,
          duplicates: 0,
          suppressed: 0,
          error: "Places API rate limited (429)",
        },
      ],
    });

    expect(recoverableQueriesForRun(run).map((query) => query.query)).toEqual([
      "salons in Accra",
      "hotels in Accra",
    ]);
  });

  it("supports legacy runs that did not persist a separate query plan", () => {
    const run = new SearchRun({
      plannedQueries: [],
      queries: [
        {
          query: "restaurants in Kigali",
          city: "Kigali",
          category: "restaurants",
          found: 20,
          created: 20,
          duplicates: 0,
          suppressed: 0,
        },
        {
          query: "salons in Kigali",
          city: "Kigali",
          category: "salons",
          found: 0,
          created: 0,
          duplicates: 0,
          suppressed: 0,
          error: "Places API rate limited (429)",
        },
      ],
    });

    expect(recoverableQueriesForRun(run).map((query) => query.query)).toEqual(["salons in Kigali"]);
  });
});
