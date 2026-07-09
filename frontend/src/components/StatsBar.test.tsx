import { it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsBar } from "./StatsBar";

it("renders each stat count", () => {
  render(<StatsBar stats={{ total: 5, ready: 2, warning: 1, badState: 1, noTicket: 1 }} />);
  expect(screen.getByText(/Ready/).textContent).toMatch(/2/);
  expect(screen.getByText(/Wrong state/).textContent).toMatch(/1/);
});
