import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { App } from "../src/App";

test("renders the dashboard shell", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "dpdpkit admin" })).toBeTruthy();
});
