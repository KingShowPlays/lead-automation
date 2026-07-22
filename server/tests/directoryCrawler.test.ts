import { describe, expect, it, vi } from "vitest";
import {
  crawlDirectories,
  extractDirectoryLinks,
  extractSitemapUrls,
  nameFromDomain,
} from "../src/services/discovery/sources/directoryCrawler.js";

describe("extractSitemapUrls", () => {
  it("pulls <loc> entries from sitemap XML", () => {
    const xml = `<?xml version="1.0"?><urlset>
      <url><loc>https://shopa.ng/</loc></url>
      <url><loc>https://shopb.com.ng/store</loc></url>
    </urlset>`;
    expect(extractSitemapUrls(xml)).toEqual(["https://shopa.ng/", "https://shopb.com.ng/store"]);
  });
});

describe("extractDirectoryLinks", () => {
  const html = `
    <html><body>
      <a href="/internal">Internal nav</a>
      <a href="https://directory.example/listing/1">same host</a>
      <a href="https://crystalscents.ng">Crystal Scents</a>
      <a href="https://amarakitchen.com.ng/menu">Amara Kitchen</a>
      <a href="https://instagram.com/somebiz">IG</a>
      <a href="https://www.facebook.com/somebiz">FB</a>
      <a href="https://crystalscents.ng/products">Crystal Scents dupe host</a>
    </body></html>`;

  it("keeps outbound business links, drops internal + social + dupes", () => {
    const links = extractDirectoryLinks(html, "https://directory.example/list");
    const hosts = links.map((l) => new URL(l.url).hostname);
    expect(hosts).toContain("crystalscents.ng");
    expect(hosts).toContain("amarakitchen.com.ng");
    expect(hosts).not.toContain("instagram.com");
    expect(hosts).not.toContain("www.facebook.com");
    expect(hosts).not.toContain("directory.example");
    // crystalscents appears twice but is deduped by host
    expect(hosts.filter((h) => h === "crystalscents.ng")).toHaveLength(1);
  });

  it("captures the anchor text as a name hint", () => {
    const links = extractDirectoryLinks(html, "https://directory.example/list");
    const crystal = links.find((l) => l.url.includes("crystalscents"));
    expect(crystal?.name).toBe("Crystal Scents");
  });
});

describe("nameFromDomain", () => {
  it("derives a readable name from a domain", () => {
    expect(nameFromDomain("https://crystal-scents.ng/path")).toBe("Crystal Scents");
    expect(nameFromDomain("https://www.amarakitchen.com.ng")).toBe("Amarakitchen");
  });
});

describe("crawlDirectories", () => {
  it("fetches a directory page and yields IncomingLeads with source=directory", async () => {
    const html = `<a href="https://shopone.ng">Shop One</a><a href="https://shoptwo.com.ng">Shop Two</a>`;
    const fetchImpl = vi.fn(async () =>
      new Response(html, { status: 200, headers: { "content-type": "text/html" } }),
    ) as unknown as typeof fetch;

    const r = await crawlDirectories({
      urls: ["https://directory.example/new"],
      defaultCity: "Lagos",
      defaultCategory: "fashion",
      maxPerRun: 100,
      fetchImpl,
    });
    expect(r.pagesFetched).toBe(1);
    expect(r.leads).toHaveLength(2);
    expect(r.leads[0]).toMatchObject({ discoverySource: "directory", city: "Lagos", category: "fashion" });
    expect(r.leads.some((l) => (l.websiteUrl ?? "").includes("shopone.ng"))).toBe(true);
  });

  it("respects maxPerRun", async () => {
    const html = Array.from({ length: 10 }, (_, i) => `<a href="https://shop${i}.ng">Shop ${i}</a>`).join("");
    const fetchImpl = vi.fn(async () => new Response(html, { status: 200, headers: { "content-type": "text/html" } })) as unknown as typeof fetch;
    const r = await crawlDirectories({ urls: ["https://d.example"], defaultCity: "", defaultCategory: "", maxPerRun: 3, fetchImpl });
    expect(r.leads).toHaveLength(3);
  });

  it("records an error for an unreachable URL without throwing", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 403 })) as unknown as typeof fetch;
    const r = await crawlDirectories({ urls: ["https://blocked.example"], defaultCity: "", defaultCategory: "", maxPerRun: 10, fetchImpl });
    expect(r.leads).toHaveLength(0);
    expect(r.errors[0].error).toMatch(/403/);
  });

  it("parses a sitemap when the response is XML", async () => {
    const xml = `<?xml version="1.0"?><urlset><url><loc>https://newbiz.ng/</loc></url></urlset>`;
    const fetchImpl = vi.fn(async () => new Response(xml, { status: 200, headers: { "content-type": "application/xml" } })) as unknown as typeof fetch;
    const r = await crawlDirectories({ urls: ["https://site.example/sitemap.xml"], defaultCity: "Abuja", defaultCategory: "", maxPerRun: 10, fetchImpl });
    expect(r.leads).toHaveLength(1);
    expect(r.leads[0].websiteUrl).toBe("https://newbiz.ng/");
  });
});
