import { describe, it, expect } from "vitest";
import { parsePrId, parseAdoIds } from "./linking.service";

describe("linking pure helpers", () => {
  it("parses the PR id from a squash-merge subject", () => {
    expect(parsePrId("Merged PR 23521: ado-1137466 - Bug ...")).toBe(23521);
    expect(parsePrId("Merged PR #23490: ADO-1165133 Fix")).toBe(23490);
    expect(parsePrId("just a normal commit")).toBeNull();
  });

  it("parses distinct ADO ids in any accepted form, ignores bare numbers", () => {
    expect(parseAdoIds("ado-1137466 - Bug 1137466: title")).toEqual([
      "1137466",
    ]);
    expect(parseAdoIds("ADO-1160180 and ADO#1162189 and ADO 1155410")).toEqual([
      "1155410",
      "1160180",
      "1162189",
    ]);
    expect(parseAdoIds("Merged PR 23521: no ado ref")).toEqual([]);
  });
});
