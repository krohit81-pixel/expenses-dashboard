import { describe, expect, it } from "vitest";

import { parseItineraryText } from "./parse-itinerary";

describe("parseItineraryText", () => {
  it("extracts destination, date range, and flight from a typical e-ticket layout", () => {
    const text =
      "E-Ticket Itinerary Passenger: Rohit Kohli Flight AI 380 Departure: 23 Dec 2026 Return: 03 Jan 2027 Destination: Singapore";
    const result = parseItineraryText(text);
    expect(result.destination).toBe("Singapore");
    expect(result.startDate).toBe("2026-12-23");
    expect(result.endDate).toBe("2027-01-03");
    expect(result.flight).toBe("AI 380");
  });

  it("extracts an airport-code route when there's no labelled destination", () => {
    const result = parseItineraryText(
      "Flight 6E 5123 BOM - GOI Departing 25 Jul 2026",
    );
    expect(result.destination).toBe("GOI");
    expect(result.flight).toBe("6E 5123");
    expect(result.startDate).toBe("2026-07-25");
  });

  it("handles a Month Day, Year style date", () => {
    const result = parseItineraryText(
      "Boarding pass. Jul 25, 2026. Flight UA 82.",
    );
    expect(result.startDate).toBe("2026-07-25");
    expect(result.flight).toBe("UA 82");
  });

  it("handles an ISO-style date", () => {
    const result = parseItineraryText(
      "Confirmation for 2026-11-06 flight SQ 423",
    );
    expect(result.startDate).toBe("2026-11-06");
  });

  it("uses the earliest and latest date found as start/end when several dates appear", () => {
    const result = parseItineraryText(
      "Issued 1 Jul 2026. Departs 25 Jul 2026. Returns 28 Jul 2026.",
    );
    expect(result.startDate).toBe("2026-07-01");
    expect(result.endDate).toBe("2026-07-28");
  });

  it("returns nulls rather than throwing on text with nothing recognizable", () => {
    const result = parseItineraryText(
      "This is just some unrelated text with no dates.",
    );
    expect(result.startDate).toBeNull();
    expect(result.endDate).toBeNull();
    expect(result.flight).toBeNull();
    expect(result.destination).toBeNull();
  });

  it("does not crash on empty input", () => {
    expect(() => parseItineraryText("")).not.toThrow();
  });
});
