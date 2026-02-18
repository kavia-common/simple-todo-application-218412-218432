import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "./App";

function typeAndAdd(text) {
  const input = screen.getByLabelText(/todo text/i);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /add todo/i }));
}

/**
 * Toasts can include the todo text (strong text), which makes global `getByText`
 * ambiguous. Scope todo-text assertions to the actual list region.
 */
function getTodoList() {
  return screen.getByRole("list", { name: /todo list/i });
}

beforeEach(() => {
  window.localStorage.clear();
});

test("renders retro todo header", () => {
  render(<App />);
  expect(screen.getByText(/RETRO TODO/i)).toBeInTheDocument();
});

test("adds a todo, clears input, and shows it in the list", () => {
  render(<App />);

  const input = screen.getByLabelText(/todo text/i);
  typeAndAdd("  Learn React   testing ");

  // input cleared after add
  expect(input).toHaveValue("");

  // todo appears in list (not toast)
  const list = getTodoList();
  expect(within(list).getByText("Learn React testing")).toBeInTheDocument();
});

test("rejects empty todo on add", () => {
  render(<App />);

  const input = screen.getByLabelText(/todo text/i);
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: /add todo/i }));

  expect(screen.getByText(/type a mission first/i)).toBeInTheDocument();
});

test("toggles a todo complete and restores it", () => {
  render(<App />);

  typeAndAdd("Do the thing");

  const toggleBtn = screen.getByRole("button", { name: /mark as completed/i });
  fireEvent.click(toggleBtn);
  expect(screen.getByText(/mission complete/i)).toBeInTheDocument();

  const restoreBtn = screen.getByRole("button", { name: /mark as not completed/i });
  fireEvent.click(restoreBtn);
  expect(screen.getByText(/mission restored/i)).toBeInTheDocument();
});

test("edits a todo and can cancel", () => {
  render(<App />);

  typeAndAdd("Original");
  const editBtn = screen.getByRole("button", { name: /edit todo: original/i });
  fireEvent.click(editBtn);

  // modal opens
  const dialog = screen.getByRole("dialog", { name: /edit mission/i });
  const modalInput = within(dialog).getByLabelText(/todo text/i);

  fireEvent.change(modalInput, { target: { value: "Changed" } });
  fireEvent.click(within(dialog).getByRole("button", { name: /cancel/i }));

  // unchanged in list (not toast)
  const list = getTodoList();
  expect(within(list).getByText("Original")).toBeInTheDocument();

  // edit and save
  fireEvent.click(screen.getByRole("button", { name: /edit todo: original/i }));
  const dialog2 = screen.getByRole("dialog", { name: /edit mission/i });
  const modalInput2 = within(dialog2).getByLabelText(/todo text/i);

  fireEvent.change(modalInput2, { target: { value: "Changed" } });
  fireEvent.click(within(dialog2).getByRole("button", { name: /save/i }));

  const list2 = getTodoList();
  expect(within(list2).getByText("Changed")).toBeInTheDocument();
  expect(within(list2).queryByText("Original")).not.toBeInTheDocument();
});

test("rejects empty todo on edit", () => {
  render(<App />);

  typeAndAdd("A todo");
  fireEvent.click(screen.getByRole("button", { name: /edit todo: a todo/i }));

  const dialog = screen.getByRole("dialog", { name: /edit mission/i });
  const modalInput = within(dialog).getByLabelText(/todo text/i);

  fireEvent.change(modalInput, { target: { value: "   " } });
  fireEvent.click(within(dialog).getByRole("button", { name: /save/i }));

  expect(screen.getByText(/cannot be empty/i)).toBeInTheDocument();
});

test("deletes a todo via confirmation dialog", () => {
  render(<App />);

  typeAndAdd("Delete me");
  fireEvent.click(screen.getByRole("button", { name: /delete todo: delete me/i }));

  const dialog = screen.getByRole("dialog", { name: /confirm delete/i });
  fireEvent.click(within(dialog).getByRole("button", { name: /^delete$/i }));

  // After deleting the last todo, the app renders an empty-state and does not render the list.
  expect(screen.queryByRole("list", { name: /todo list/i })).not.toBeInTheDocument();
  expect(screen.getByText(/no missions yet/i)).toBeInTheDocument();

  // Confirm the deleted item is gone from the UI.
  expect(screen.queryByText("Delete me")).not.toBeInTheDocument();

  expect(screen.getByText(/deleted mission/i)).toBeInTheDocument();
});

test("persists todos to localStorage and restores on re-mount", () => {
  const { unmount } = render(<App />);

  typeAndAdd("Persisted");
  const list = getTodoList();
  expect(within(list).getByText("Persisted")).toBeInTheDocument();

  unmount();

  render(<App />);
  const list2 = getTodoList();
  expect(within(list2).getByText("Persisted")).toBeInTheDocument();
});
