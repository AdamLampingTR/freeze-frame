import { describe, it, expect } from "vitest";
import { loadRepos, loadRules } from "./index";

describe("config", () => {
  it("loads both monitored repos with branch + repo id", () => {
    const repos = loadRepos();
    expect(repos.map((r) => r.name).sort()).toEqual([
      "TT.AskDI",
      "TT.OfficeAddin",
    ]);
    const askdi = repos.find((r) => r.name === "TT.AskDI")!;
    expect(askdi.devBranch).toBe("development");
    expect(askdi.stagingBranch).toBe("staging");
    expect(askdi.repoId).toBe("1bc795ea-7164-4ac0-830c-8206a584ccb8");
  });

  it("loads rules with the D1 work-item-type filter", () => {
    const rules = loadRules();
    expect(rules.requiredStates).toContain("Verified");
    expect(rules.workItemTypes).toEqual(["User Story", "Bug"]);
    expect(rules.requireReleaseTag).toBe(true);
  });
});
