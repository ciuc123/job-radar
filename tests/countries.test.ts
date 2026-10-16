import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCountries } from "@/lib/jobs/countries";
import { detectHiringRestriction } from "@/lib/jobs/restrictions";

test("splits comma-joined countries into single entries", () => {
  assert.deepEqual(normalizeCountries(["Germany, France", "Spain"], ""), ["Germany", "France", "Spain"]);
});

test("maps aliases, dedupes and keeps regions", () => {
  assert.deepEqual(normalizeCountries(["USA", "United States", "UK", "Europe"], ""), ["United States", "United Kingdom", "Europe"]);
});

test("derives countries from the location only when recognised", () => {
  assert.deepEqual(normalizeCountries([], "Romania, Poland"), ["Romania", "Poland"]);
  assert.deepEqual(normalizeCountries([], "Remote Europe"), []);
  assert.deepEqual(normalizeCountries([], "Worldwide"), ["Worldwide"]);
});

test("keeps unrecognised source-provided countries", () => {
  assert.deepEqual(normalizeCountries(["Atlantis"], ""), ["Atlantis"]);
});

test("detects 'only hires from' restrictions", () => {
  assert.deepEqual(detectHiringRestriction("We only hire from Germany."), ["Germany"]);
  assert.deepEqual(detectHiringRestriction("Only hiring candidates located in Spain or Portugal."), ["Portugal", "Spain"]);
  assert.deepEqual(detectHiringRestriction("This role is US only."), ["United States"]);
  assert.deepEqual(detectHiringRestriction("Canada-only position"), ["Canada"]);
  assert.deepEqual(detectHiringRestriction("You must be located in the United States."), ["United States"]);
  assert.deepEqual(detectHiringRestriction("Open to candidates in Brazil only"), ["Brazil"]);
});

test("does not flag unrestricted listings", () => {
  assert.deepEqual(detectHiringRestriction("Work remotely from anywhere in Europe or the US."), []);
  assert.deepEqual(detectHiringRestriction("Not only will you code, contact us today."), []);
  assert.deepEqual(detectHiringRestriction("We are a remote-first company."), []);
});

import { acceptsCountry, jobAvailability } from "@/lib/jobs/availability";

test("availability: open, regional and locked roles", () => {
  assert.equal(jobAvailability({ countries: [] }).kind, "open");
  assert.equal(jobAvailability({ countries: ["Worldwide"] }).kind, "open");
  assert.equal(jobAvailability({ countries: ["Romania", "Europe"] }).kind, "regional");
  const feed = jobAvailability({ countries: ["Germany", "France"] });
  assert.equal(feed.kind, "locked");
  assert.equal(acceptsCountry(feed, "Germany"), true);
  assert.equal(acceptsCountry(feed, "Romania"), false);
});

test("availability: a listing-level restriction overrides an open feed", () => {
  const locked = jobAvailability({ countries: [], hiringRestriction: ["United States"] });
  assert.equal(locked.kind, "locked");
  assert.equal(acceptsCountry(locked, "Romania"), false);
  assert.equal(acceptsCountry(locked, "united states"), true);
  assert.equal(acceptsCountry(jobAvailability({ countries: [] }), "Romania"), true);
});
