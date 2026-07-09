import repos from "./repos.config.json";
import rules from "./rules.config.json";

export interface RepoConfig {
  name: string;
  repoId: string;
  devBranch: string;
  stagingBranch: string;
}

export interface RulesConfig {
  requiredStates: string[];
  requireReleaseTag: boolean;
  requireWorkItemReference: boolean;
  workItemTypes: string[];
}

export function loadRepos(): RepoConfig[] {
  return repos as RepoConfig[];
}

export function loadRules(): RulesConfig {
  return rules as RulesConfig;
}
