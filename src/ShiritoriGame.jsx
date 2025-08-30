import React, { useEffect, useMemo, useRef, useState } from "react";

// ---------- Utility helpers ----------
const isAlpha = (s) => /^[a-zA-Z]+$/.test(s);

async function fetchDefinition(word, { signal } = {}) {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal }
    );
    if (!res.ok) return { ok: false, error: "Not found in dictionary" };
    const data = await res.json();
    const def = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;
    return def ? { ok: true, definition: def } : { ok: false, error: "Definition unavailable" };
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
  const [p1Name] = useState("Player 1");
  const [p2Name] = useState("Player 2");
  const [turnSeconds] = useState(15);

  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [currentPlayer, setCurrentPlayer] = useState("p1");
  const [words, setWords] = useState([]);
  const [used, setUsed] = useState(() => new Set());
  const [requiredStart, setRequiredStart] = useState("");

  const [timeLeft, setTimeLeft] = useState(turnSeconds);
  const timerRef = useRef(null);

  const [input, setInput] = useState("");
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const currentPlayerName = currentPlayer === "p1" ? p1Name : p2Name;
  const needLetter = useMemo(() => requiredStart || "Any", [requiredStart]);

  // Timer logic
  useEffect(() => {
    clearInterval(timerRef.current);
    setTimeLeft(turnSeconds);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setStatus({ type: "error", msg: `${currentPlayerName} ran out of time (−1).` });
          setScores((s) => ({ ...s, [currentPlayer]: s[currentPlayer] - 1 }));
          setCurrentPlayer((p) => (p === "p1" ? "p2" : "p1"));
          setInput("");
        }
        return Math.max(t - 1, 0);
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayer, turnSeconds, currentPlayerName]);

  // Reset Game
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
      return { ok: false, error: `Word must start with "${requiredStart}".` };
    }
    if (used.has(word.toLowerCase())) return { ok: false, error: "This word was already used." };
    return { ok: true };
  }

  async function onSubmit(e) {
    e?.preventDefault();
    if (busy) return;

    const raw = input.trim();
    const word = raw.toLowerCase();

    const base = validateStructure(word);
    if (!base.ok) {
      setScores((s) => ({ ...s, [currentPlayer]: s[currentPlayer] - 1 }));
      setStatus({ type: "error", msg: base.error + " (−1)" });
      setCurrentPlayer((p) => (p === "p1" ? "p2" : "p1"));
      setInput("");
      return;
    }

    setBusy(true);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
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

    const def = result.definition;
    setWords((ws) => [...ws, { word, by: currentPlayer, definition: def }]);
    setUsed((u) => new Set(u).add(word));
    setScores((s) => ({ ...s, [currentPlayer]: s[currentPlayer] + 1 }));
    const nextRequired = lastLetter(word);
    setRequiredStart(nextRequired);
    setStatus({ type: "success", msg: `Great! Next must start with "${nextRequired}".` });
    setCurrentPlayer((p) => (p === "p1" ? "p2" : "p1"));
    setInput("");
  }

  // Enter key handling
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Enter") {
        const target = e.target;
        if (target && target.getAttribute("data-shiritori-input") === "true") {
          onSubmit();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-10 flex justify-center items-start">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-xl p-6 md:p-10 flex flex-col gap-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Shiritori – Two Player</h1>
          <button
            onClick={resetGame}
            className="px-5 py-2 rounded-2xl shadow bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
          >
            Reset
          </button>
        </div>

        {/* Players & Timer */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className={`flex-1 p-4 rounded-2xl shadow text-center ${currentPlayer === "p1" ? "border-4 border-blue-500" : "border"}`}>
            <div className="text-lg font-semibold">{p1Name}</div>
            <div className="text-4xl font-bold mt-2">{scores.p1}</div>
            {currentPlayer === "p1" && <div className="mt-2 text-blue-600 uppercase font-semibold">Your Turn</div>}
          </div>

          <div className="flex-1 p-4 rounded-2xl shadow text-center">
            <div className="text-lg text-gray-500">Next Letter</div>
            <div className="text-4xl font-black mt-2">{needLetter}</div>
            <div className={`text-5xl font-black mt-2 ${timeLeft <= 3 ? "text-red-500" : ""}`}>{timeLeft}s</div>
          </div>

          <div className={`flex-1 p-4 rounded-2xl shadow text-center ${currentPlayer === "p2" ? "border-4 border-blue-500" : "border"}`}>
            <div className="text-lg font-semibold">{p2Name}</div>
            <div className="text-4xl font-bold mt-2">{scores.p2}</div>
            {currentPlayer === "p2" && <div className="mt-2 text-blue-600 uppercase font-semibold">Your Turn</div>}
          </div>
        </div>

        {/* Input */}
        <form className="flex flex-col md:flex-row gap-3 mt-6" onSubmit={onSubmit}>
          <input
            data-shiritori-input="true"
            type="text"
            autoFocus
            placeholder={requiredStart ? `Start with "${requiredStart}"` : "Any word ≥ 4 letters"}
            className="flex-1 rounded-xl border px-4 py-3 text-lg shadow focus:ring-2 focus:ring-blue-400"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl text-lg shadow hover:bg-blue-700 active:scale-95 disabled:opacity-60"
          >
            {busy ? "Checking..." : `Play`}
          </button>
        </form>

        {status && (
          <div className={`mt-3 text-sm rounded-xl px-4 py-2 ${
            status.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : status.type === "error"
              ? "bg-red-50 text-red-800 border border-red-200"
              : "bg-gray-50 text-gray-700 border border-gray-200"
          }`}>
            {status.msg}
          </div>
        )}

        {/* Word History */}
        <div className="mt-6 bg-gray-50 rounded-xl p-4 max-h-60 overflow-y-auto shadow">
          <h2 className="font-semibold mb-2">Word History</h2>
          <ul className="space-y-1">
            {words.map((w, i) => (
              <li key={i} className="flex justify-between">
                <span className="capitalize">{w.word}</span>
                <span className={`text-sm ${w.by === "p1" ? "text-blue-500" : "text-green-500"}`}>
                  {w.by === "p1" ? p1Name : p2Name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
