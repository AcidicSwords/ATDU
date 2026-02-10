import { useState, useEffect, useCallback, useMemo } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

/* ═══════════════════════════════════════════════════
DESIGN TOKENS
═══════════════════════════════════════════════════ */

const COLOR = {
  paper: "#f5f0e8",
  ink: "#2c2416",
  inkL: "#6b5d4d",
  green: "#2d6a4f",
  red: "#9b2226",
  gold: "#b68d40",
  goldFade: "rgba(182,141,64,0.15)",
  border: "#d4c9b8",
  borderL: "#e8e0d2",
  white: "#ffffff",
};

const FONT = {
  serif: "'Crimson Pro', Georgia, serif",
  sans: "'Source Sans 3', 'Helvetica Neue', sans-serif",
};

const CATEGORIES = ["Habit", "Contested", "Planned Not Taken"];
const CAT_COLORS = { Habit: COLOR.inkL, Contested: COLOR.gold, "Planned Not Taken": COLOR.red };
const SKEY = { wagers: "atdu-w", ledger: "atdu-l", today: "atdu-t" };

const S = {
  h2: { fontFamily: FONT.serif, fontSize: 24, fontWeight: 600, margin: "32px 0 16px", color: COLOR.ink },
  h3: { fontFamily: FONT.serif, fontSize: 19, fontWeight: 600, margin: "24px 0 12px", color: COLOR.ink },
  p: { fontSize: 15, lineHeight: 1.7, margin: "0 0 14px", color: COLOR.ink },
  muted: { fontSize: 14, lineHeight: 1.7, color: COLOR.inkL },
  tag: {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "3px 8px",
    borderRadius: 3,
  },
  card: { background: COLOR.white, border: `1px solid ${COLOR.border}`, borderRadius: 8, padding: 24, marginBottom: 20 },
  btn: {
    fontFamily: FONT.sans,
    fontSize: 14,
    fontWeight: 600,
    padding: "10px 20px",
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  input: {
    fontFamily: FONT.sans,
    fontSize: 14,
    padding: "8px 12px",
    border: `1px solid ${COLOR.border}`,
    borderRadius: 5,
    background: COLOR.white,
    color: COLOR.ink,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: COLOR.inkL,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    display: "block",
    marginBottom: 4,
  },
};

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=Source+Sans+3:wght@400;600;700&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { min-height: 100%; }
body { background: #f5f0e8; color: #2c2416; }
button, input { font: inherit; }
input:focus { border-color: ${COLOR.gold} !important; box-shadow: 0 0 0 2px ${COLOR.gold}30; }
::selection { background: ${COLOR.goldFade}; }
table tr:last-child { border-bottom: none !important; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
`;

/* ═══════════════════════════════════════════════════
HELPERS (rules + formatting)
═══════════════════════════════════════════════════ */

const DISP_MINUS = "−"; // display only
const OUT = { PLUS: "+", MINUS: "-" }; // internal

function normalizeCode(code) {
  return (code || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 2);
}

function invertOutcome(o) {
  return o === OUT.PLUS ? OUT.MINUS : OUT.PLUS;
}

function normalizeOutcome(o) {
  if (o === OUT.PLUS || o === OUT.MINUS) return o;
  if (o === DISP_MINUS) return OUT.MINUS;
  return o;
}

function fmtOutcome(o) {
  const n = normalizeOutcome(o);
  return n === OUT.MINUS ? DISP_MINUS : "+";
}

function getWagerTooltip(w) {
  // Keep it strictly structural + reduce "inaction" misread.
  // Both are do-assertions: DO X / DO NOT X.
  const plus = (w.plus || "").trim();
  const minus = (w.minus || "").trim();
  return [
    `WAGER: ${w.name} (${w.code})`,
    `+ : DO ${plus}`,
    `- : DO NOT ${plus}${minus ? ` (label: ${minus})` : ""}`,
    `Mode: U = you choose · C = coin assigns`,
    `C inversion: inverse of last entry OR inverse of last constrained entry`,
  ].join("\n");
}

/* ═══════════════════════════════════════════════════
ESTABLISH TAB
═══════════════════════════════════════════════════ */

function EstablishTab() {
  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div style={{ borderLeft: `3px solid ${COLOR.gold}`, paddingLeft: 20, margin: "24px 0 36px" }}>
        <p style={{ ...S.p, fontSize: 16, fontStyle: "italic", color: COLOR.inkL }}>
          Agency Through Deterministic Uncertainty (ATDU) is a daily procedure that uses two coin flips, binary wagers,
          and a ledger. It produces one entry per day per wager: a mode (U or C) and an outcome (+ or −).
        </p>
      </div>

      <h2 style={S.h2}>The Three Components</h2>
      <div style={{ display: "grid", gap: 16 }}>
        {[
          {
            name: "The Wager",
            color: COLOR.gold,
            text:
              "A wager is a named binary with two mutually exclusive inverses: + and −. " +
              "+ and − are both deliberate assertions: + = DO X, − = DO NOT X. " +
              "Before practice, classify each wager as Habit, Contested, or Planned Not Taken.",
          },
          {
            name: "The Coins",
            color: COLOR.green,
            text:
              "Two flips are used. Flip 1 selects mode: Heads = Unconstrained (U), Tails = Constrained (C). " +
              "If C, Flip 2 selects the inversion rule: Heads = inverse of last entry (any mode), " +
              "Tails = inverse of last constrained entry (C only).",
          },
          {
            name: "The Ledger",
            color: COLOR.red,
            text:
              "A ledger is a daily record. Each cell stores mode (U or C) and uses color for outcome (+ green, − red). " +
              "No explanations are recorded. The ledger is effects-only.",
          },
        ].map(({ name, color, text }) => (
          <div key={name} style={{ ...S.card, borderLeft: `3px solid ${color}` }}>
            <h3 style={{ ...S.h3, margin: "0 0 8px", color }}>{name}</h3>
            <p style={{ ...S.p, margin: 0 }}>{text}</p>
          </div>
        ))}
      </div>

      <h2 style={S.h2}>Daily Procedure</h2>
      <div style={{ ...S.card, background: COLOR.goldFade, border: `1px solid ${COLOR.gold}40` }}>
        <div style={{ display: "grid", gap: 20 }}>
          {[
            "For each wager, perform Flip 1 (mode).",
            "Heads = U (you choose). Tails = C (coin assigns).",
            "On U: choose + or − during the day. Record what occurred at day-end.",
            "On C: perform Flip 2 (rule). Heads = inverse of last entry. Tails = inverse of last constrained entry. If no reference exists, category default applies.",
            "Record one cell per wager: mode letter (U/C) colored by outcome (+ green, − red).",
          ].map((text, i) => (
            <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span
                style={{
                  fontFamily: FONT.serif,
                  fontSize: 22,
                  fontWeight: 700,
                  color: COLOR.gold,
                  minWidth: 28,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <p style={{ ...S.p, margin: 0 }}>{text}</p>
            </div>
          ))}
        </div>
      </div>

      <h2 style={S.h2}>Wager Classification</h2>
      <p style={S.p}>Classification is descriptive. It is used only for the first constrained default when no prior reference exists.</p>
      <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
        {[
          { label: "Habit", color: COLOR.inkL, desc: "One side occurs repeatedly; a rationale is typically assigned after the fact. First constrained default: +." },
          { label: "Contested", color: COLOR.gold, desc: "Both sides occur at different times; both are justified in context. First constrained default: +." },
          { label: "Planned Not Taken", color: COLOR.red, desc: "There are reasons for +; when − occurs, there is an explanation that justifies 'later'. First constrained default: −." },
        ].map(({ label, color, desc }) => (
          <div key={label} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 0" }}>
            <span style={{ ...S.tag, background: `${color}18`, color, minWidth: 160, textAlign: "center", flexShrink: 0 }}>
              {label}
            </span>
            <p style={{ ...S.p, margin: 0, fontSize: 14 }}>{desc}</p>
          </div>
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${COLOR.border}`, marginTop: 36, paddingTop: 20 }}>
        <p style={{ ...S.muted, fontStyle: "italic", textAlign: "center" }}>Switch to Practice to begin recording.</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
PRACTICE TAB
═══════════════════════════════════════════════════ */

function PracticeTab() {
  const [wagers, setWagers] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [setupMode, setSetupMode] = useState(true);
  const [drafts, setDrafts] = useState([{ code: "", name: "", plus: "", minus: "", category: "Habit" }]);
  const [todayState, setTodayState] = useState(null);
  const [flipAnim, setFlipAnim] = useState(false);
  const [addingWager, setAddingWager] = useState(false);
  const [newWager, setNewWager] = useState({ code: "", name: "", plus: "", minus: "", category: "Habit" });

  /* ── Storage ── */
  useEffect(() => {
    (async () => {
      try {
        const w = await window.storage.get(SKEY.wagers);
        if (w?.value) {
          setWagers(JSON.parse(w.value));
          setSetupMode(false);
        }
      } catch {}
      try {
        const l = await window.storage.get(SKEY.ledger);
        if (l?.value) setLedger(JSON.parse(l.value));
      } catch {}
      try {
        const t = await window.storage.get(SKEY.today);
        if (t?.value) {
          const parsed = JSON.parse(t.value);
          setTodayState(parsed?.day ? parsed : null);
        }
      } catch {}
    })();
  }, []);

  const saveW = useCallback(async (w) => {
    setWagers(w);
    try {
      await window.storage.set(SKEY.wagers, JSON.stringify(w));
    } catch {}
  }, []);

  const saveL = useCallback(async (l) => {
    setLedger(l);
    try {
      await window.storage.set(SKEY.ledger, JSON.stringify(l));
    } catch {}
  }, []);

  const saveToday = useCallback(async (t) => {
    setTodayState(t);
    try {
      if (t) {
        await window.storage.set(SKEY.today, JSON.stringify(t));
      } else {
        await window.storage.delete(SKEY.today);
      }
    } catch {}
  }, []);

  /* ── Active wagers (exclude soft-deleted) ── */
  const activeWagers = wagers ? wagers.filter((w) => !w.removed) : [];

  /* All wager codes that appear anywhere in the ledger */
  const ledgerCodes = useMemo(() => {
    const codes = new Set();
    ledger.forEach((day) => {
      Object.keys(day).forEach((k) => {
        if (k !== "day") codes.add(k);
      });
    });
    return codes;
  }, [ledger]);

  /* All wagers for ledger display: active + removed-but-in-ledger */
  const ledgerWagers = wagers ? wagers.filter((w) => !w.removed || ledgerCodes.has(w.code)) : [];

  /* ── Ledger lookups ── */
  const getLastEntry = useCallback(
    (code) => {
      for (let i = ledger.length - 1; i >= 0; i--) {
        if (ledger[i][code]) return ledger[i][code];
      }
      return null;
    },
    [ledger]
  );

  const getLastC = useCallback(
    (code) => {
      for (let i = ledger.length - 1; i >= 0; i--) {
        if (ledger[i][code]?.mode === "C") return ledger[i][code];
      }
      return null;
    },
    [ledger]
  );

  /* ── First-constrained default by category ──
     Habit → +
     Contested → +
     Planned Not Taken → - */
  const categoryDefault = (w) => (w.category === "Planned Not Taken" ? OUT.MINUS : OUT.PLUS);

  /* ── Drafts ── */
  const updateDraft = (i, field, value) =>
    setDrafts((prev) => prev.map((d, j) => (j === i ? { ...d, [field]: value } : d)));

  const finishSetup = () => {
    const valid = drafts
      .map((d) => ({
        ...d,
        code: normalizeCode(d.code),
      }))
      .filter((d) => d.code && d.name && d.plus && d.minus);
    if (new Set(valid.map((d) => d.code)).size !== valid.length) return;
    if (!valid.length) return;
    saveW(valid);
    setSetupMode(false);
  };

  /* ── Flip ── */
  const buildFlippedDay = useCallback(() => {
    const state = {};
    activeWagers.forEach((w) => {
      const flip1Heads = Math.random() < 0.5;
      if (flip1Heads) {
        state[w.code] = { mode: "U", outcome: null };
      } else {
        const flip2Heads = Math.random() < 0.5;
        const invType = flip2Heads ? "last" : "lastC";
        const ref = invType === "last" ? getLastEntry(w.code) : getLastC(w.code);
        const refOutcome = ref ? normalizeOutcome(ref.outcome) : null;
        const outcome = refOutcome ? invertOutcome(refOutcome) : categoryDefault(w);
        state[w.code] = { mode: "C", outcome, invType };
      }
    });
    return state;
  }, [activeWagers, getLastC, getLastEntry]);

  const toLedgerEntry = useCallback(
    (dayState) => {
      const entry = { day: dayState.day };
      activeWagers.forEach((w) => {
        const ts = dayState[w.code];
        if (!ts) return;
        entry[w.code] = { mode: ts.mode, outcome: normalizeOutcome(ts.outcome) };
        if (ts.mode === "C" && ts.invType) entry[w.code].inv = ts.invType;
      });
      return entry;
    },
    [activeWagers]
  );

  const flipAll = () => {
    const canAdvanceDay = !todayState || activeWagers.every((w) => todayState[w.code]?.outcome);
    if (!canAdvanceDay) return;

    setFlipAnim(true);

    setTimeout(() => {
      const nextDay = (todayState?.day || ledger.length) + 1;
      const nextState = { ...buildFlippedDay(), day: nextDay };
      const nextEntry = toLedgerEntry(nextState);
      saveL([...ledger, nextEntry]);
      saveToday(nextState);
      setFlipAnim(false);
    }, 500);
  };

  const setOutcome = (code, val) => {
    const nextState = {
      ...todayState,
      [code]: { ...todayState[code], outcome: normalizeOutcome(val) },
    };

    saveToday(nextState);

    const nextEntry = toLedgerEntry(nextState);
    const hasDay = ledger.some((d) => d.day === nextEntry.day);
    saveL(hasDay ? ledger.map((d) => (d.day === nextEntry.day ? nextEntry : d)) : [...ledger, nextEntry]);
  };

  /* ── Add/Remove wagers mid-practice ── */
  const addWager = () => {
    const cleaned = {
      ...newWager,
      code: normalizeCode(newWager.code),
    };
    if (!cleaned.code || !cleaned.name || !cleaned.plus || !cleaned.minus) return;
    if (wagers.some((w) => w.code === cleaned.code && !w.removed)) return;

    const existing = wagers.findIndex((w) => w.code === cleaned.code && w.removed);
    let updated;
    if (existing >= 0) {
      updated = wagers.map((w, i) => (i === existing ? { ...cleaned, removed: false } : w));
    } else {
      updated = [...wagers, { ...cleaned }];
    }
    saveW(updated);
    setNewWager({ code: "", name: "", plus: "", minus: "", category: "Habit" });
    setAddingWager(false);
  };

  const removeWager = (code) => {
    saveW(wagers.map((w) => (w.code === code ? { ...w, removed: true } : w)));
    if (todayState?.[code]) {
      const nextDayState = { ...todayState };
      delete nextDayState[code];
      saveToday(Object.keys(nextDayState).length ? nextDayState : null);
    }
  };

  const resetAll = async () => {
    setWagers(null);
    setLedger([]);
    setSetupMode(true);
    await saveToday(null);
    setAddingWager(false);
    setDrafts([{ code: "", name: "", plus: "", minus: "", category: "Habit" }]);
    try {
      await window.storage.delete(SKEY.wagers);
    } catch {}
    try {
      await window.storage.delete(SKEY.ledger);
    } catch {}
  };

  /* ── Setup View ── */
  if (setupMode || !wagers) {
    return (
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <h2 style={S.h2}>Define Wagers</h2>
        <p style={S.muted}>
          Each wager needs a code (1-2 letters), a name, a + label, a − label, and a classification.
          + and − are mutually exclusive inverses: + = DO X, − = DO NOT X.
        </p>

        <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
          {drafts.map((d, i) => (
            <div key={i} style={{ ...S.card, padding: 16 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 60, flexShrink: 0 }}>
                  <label style={S.label}>Code</label>
                  <input
                    style={{ ...S.input, textTransform: "uppercase", fontWeight: 700, textAlign: "center" }}
                    maxLength={2}
                    value={d.code}
                    onChange={(e) => updateDraft(i, "code", normalizeCode(e.target.value))}
                    placeholder="W"
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={S.label}>Name</label>
                  <input style={S.input} value={d.name} onChange={(e) => updateDraft(i, "name", e.target.value)} placeholder="Example" />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ ...S.label, color: COLOR.green }}>+ Side (DO X)</label>
                  <input
                    style={{ ...S.input, borderColor: `${COLOR.green}40` }}
                    value={d.plus}
                    onChange={(e) => updateDraft(i, "plus", e.target.value)}
                    placeholder="Do X"
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ ...S.label, color: COLOR.red }}>− Side (DO NOT X)</label>
                  <input
                    style={{ ...S.input, borderColor: `${COLOR.red}40` }}
                    value={d.minus}
                    onChange={(e) => updateDraft(i, "minus", e.target.value)}
                    placeholder="Do not X (or an explicit inverse action)"
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => updateDraft(i, "category", cat)}
                    style={{
                      ...S.tag,
                      cursor: "pointer",
                      background: d.category === cat ? `${CAT_COLORS[cat]}20` : "transparent",
                      color: d.category === cat ? CAT_COLORS[cat] : COLOR.inkL,
                      border: `1px solid ${d.category === cat ? CAT_COLORS[cat] : COLOR.border}`,
                    }}
                  >
                    {cat}
                  </button>
                ))}
                {drafts.length > 1 && (
                  <button
                    onClick={() => setDrafts((p) => p.filter((_, j) => j !== i))}
                    style={{ marginLeft: "auto", background: "none", border: "none", color: COLOR.inkL, cursor: "pointer", fontSize: 18 }}
                    aria-label="Remove wager"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button
            onClick={() => setDrafts((p) => [...p, { code: "", name: "", plus: "", minus: "", category: "Habit" }])}
            style={{ ...S.btn, background: "transparent", border: `1px solid ${COLOR.border}`, color: COLOR.inkL }}
          >
            + Add Wager
          </button>
          <button onClick={finishSetup} style={{ ...S.btn, background: COLOR.ink, color: COLOR.paper }}>
            Begin Practice
          </button>
        </div>
      </div>
    );
  }

  /* ── Active Practice View ── */
  const allFilled = todayState && activeWagers.every((w) => todayState[w.code]?.outcome);
  const dayNumber = todayState?.day || ledger.length + 1;

  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      {/* Flip Card */}
      <div style={{ ...S.card, textAlign: "center", marginTop: 24 }}>
        {!todayState ? (
          <div>
            <p style={{ ...S.muted, margin: "0 0 16px" }}>{`Day ${dayNumber} — ready to flip.`}</p>
            <button
              onClick={flipAll}
              style={{ ...S.btn, background: COLOR.ink, color: COLOR.paper, fontSize: 16, padding: "14px 36px" }}
            >
              {flipAnim ? "Flipping..." : "Flip"}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ ...S.muted, margin: "0 0 8px" }}>Day {dayNumber}</p>
            <p style={{ ...S.muted, margin: "0 0 20px", fontSize: 12 }}>
              Flip results are already recorded for today (U/C and all constrained outcomes). Fill U outcomes before the next flip.
            </p>

            <div style={{ display: "grid", gap: 10, textAlign: "left" }}>
              {activeWagers.map((w) => {
                const ts = todayState[w.code];
                if (!ts) return null;

                const isC = ts.mode === "C";
                const o = normalizeOutcome(ts.outcome);
                const oc = o === OUT.PLUS ? COLOR.green : o === OUT.MINUS ? COLOR.red : COLOR.inkL;

                return (
                  <div key={w.code} style={{ padding: "12px 14px", borderRadius: 6, background: COLOR.white, border: `1px solid ${COLOR.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <span
                        style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 18, color: COLOR.ink, minWidth: 32 }}
                        title={getWagerTooltip(w)}
                      >
                        {w.code}
                      </span>

                      <span style={{ ...S.tag, background: isC ? `${COLOR.ink}12` : `${COLOR.gold}20`, color: isC ? COLOR.ink : COLOR.gold }}>
                        {ts.mode}
                      </span>

                      {isC && (
                        <span style={{ fontSize: 11, color: COLOR.inkL, fontStyle: "italic" }}>
                          {ts.invType === "last" ? "inverse of last entry" : "inverse of last constrained"}
                        </span>
                      )}

                      <span style={{ fontSize: 13, color: COLOR.inkL, flex: 1, minWidth: 60 }}>{w.name}</span>

                      {isC ? (
                        <span style={{ fontWeight: 700, fontSize: 18, color: oc }}>{fmtOutcome(o)}</span>
                      ) : (
                        <div style={{ display: "flex", gap: 6 }}>
                          {[OUT.PLUS, OUT.MINUS].map((val) => {
                            const c = val === OUT.PLUS ? COLOR.green : COLOR.red;
                            const active = normalizeOutcome(ts.outcome) === val;
                            return (
                              <button
                                key={val}
                                onClick={() => setOutcome(w.code, val)}
                                style={{
                                  ...S.btn,
                                  padding: "6px 16px",
                                  fontSize: 15,
                                  fontWeight: 700,
                                  background: active ? c : "transparent",
                                  color: active ? "#fff" : c,
                                  border: `1.5px solid ${c}`,
                                }}
                                title={val === OUT.PLUS ? `+ : DO ${w.plus}` : `− : DO NOT ${w.plus}`}
                              >
                                {val === OUT.MINUS ? DISP_MINUS : "+"}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 20 }}>
              <button
                onClick={flipAll}
                disabled={!allFilled || flipAnim}
                style={{
                  ...S.btn,
                  fontSize: 15,
                  padding: "12px 32px",
                  background: allFilled ? COLOR.ink : COLOR.border,
                  color: COLOR.paper,
                  opacity: allFilled ? 1 : 0.6,
                  cursor: allFilled ? "pointer" : "default",
                }}
              >
                {flipAnim ? "Flipping..." : "Flip Next Day"}
              </button>
              {!allFilled && <p style={{ ...S.muted, marginTop: 10, marginBottom: 0 }}>Fill all U outcomes before flipping the next day.</p>}
            </div>
          </div>
        )}
      </div>

      {/* Ledger */}
      {ledger.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ ...S.h3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            Ledger
            <span style={{ fontSize: 13, fontWeight: 400, color: COLOR.inkL }}>
              {ledger.length} day{ledger.length !== 1 ? "s" : ""}
            </span>
          </h3>

          <div style={{ ...S.card, overflowX: "auto", padding: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT.sans, fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ padding: "6px 10px", borderBottom: `2px solid ${COLOR.ink}`, textAlign: "left", fontWeight: 700, fontSize: 12 }} />
                  {ledgerWagers.map((w) => (
                    <th
                      key={w.code}
                      style={{
                        padding: "6px 10px",
                        borderBottom: `2px solid ${COLOR.ink}`,
                        textAlign: "center",
                        fontWeight: 700,
                        fontSize: 14,
                        fontFamily: FONT.serif,
                        color: w.removed ? COLOR.inkL : COLOR.ink,
                        opacity: w.removed ? 0.5 : 1,
                      }}
                      title={getWagerTooltip(w)}
                    >
                      {w.code}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {ledger.map((day, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${COLOR.borderL}` }}>
                    <td style={{ padding: "6px 10px", fontWeight: 600, fontSize: 13, color: COLOR.inkL }}>
                      {String(day.day).padStart(2, "0")}
                    </td>

                    {ledgerWagers.map((w) => {
                      const e = day[w.code];
                      if (!e) return <td key={w.code} style={{ textAlign: "center", padding: 6, color: COLOR.borderL }}>—</td>;

                      const o = normalizeOutcome(e.outcome);
                      return (
                        <td key={w.code} style={{ textAlign: "center", padding: 6 }}>
                          <span
                            style={{
                              fontFamily: FONT.serif,
                              fontWeight: 700,
                              fontSize: 17,
                              color: o === OUT.PLUS ? COLOR.green : COLOR.red,
                              opacity: e.mode === "C" ? 0.5 : 1,
                            }}
                            title={e.mode === "C" && e.inv ? `C (${e.inv === "last" ? "inverse of last entry" : "inverse of last constrained"})` : e.mode}
                          >
                            {e.mode}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 12, display: "flex", gap: 16, justifyContent: "center", fontSize: 12, flexWrap: "wrap" }}>
              <span>
                <span style={{ display: "inline-block", width: 8, height: 8, background: COLOR.green, borderRadius: 1, marginRight: 4, verticalAlign: "middle" }} />
                <span style={{ color: COLOR.green }}>+</span>
              </span>
              <span>
                <span style={{ display: "inline-block", width: 8, height: 8, background: COLOR.red, borderRadius: 1, marginRight: 4, verticalAlign: "middle" }} />
                <span style={{ color: COLOR.red }}>{DISP_MINUS}</span>
              </span>
              <span style={{ color: COLOR.inkL }}>bright = U · faded = C</span>
            </div>
          </div>
        </div>
      )}

      {/* Add Wager Panel */}
      {addingWager && (
        <div style={{ ...S.card, padding: 16, borderLeft: `3px solid ${COLOR.gold}` }}>
          <h3 style={{ ...S.h3, margin: "0 0 12px", fontSize: 16 }}>Add Wager</h3>

          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 60, flexShrink: 0 }}>
              <label style={S.label}>Code</label>
              <input
                style={{ ...S.input, textTransform: "uppercase", fontWeight: 700, textAlign: "center" }}
                maxLength={2}
                value={newWager.code}
                onChange={(e) => setNewWager((p) => ({ ...p, code: normalizeCode(e.target.value) }))}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={S.label}>Name</label>
              <input style={S.input} value={newWager.name} onChange={(e) => setNewWager((p) => ({ ...p, name: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ ...S.label, color: COLOR.green }}>+ Side (DO X)</label>
              <input
                style={{ ...S.input, borderColor: `${COLOR.green}40` }}
                value={newWager.plus}
                onChange={(e) => setNewWager((p) => ({ ...p, plus: e.target.value }))}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ ...S.label, color: COLOR.red }}>− Side (DO NOT X)</label>
              <input
                style={{ ...S.input, borderColor: `${COLOR.red}40` }}
                value={newWager.minus}
                onChange={(e) => setNewWager((p) => ({ ...p, minus: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setNewWager((p) => ({ ...p, category: cat }))}
                style={{
                  ...S.tag,
                  cursor: "pointer",
                  background: newWager.category === cat ? `${CAT_COLORS[cat]}20` : "transparent",
                  color: newWager.category === cat ? CAT_COLORS[cat] : COLOR.inkL,
                  border: `1px solid ${newWager.category === cat ? CAT_COLORS[cat] : COLOR.border}`,
                }}
              >
                {cat}
              </button>
            ))}

            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button
                onClick={() => setAddingWager(false)}
                style={{ ...S.btn, background: "transparent", color: COLOR.inkL, border: `1px solid ${COLOR.border}`, fontSize: 12, padding: "6px 14px" }}
              >
                Cancel
              </button>
              <button onClick={addWager} style={{ ...S.btn, background: COLOR.ink, color: COLOR.paper, fontSize: 12, padding: "6px 14px" }}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Wagers List + Remove */}
      {!addingWager && (
        <div style={{ ...S.card, padding: 16 }}>
          <h3 style={{ ...S.h3, margin: "0 0 12px", fontSize: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            Wagers
            <button
              onClick={() => setAddingWager(true)}
              style={{ ...S.btn, background: "transparent", color: COLOR.gold, border: `1px solid ${COLOR.gold}40`, fontSize: 12, padding: "4px 12px" }}
            >
              + Add
            </button>
          </h3>

          <div style={{ display: "grid", gap: 6 }}>
            {activeWagers.map((w) => (
              <div key={w.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 4, background: `${COLOR.ink}04` }}>
                <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 15, color: COLOR.ink, minWidth: 28 }} title={getWagerTooltip(w)}>
                  {w.code}
                </span>
                <span style={{ fontSize: 13, color: COLOR.inkL, flex: 1 }}>{w.name}</span>
                <span style={{ ...S.tag, background: `${CAT_COLORS[w.category]}12`, color: CAT_COLORS[w.category], fontSize: 9 }}>{w.category}</span>
                {activeWagers.length > 1 && (
                  <button
                    onClick={() => removeWager(w.code)}
                    style={{ background: "none", border: "none", color: COLOR.inkL, cursor: "pointer", fontSize: 15, padding: "0 4px", opacity: 0.6 }}
                    title="Remove wager"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 20, paddingBottom: 20 }}>
        <button onClick={resetAll} style={{ ...S.btn, background: "transparent", color: COLOR.red, border: `1px solid ${COLOR.red}40`, fontSize: 12 }}>
          Reset All
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
SIMULATION ENGINE + EXTEND TAB
═══════════════════════════════════════════════════ */

const SIM_PROFILES = [
  { key: "u100", name: "100% +", bias: 1.0, note: "Always choose + on U" },
  { key: "u75", name: "75% +", bias: 0.75, note: "Usually choose + on U" },
  { key: "u50", name: "50/50", bias: 0.5, note: "No preference on U" },
  { key: "u25", name: "25% +", bias: 0.25, note: "Usually choose − on U" },
  { key: "u0", name: "0% +", bias: 0.0, note: "Always choose − on U" },
];

const SIM_COLORS = ["#2d6a4f", "#6a994e", "#b68d40", "#c1444a", "#9b2226"];

function simulate(bias, nDays) {
  const entries = [];
  let lastE = null,
    lastCE = null,
    plusCount = 0;

  for (let d = 0; d < nDays; d++) {
    const mode = Math.random() < 0.5 ? "U" : "C";
    let outcome = null;
    let invType = null;

    if (mode === "U") {
      outcome = Math.random() < bias ? OUT.PLUS : OUT.MINUS;
    } else {
      const flip2Heads = Math.random() < 0.5;
      invType = flip2Heads ? "last" : "lastC";

      if (invType === "last") {
        outcome = lastE ? invertOutcome(lastE) : OUT.PLUS;
      } else {
        outcome = lastCE ? invertOutcome(lastCE) : OUT.PLUS;
      }
    }

    lastE = outcome;
    if (mode === "C") lastCE = outcome;
    if (outcome === OUT.PLUS) plusCount++;

    entries.push({
      day: d + 1,
      mode,
      outcome,
      invType,
      cumRatio: plusCount / (d + 1),
    });
  }

  return entries;
}

function SequenceStrip({ entries, label, color }) {
  return (
    <div style={{ marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 13, color, minWidth: 52, flexShrink: 0 }}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {entries.map((e, i) => (
          <div
            key={i}
            title={`Day ${e.day}: ${e.mode}${fmtOutcome(e.outcome)}${e.mode === "C" && e.invType ? ` (${e.invType})` : ""}`}
            style={{
              width: 6,
              height: 6,
              borderRadius: 1,
              background: e.outcome === OUT.PLUS ? COLOR.green : COLOR.red,
              opacity: e.mode === "C" ? 0.5 : 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ExtendTab() {
  const [seed, setSeed] = useState(0);
  const [running, setRunning] = useState(false);

  const results = useMemo(() => {
    if (seed === 0) return null;
    const r = {};
    SIM_PROFILES.forEach((p) => {
      r[p.key] = simulate(p.bias, 365);
    });
    return r;
  }, [seed]);

  const run = () => {
    setRunning(true);
    setTimeout(() => {
      setSeed((s) => s + 1);
      setRunning(false);
    }, 50);
  };

  const convergence = useMemo(() => {
    if (!results) return null;
    return Array.from({ length: 365 }, (_, d) => {
      const pt = { day: d + 1 };
      SIM_PROFILES.forEach((p) => {
        pt[p.key] = results[p.key][d].cumRatio;
      });
      return pt;
    });
  }, [results]);

  const finals = useMemo(() => {
    if (!results) return null;
    return SIM_PROFILES.map((p, i) => {
      const entries = results[p.key];
      const last = entries[entries.length - 1];
      const cDays = entries.filter((e) => e.mode === "C").length;
      let maxRun = 0,
        curRun = 0,
        prev = null;

      entries.forEach((e) => {
        if (e.outcome === prev) curRun++;
        else {
          curRun = 1;
          prev = e.outcome;
        }
        if (curRun > maxRun) maxRun = curRun;
      });

      return { ...p, color: SIM_COLORS[i], finalRatio: last.cumRatio, cDays, longestRun: maxRun };
    });
  }, [results]);

  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      <div style={{ borderLeft: `3px solid ${COLOR.gold}`, paddingLeft: 20, margin: "24px 0 28px" }}>
        <p style={{ ...S.muted, fontStyle: "italic" }}>
          Five simulated agents run one wager for one year with the same coin rules. The only difference is how each agent chooses on U days.
        </p>
      </div>

      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <button
          onClick={run}
          disabled={running}
          style={{
            ...S.btn,
            background: COLOR.ink,
            color: COLOR.paper,
            fontSize: 16,
            padding: "14px 48px",
            opacity: running ? 0.6 : 1,
          }}
        >
          {running ? "Simulating..." : results ? "Run Again" : "Simulate One Year"}
        </button>
      </div>

      {results && finals && (
        <>
          <div style={{ ...S.card, padding: "20px 20px 16px" }}>
            <h3 style={{ ...S.h3, margin: "0 0 4px" }}>The Year</h3>
            <p style={{ fontSize: 12, color: COLOR.inkL, margin: "0 0 14px" }}>
              Each row is 365 days. Color = outcome (+ green, − red). Opacity = mode (bright U, faded C).
            </p>
            {SIM_PROFILES.map((p, i) => (
              <SequenceStrip key={p.key} entries={results[p.key]} label={p.name} color={SIM_COLORS[i]} />
            ))}
          </div>

          <div style={{ ...S.card, padding: 20 }}>
            <h3 style={{ ...S.h3, margin: "0 0 4px" }}>First 30 Days</h3>
            <p style={{ fontSize: 12, color: COLOR.inkL, margin: "0 0 16px" }}>Each cell is one day. Hover for details.</p>

            {SIM_PROFILES.map((p, i) => (
              <div key={p.key} style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 13, color: SIM_COLORS[i], marginBottom: 4 }}>
                  {p.name}
                </div>
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  {results[p.key].slice(0, 30).map((e, j) => (
                    <div
                      key={j}
                      title={`Day ${e.day}: ${e.mode}${fmtOutcome(e.outcome)}${e.invType ? ` (${e.invType})` : ""}`}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 3,
                        background: e.outcome === OUT.PLUS ? COLOR.green : COLOR.red,
                        opacity: e.mode === "C" ? 0.45 : 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        color: COLOR.white,
                        fontFamily: FONT.serif,
                      }}
                    >
                      {e.mode}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...S.card, padding: 20 }}>
            <h3 style={{ ...S.h3, margin: "0 0 4px" }}>Running + Ratio</h3>
            <p style={{ fontSize: 12, color: COLOR.inkL, margin: "0 0 16px" }}>Cumulative proportion of + over 365 days.</p>

            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={convergence}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLOR.borderL} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: COLOR.inkL }} />
                <YAxis
                  domain={[0, 1]}
                  ticks={[0, 0.25, 0.5, 0.75, 1]}
                  tick={{ fontSize: 11, fill: COLOR.inkL }}
                  tickFormatter={(v) => `${Math.round(v * 100)}%`}
                />
                <Tooltip contentStyle={{ fontSize: 12, fontFamily: FONT.sans }} formatter={(v) => `${(v * 100).toFixed(1)}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {SIM_PROFILES.map((p, i) => (
                  <Line key={p.key} type="monotone" dataKey={p.key} stroke={SIM_COLORS[i]} strokeWidth={2} dot={false} name={p.name} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ ...S.card, padding: 20 }}>
            <h3 style={{ ...S.h3, margin: "0 0 16px" }}>Summary</h3>
            <div style={{ display: "grid", gap: 12 }}>
              {finals.map((f) => {
                const overall = Math.round(f.finalRatio * 100);
                const input = Math.round(f.bias * 100);
                return (
                  <div key={f.key} style={{ padding: "14px 16px", borderRadius: 6, borderLeft: `3px solid ${f.color}`, background: `${f.color}08` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                      <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 17, color: f.color }}>{f.name}</span>
                      <span style={{ fontSize: 12, color: COLOR.inkL }}>{f.note}</span>
                    </div>
                    <div style={{ display: "flex", gap: 20, fontSize: 13, color: COLOR.inkL, flexWrap: "wrap" }}>
                      <span>U-choice input: <strong style={{ color: COLOR.ink }}>{input}% +</strong></span>
                      <span>Year-end ratio: <strong style={{ color: f.color, fontSize: 15 }}>{overall}% +</strong></span>
                      <span>C days: <strong style={{ color: COLOR.ink }}>{f.cDays}</strong>/365</span>
                      <span>Longest same-outcome run: <strong style={{ color: COLOR.ink }}>{f.longestRun}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
APP SHELL
═══════════════════════════════════════════════════ */

const TABS = [
  { id: "establish", label: "Establish", sub: "Method" },
  { id: "practice", label: "Practice", sub: "System" },
  { id: "extend", label: "Extend", sub: "Simulation" },
];

export default function App() {
  const [tab, setTab] = useState("establish");

  return (
    <div
      style={{
        fontFamily: FONT.sans,
        background: COLOR.paper,
        color: COLOR.ink,
        minHeight: "100vh",
        maxWidth: 900,
        margin: "0 auto",
        padding: "0 max(14px, env(safe-area-inset-right)) 0 max(14px, env(safe-area-inset-left))",
      }}
    >
      <style>{GLOBAL_CSS}</style>

      <header style={{ textAlign: "center", padding: "36px 0 8px" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: COLOR.gold,
            marginBottom: 8,
          }}
        >
          Agency Through Deterministic Uncertainty
        </div>
        <h1 style={{ fontFamily: FONT.serif, fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", color: COLOR.ink }}>ATDU</h1>
        <p style={{ ...S.muted, marginTop: 6, fontSize: 13 }}>A coin, a wager, a ledger.</p>
      </header>

      <nav style={{ display: "flex", justifyContent: "center", gap: 4, margin: "24px 0 8px", borderBottom: `1px solid ${COLOR.border}`, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            style={{
              fontFamily: FONT.sans,
              fontSize: 13,
              fontWeight: 600,
              padding: "10px clamp(12px, 3vw, 24px) 12px",
              background: "none",
              border: "none",
              borderBottom: `2px solid ${tab === t.id ? COLOR.ink : "transparent"}`,
              color: tab === t.id ? COLOR.ink : COLOR.inkL,
              cursor: "pointer",
              transition: "all 0.15s",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 400, color: COLOR.inkL, letterSpacing: "0.05em", textTransform: "uppercase" }}>{t.sub}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <main style={{ animation: "fadeIn 0.3s ease", paddingBottom: 40 }}>
        {tab === "establish" && <EstablishTab />}
        {tab === "practice" && <PracticeTab />}
        {tab === "extend" && <ExtendTab />}
      </main>
    </div>
  );
}
