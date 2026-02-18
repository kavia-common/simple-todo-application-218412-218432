import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders retro todo header", () => {
  render(<App />);
  expect(screen.getByText(/RETRO TODO/i)).toBeInTheDocument();
});
