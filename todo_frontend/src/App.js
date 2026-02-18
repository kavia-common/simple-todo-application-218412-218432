import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const STORAGE_KEY = "retroTodo.react.v1";

/**
 * @typedef {{id: string, text: string, done: boolean, createdAt: number, updatedAt: number}} Todo
 */

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function createId() {
  // Non-crypto id is fine for local-only demo.
  return `t_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatTime(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * @returns {{todos: Todo[]}}
 */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { todos: [] };
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") return { todos: [] };
    if (!Array.isArray(parsed.todos)) return { todos: [] };

    const safeTodos = parsed.todos
      .filter((t) => t && typeof t === "object")
      .map((t) => ({
        id: typeof t.id === "string" ? t.id : createId(),
        text: typeof t.text === "string" ? t.text : "Untitled mission",
        done: Boolean(t.done),
        createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
        updatedAt:
          typeof t.updatedAt === "number"
            ? t.updatedAt
            : typeof t.createdAt === "number"
              ? t.createdAt
              : Date.now(),
      }));

    return { todos: safeTodos };
  } catch (e) {
    // If storage is corrupted, app should still work in-memory.
    // eslint-disable-next-line no-console
    console.warn("Failed to load state:", e);
    return { todos: [] };
  }
}

/**
 * @param {{todos: Todo[]}} state
 */
function persistState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("Failed to persist state:", e);
    // Keep app functional in-memory.
  }
}

function seedTodos() {
  const now = Date.now();
  return [
    {
      id: createId(),
      text: "Buy milk (and snacks for the LAN party)",
      done: false,
      createdAt: now - 1000 * 60 * 60 * 2,
      updatedAt: now - 1000 * 60 * 60 * 2,
    },
    {
      id: createId(),
      text: "Ship retro interactive HTML to the team",
      done: true,
      createdAt: now - 1000 * 60 * 25,
      updatedAt: now - 1000 * 60 * 5,
    },
    {
      id: createId(),
      text: "Refactor 'laser' CSS into reusable tokens",
      done: false,
      createdAt: now - 1000 * 60 * 90,
      updatedAt: now - 1000 * 60 * 40,
    },
    {
      id: createId(),
      text: "Call mom",
      done: false,
      createdAt: now - 1000 * 60 * 10,
      updatedAt: now - 1000 * 60 * 10,
    },
  ];
}

function useToast() {
  const [toast, setToast] = useState({ open: false, message: "", strong: "", kind: "info" });
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  // PUBLIC_INTERFACE
  function show(message, opts = {}) {
    /** Show a transient toast. */
    const kind = opts.kind || "info";
    const strong = opts.strong || "";
    setToast({ open: true, message, strong, kind });

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, open: false }));
    }, 1800);
  }

  return { toast, show };
}

function Modal({ open, title, titleId, descriptionId, onClose, children, initialFocusRef }) {
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus management (simple, but effective for this small app)
    const t = window.setTimeout(() => {
      if (initialFocusRef?.current && typeof initialFocusRef.current.focus === "function") {
        initialFocusRef.current.focus();
      }
    }, 0);

    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, initialFocusRef]);

  useEffect(() => {
    if (!open) return;

    const handler = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal" aria-hidden="false">
      <button
        type="button"
        className="modal__backdrop"
        data-close="true"
        aria-label="Close modal"
        onClick={onClose}
      />
      <div
        className="modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="modal__head">
          <h2 id={titleId} className="modal__title">
            {title}
          </h2>
          <button className="btn btn--tiny" type="button" onClick={onClose} aria-label="Close dialog">
            Esc
          </button>
        </div>

        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
function App() {
  /** Retro-themed todo app: add/edit/delete/toggle with localStorage persistence. */
  const [state, setState] = useState(() => loadState());
  const [composeText, setComposeText] = useState("");
  const inputRef = useRef(null);

  const { toast, show: showToast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [editTodoId, setEditTodoId] = useState(null);
  const [editText, setEditText] = useState("");
  const editInputRef = useRef(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTodoId, setConfirmTodoId] = useState(null);
  const confirmDeleteRef = useRef(null);

  const lastFocusRef = useRef(null);

  // Persist on every state change.
  useEffect(() => {
    persistState(state);
  }, [state]);

  // Initial focus for fast use.
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const todos = state.todos;

  const stats = useMemo(() => {
    const total = todos.length;
    const done = todos.filter((t) => t.done).length;
    const pending = total - done;
    return { total, done, pending };
  }, [todos]);

  const editTodo = useMemo(() => {
    if (!editTodoId) return null;
    return todos.find((t) => t.id === editTodoId) || null;
  }, [todos, editTodoId]);

  const confirmTodo = useMemo(() => {
    if (!confirmTodoId) return null;
    return todos.find((t) => t.id === confirmTodoId) || null;
  }, [todos, confirmTodoId]);

  function setTodos(updater) {
    setState((prev) => {
      const nextTodos = typeof updater === "function" ? updater(prev.todos) : updater;
      return { ...prev, todos: nextTodos };
    });
  }

  function addFromCompose() {
    const text = normalizeText(composeText);
    if (!text) {
      showToast("Type a mission first.", { kind: "warn" });
      if (inputRef.current) inputRef.current.focus();
      return;
    }

    const now = Date.now();
    const todo = { id: createId(), text, done: false, createdAt: now, updatedAt: now };

    setTodos((prev) => [todo, ...prev]);
    setComposeText("");
    showToast("Added: ", { strong: todo.text });

    if (inputRef.current) inputRef.current.focus();
  }

  function toggleTodo(id) {
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const nextDone = !t.done;
        return { ...t, done: nextDone, updatedAt: Date.now() };
      })
    );

    const t = todos.find((x) => x.id === id);
    showToast(t && !t.done ? "Mission complete." : "Mission restored.");
  }

  function openEdit(id, focusEl) {
    const t = todos.find((x) => x.id === id);
    if (!t) return;

    lastFocusRef.current = focusEl || document.activeElement;
    setEditTodoId(id);
    setEditText(t.text);
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditTodoId(null);
    setEditText("");

    const el = lastFocusRef.current;
    lastFocusRef.current = null;
    window.setTimeout(() => {
      if (el && typeof el.focus === "function") el.focus();
      else if (inputRef.current) inputRef.current.focus();
    }, 0);
  }

  function saveEdit() {
    if (!editTodoId) return;

    const next = normalizeText(editText);
    if (!next) {
      showToast("Todo text cannot be empty.", { kind: "warn" });
      if (editInputRef.current) editInputRef.current.focus();
      return;
    }

    setTodos((prev) =>
      prev.map((t) => (t.id === editTodoId ? { ...t, text: next, updatedAt: Date.now() } : t))
    );

    showToast("Saved changes.", { strong: next });
    closeEdit();
  }

  function openConfirm(id, focusEl) {
    const t = todos.find((x) => x.id === id);
    if (!t) return;

    lastFocusRef.current = focusEl || document.activeElement;
    setConfirmTodoId(id);
    setConfirmOpen(true);
  }

  function closeConfirm() {
    setConfirmOpen(false);
    setConfirmTodoId(null);

    const el = lastFocusRef.current;
    lastFocusRef.current = null;
    window.setTimeout(() => {
      if (el && typeof el.focus === "function") el.focus();
      else if (inputRef.current) inputRef.current.focus();
    }, 0);
  }

  function confirmDelete() {
    if (!confirmTodoId) return;
    const removed = todos.find((t) => t.id === confirmTodoId);

    setTodos((prev) => prev.filter((t) => t.id !== confirmTodoId));
    closeConfirm();
    showToast("Deleted mission.", { strong: removed ? removed.text : "" });
  }

  function resetAll() {
    setTodos([]);
    showToast("All missions cleared.");
  }

  function seedDemo() {
    if (todos.length > 0) {
      showToast("Queue already has missions. Reset first if you want a clean seed.");
      return;
    }
    setTodos(seedTodos());
    showToast("Seeded demo missions.");
  }

  return (
    <div className="retroApp">
      <div className="fx" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />

      <div className="wrap">
        <div className="shell" role="application" aria-label="Retro todo app">
          <header>
            <div className="brand">
              <h1 className="title">RETRO TODO // REACT</h1>
              <p className="subtitle">Neon CRT todo list (add / edit / delete)</p>
            </div>

            <div className="status" aria-label="Status">
              <div className="pillrow">
                <div className="pill pill--cyan" title="Storage mode">
                  MODE: <strong>LOCAL</strong>
                </div>
                <div className="pill pill--pink" title="Theme">
                  THEME: <strong>CRT</strong>
                </div>
                <div className="pill pill--lime" title="Autosave">
                  SAVE: <strong>ON</strong>
                </div>
              </div>

              <p className="hint">
                Tip: press <kbd>Enter</kbd> to add, <kbd>Esc</kbd> to close dialogs
              </p>
            </div>
          </header>

          <main>
            <section className="card" aria-label="Todos">
              <div className="card__head">
                <h2 className="card__title">ADD NEW MISSION</h2>
                <div className="pill" aria-hidden="true">
                  v1.0 react
                </div>
              </div>

              <div className="card__body">
                <div className="compose">
                  <div>
                    <label htmlFor="todoInput">Todo text</label>

                    <div className="fieldrow">
                      <input
                        ref={inputRef}
                        id="todoInput"
                        className="input"
                        type="text"
                        placeholder="e.g., Defeat the bug boss in level 3..."
                        value={composeText}
                        onChange={(e) => setComposeText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addFromCompose();
                        }}
                        aria-describedby="composeHelp"
                        maxLength={200}
                        autoComplete="off"
                      />

                      <button className="btn btn--primary" type="button" onClick={addFromCompose}>
                        + Add
                      </button>

                      <button
                        className="btn btn--ghost"
                        type="button"
                        onClick={() => {
                          setComposeText("");
                          if (inputRef.current) inputRef.current.focus();
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="micro" id="composeHelp">
                    <span>
                      <i className="dot dot--cyan" aria-hidden="true" />
                      Click checkbox to toggle done
                    </span>
                    <span>
                      <i className="dot dot--pink" aria-hidden="true" />
                      Edit (✎) opens a dialog
                    </span>
                    <span>
                      <i className="dot dot--red" aria-hidden="true" />
                      Delete (🗑) asks for confirmation
                    </span>
                  </div>

                  <div className="divider" role="separator" aria-hidden="true" />

                  <div className="listwrap" aria-label="Current queue">
                    <div className="listhead">
                      <h2 className="card__title listhead__title">CURRENT QUEUE</h2>
                      <button
                        className="btn btn--warn btn--tiny"
                        type="button"
                        title="Clears ALL todos"
                        onClick={resetAll}
                        disabled={stats.total === 0}
                      >
                        Reset all
                      </button>
                    </div>

                    {stats.total === 0 ? (
                      <div className="empty">
                        No missions yet. Type something above and hit <strong className="strong">Enter</strong>.
                      </div>
                    ) : (
                      <ul className="list" aria-label="Todo list">
                        {todos.map((t) => (
                          <li key={t.id} className={t.done ? "todo todo--done" : "todo"} data-id={t.id}>
                            <button
                              className="checkbtn"
                              type="button"
                              aria-label="Toggle complete"
                              onClick={() => toggleTodo(t.id)}
                            />

                            <div className="todo__text">
                              <div className="todo__label" title={t.text}>
                                {t.text}
                              </div>
                              <div className="todo__meta">
                                <span className={t.done ? "tag tag--lime" : "tag tag--amber"}>
                                  {t.done ? "Status: Complete" : "Status: Pending"}
                                </span>
                                <span className="tag">Created: {formatTime(t.createdAt)}</span>
                                <span className="tag tag--cyan">Updated: {formatTime(t.updatedAt)}</span>
                              </div>
                            </div>

                            <div className="todo__actions" aria-label="Actions">
                              <button
                                className="iconbtn iconbtn--edit"
                                type="button"
                                aria-label="Edit todo"
                                title="Edit"
                                onClick={(e) => openEdit(t.id, e.currentTarget)}
                              >
                                ✎
                              </button>
                              <button
                                className="iconbtn iconbtn--del"
                                type="button"
                                aria-label="Delete todo"
                                title="Delete"
                                onClick={(e) => openConfirm(t.id, e.currentTarget)}
                              >
                                🗑
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <p className="footer">
                      Data is stored in <span className="tag tag--cyan">localStorage</span>. Reference mockups:{" "}
                      <a href="/retro-todo-interactive.html">interactive HTML</a> /{" "}
                      <a href="/retro-todo-mockup.html">static mockup</a>.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <aside className="sidegrid" aria-label="Sidebar">
              <section className="card">
                <div className="card__head">
                  <h2 className="card__title">DASHBOARD</h2>
                  <div className="pill" aria-hidden="true">
                    stats
                  </div>
                </div>

                <div className="card__body">
                  <div className="statbox" role="group" aria-label="Todo stats">
                    <div className="bigstat">
                      <div className="bigstat__label">Total</div>
                      <div className="bigstat__value">{stats.total}</div>
                    </div>
                    <div className="bigstat">
                      <div className="bigstat__label">Completed</div>
                      <div className="bigstat__value">{stats.done}</div>
                    </div>
                    <div className="bigstat">
                      <div className="bigstat__label">Pending</div>
                      <div className="bigstat__value">{stats.pending}</div>
                    </div>
                  </div>

                  <div className="divider" role="separator" aria-hidden="true" />

                  <p className="note">
                    Quick actions:
                    <br />
                    <button className="btn btn--tiny" type="button" onClick={seedDemo}>
                      Seed demo todos
                    </button>
                  </p>
                </div>
              </section>

              <section className="card">
                <div className="card__head">
                  <h2 className="card__title">HOTKEYS</h2>
                  <div className="pill" aria-hidden="true">
                    ui
                  </div>
                </div>
                <div className="card__body">
                  <p className="note">
                    <strong className="strong">Enter</strong> — add todo
                    <br />
                    <strong className="strong">Esc</strong> — close dialogs
                    <br />
                    <strong className="strong">Click checkbox</strong> — toggle done
                  </p>

                  <div className="divider" role="separator" aria-hidden="true" />

                  <p className="note">Retro style: neon gradients, scanlines, grid floor, pixel header font.</p>
                </div>
              </section>
            </aside>
          </main>
        </div>
      </div>

      <Modal
        open={editOpen}
        title="EDIT MISSION"
        titleId="editTitle"
        descriptionId="editDesc"
        onClose={closeEdit}
        initialFocusRef={editInputRef}
      >
        <p id="editDesc" className="note modalNote">
          Modify mission text and hit <span className="tag tag--lime">Save</span>.
        </p>

        <div>
          <label htmlFor="editInput">Todo text</label>
          <input
            ref={editInputRef}
            id="editInput"
            className="input"
            type="text"
            maxLength={200}
            autoComplete="off"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
            }}
          />

          <div className="micro micro--modal">
            <span>
              <i className="dot dot--cyan" aria-hidden="true" />
              ID: <span>{editTodo ? editTodo.id : "—"}</span>
            </span>
            <span>
              <i className="dot dot--pink" aria-hidden="true" />
              Created: <span>{editTodo ? formatTime(editTodo.createdAt) : "—"}</span>
            </span>
          </div>
        </div>

        <div className="modal__actions">
          <button className="btn btn--ghost" type="button" onClick={closeEdit}>
            Cancel
          </button>
          <button className="btn btn--primary" type="button" onClick={saveEdit}>
            Save
          </button>
        </div>
      </Modal>

      <Modal
        open={confirmOpen}
        title="CONFIRM DELETE"
        titleId="confirmTitle"
        descriptionId="confirmDesc"
        onClose={closeConfirm}
        initialFocusRef={confirmDeleteRef}
      >
        <p id="confirmDesc" className="note modalNote">
          This will permanently delete the mission:
        </p>

        <div className="empty empty--solid">
          <span className="tag tag--red">Target</span>{" "}
          <strong className="strong">{confirmTodo ? confirmTodo.text : ""}</strong>
        </div>

        <div className="modal__actions">
          <button className="btn btn--ghost" type="button" onClick={closeConfirm}>
            Cancel
          </button>
          <button ref={confirmDeleteRef} className="btn btn--warn" type="button" onClick={confirmDelete}>
            Delete
          </button>
        </div>
      </Modal>

      <div
        className={toast.open ? "toast toast--show" : "toast"}
        role="status"
        aria-live="polite"
        style={{
          borderColor:
            toast.kind === "warn" ? "rgba(251, 113, 133, 0.30)" : "rgba(125, 211, 252, 0.28)",
        }}
      >
        {toast.strong ? (
          <>
            {toast.message}
            <span className="toast__strong">{toast.strong}</span>
          </>
        ) : (
          toast.message
        )}
      </div>
    </div>
  );
}

export default App;
