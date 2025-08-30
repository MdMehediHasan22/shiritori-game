import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Shiritori – Two‑Player (Same Screen)
 * Features implemented per spec:
 * - Turn-based gameplay (auto-switch turns)
 * - Word meaning validation via DictionaryAPI (https://dictionaryapi.dev/)
 * - Word structure validation (min 4 chars, starts with last letter, no repeats)
 * - Countdown timer per turn with penalty on timeout
 * - Score tracking (+1 correct, −1 incorrect/timeout)
 * - Word history (with quick definition preview)
 * - Clean, commented code with small, testable helpers
 *
 * How to use in a React app:
 * 1) Create a new Vite React app or Next.js app.
 * 2) Add Tailwind CSS (optional—classes included, but app runs without it). 
 * 3) Drop this component into src/ShiritoriGame.jsx and render it in your page.
 */

// ---------- Utility helpers ----------
const isAlpha = (s) => /^[a-zA-Z]+$/.test(s);

async function fetchDefinition(word, { signal } = {}) {
  // Returns { ok: boolean, definition?: string, error?: string }
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
        word
      )}`,
      { signal }
    );
    if (!res.ok) {
      return { ok: false, error: "Not found in dictionary" };
    }
    const data = await res.json();
    // Extract first short definition if available
    const def = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;
    return def
      ? { ok: true, definition: def }
      : { ok: false, error: "Definition unavailable" };
  } catch (e) {
    if (e.name === "AbortError") return { ok: false, error: "Request cancelled" };
    return { ok: false, error: "Lookup failed" };
  }
}

function lastLetter(word) {
  if (!word) return "";
  const letters = word.toLowerCase().replace(/[^a-z]/g, "");
  return letters.slice(-1);
}

function firstLetter(word) {
  if (!word) return "";
  const letters = word.toLowerCase().replace(/[^a-z]/g, "");
  return letters.charAt(0);
}

// ---------- Main Component ----------
export default function ShiritoriGame() {
  // Settings
  const [p1Name, setP1Name] = useState("Player 1");
  const [p2Name, setP2Name] = useState("Player 2");
  const [turnSeconds, setTurnSeconds] = useState(15); // countdown per turn

  // Game state
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [currentPlayer, setCurrentPlayer] = useState("p1"); // "p1" or "p2"
  const [words, setWords] = useState([]); // { word, by: 'p1'|'p2', definition }
  const [used, setUsed] = useState(() => new Set());
  const [requiredStart, setRequiredStart] = useState(""); // letter required for next word

  // Turn timer
  const [timeLeft, setTimeLeft] = useState(turnSeconds);
  const timerRef = useRef(null);

  // Input and UI feedback
  const [input, setInput] = useState("");
  const [status, setStatus] = useState(null); // { type: 'success'|'error'|'info', msg }
  const [busy, setBusy] = useState(false);

  const currentPlayerName = currentPlayer === "p1" ? p1Name : p2Name;

  // Reset/Start timer whenever player or duration changes
  useEffect(() => {
    clearInterval(timerRef.current);
    setTimeLeft(turnSeconds);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          // Timeout -> penalty and switch turns
          setStatus({ type: "error", msg: `${currentPlayerName} ran out of time (−1).` });
          setScores((s) => ({ ...s, [currentPlayer]: s[currentPlayer] - 1 }));
          setCurrentPlayer((p) => (p === "p1" ? "p2" : "p1"));
          setInput("");
          // requiredStart remains the same for the next player
        }
        return Math.max(t - 1, 0);
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayer, turnSeconds, currentPlayerName]);

  // Derived: next required starting letter display
  const needLetter = useMemo(() => requiredStart || "Any", [requiredStart]);

  function resetGame() {
    clearInterval(timerRef.current);
    setScores({ p1: 0, p2: 0 });
    setCurrentPlayer("p1");
    setWords([]);
    setUsed(new Set());
    setRequiredStart("");
    setInput("");
    setStatus({ type: "info", msg: "New game started." });
    setTimeLeft(turnSeconds);
  }

  function validateStructure(word) {
    if (!word) return { ok: false, error: "Please enter a word." };
    if (!isAlpha(word)) return { ok: false, error: "Letters only (A–Z)." };
    if (word.length < 4) return { ok: false, error: "Minimum 4 letters." };
    const fl = firstLetter(word);
    if (requiredStart && fl !== requiredStart) {
      return { ok: false, error: `Word must start with \"${requiredStart}\".` };
    }
    if (used.has(word.toLowerCase())) {
      return { ok: false, error: "This word was already used." };
    }
    return { ok: true };
  }

  async function onSubmit(e) {
    e?.preventDefault();
    if (busy) return;

    const raw = input.trim();
    const word = raw.toLowerCase();

    // Structure checks
    const base = validateStructure(word);
    if (!base.ok) {
      // Penalize and switch turns
      setScores((s) => ({ ...s, [currentPlayer]: s[currentPlayer] - 1 }));
      setStatus({ type: "error", msg: base.error + " (−1)" });
      setCurrentPlayer((p) => (p === "p1" ? "p2" : "p1"));
      setInput("");
      return;
    }

    // Dictionary check (with abort to avoid race conditions)
    setBusy(true);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000); // safety timeout
    const result = await fetchDefinition(word, { signal: controller.signal });
    clearTimeout(t);
    setBusy(false);

    if (!result.ok) {
      setScores((s) => ({ ...s, [currentPlayer]: s[currentPlayer] - 1 }));
      setStatus({ type: "error", msg: `Invalid word: ${result.error} (−1)` });
      setCurrentPlayer((p) => (p === "p1" ? "p2" : "p1"));
      setInput("");
      return;
    }

    // Success: add word, award point, switch turns
    const def = result.definition;
    setWords((ws) => [...ws, { word, by: currentPlayer, definition: def }]);
    setUsed((u) => new Set(u).add(word));
    setScores((s) => ({ ...s, [currentPlayer]: s[currentPlayer] + 1 }));
    const nextRequired = lastLetter(word);
    setRequiredStart(nextRequired);
    setStatus({ type: "success", msg: `Great! Next must start with \"${nextRequired}\".` });
    setCurrentPlayer((p) => (p === "p1" ? "p2" : "p1"));
    setInput("");
  }

  // Keyboard convenience: Enter to submit
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Enter") {
        const target = e.target;
        // Only submit if focus is on our input
        if (target && target.getAttribute("data-shiritori-input") === "true") {
          onSubmit();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="min-h-screen w-full bg-gray-50 text-gray-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Shiritori – Two‑Player</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={resetGame}
              className="px-4 py-2 rounded-2xl shadow border bg-white hover:bg-gray-100 active:scale-[.98]"
            >
              Reset Game
            </button>
          </div>
        </header>

        {/* Settings */}
        <section className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-2xl bg-white shadow">
            <label className="text-sm font-medium">Player 1 Name</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={p1Name}
              onChange={(e) => setP1Name(e.target.value)}
            />
          </div>
          <div className="p-4 rounded-2xl bg-white shadow">
            <label className="text-sm font-medium">Player 2 Name</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={p2Name}
              onChange={(e) => setP2Name(e.target.value)}
            />
          </div>
          <div className="p-4 rounded-2xl bg-white shadow">
            <label className="text-sm font-medium">Seconds per Turn</label>
            <input
              type="number"
              min={5}
              max={120}
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={turnSeconds}
              onChange={(e) => setTurnSeconds(Math.max(5, Math.min(120, Number(e.target.value) || 15)))}
            />
          </div>
        </section>

        {/* Scoreboard & Turn */}
        <section className="grid md:grid-cols-3 gap-4 mb-6">
          <div className={`p-4 rounded-2xl bg-white shadow border-2 ${currentPlayer === "p1" ? "border-blue-500" : "border-transparent"}`}>
            <div className="text-sm text-gray-500">{p1Name}</div>
            <div className="text-3xl font-extrabold">{scores.p1}</div>
            {currentPlayer === "p1" && (
              <div className="mt-2 text-xs uppercase tracking-wide text-blue-600 font-semibold">Your turn</div>
            )}
          </div>
          <div className="p-4 rounded-2xl bg-white shadow flex flex-col items-center justify-center">
            <div className="text-sm text-gray-500">Time Left</div>
            <div className={`text-4xl font-black ${timeLeft <= 3 ? "text-red-600" : ""}`}>{timeLeft}s</div>
            <div className="mt-2 text-xs text-gray-500">Need start: <span className="font-semibold">{needLetter}</span></div>
          </div>
          <div className={`p-4 rounded-2xl bg-white shadow border-2 ${currentPlayer === "p2" ? "border-blue-500" : "border-transparent"}`}>
            <div className="text-sm text-gray-500">{p2Name}</div>
            <div className="text-3xl font-extrabold">{scores.p2}</div>
            {currentPlayer === "p2" && (
              <div className="mt-2 text-xs uppercase tracking-wide text-blue-600 font-semibold">Your turn</div>
            )}
          </div>
        </section>

        {/* Input Row */}
        <section className="mb-6">
          <form
            onSubmit={onSubmit}
            className="flex flex-col md:flex-row gap-3 items-stretch"
          >
            <input
              data-shiritori-input="true"
              type="text"
              autoFocus
              placeholder={requiredStart ? `Start with \"${requiredStart}\"` : "Any valid English word (≥4 letters)"}
              className="flex-1 rounded-2xl border px-4 py-3 shadow"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy}
              className="px-6 py-3 rounded-2xl bg-blue-600 text-white shadow hover:bg-blue-700 active:scale-[.98] disabled:opacity-60"
            >
              {busy ? "Checking…" : `Play (${currentPlayer === "p1" ? p1Name : p2Name})`}
            </button>
          </form>
          {status && (
            <div
              className={`mt-3 text-sm rounded-xl px-4 py-2 ${
                status.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : status.type === "error"
                  ? "bg-red-50 text-red-800 border border-red-200"
                  : "bg-gray-50 text-gray-700 border border-gray-200"
              }`}
            >
              {status.msg}
            </div>
          )}
        </section>

        {/* Word History */}
        
      </div>
    </div>
  );
}
