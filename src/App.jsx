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
  ReferenceLine,
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
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "6px 12px",
    borderRadius: 4,
    minHeight: 36,
  },
  card: { background: COLOR.white, border: `1px solid ${COLOR.border}`, borderRadius: 8, padding: 24, marginBottom: 20 },
  btn: {
    fontFamily: FONT.sans,
    fontSize: 14,
    fontWeight: 600,
    padding: "12px 24px",
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    transition: "all 0.15s",
    minHeight: 44,
  },
  input: {
    fontFamily: FONT.sans,
    fontSize: 16,
    padding: "10px 12px",
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
html { -webkit-text-size-adjust: 100%; }
body { background: #f5f0e8; color: #2c2416; -webkit-tap-highlight-color: transparent; }
button, input { font: inherit; touch-action: manipulation; }
input { font-size: 16px !important; }
input:focus { border-color: ${COLOR.gold} !important; box-shadow: 0 0 0 2px ${COLOR.gold}30; }
::selection { background: ${COLOR.goldFade}; }
table tr:last-child { border-bottom: none !important; }

button { touch-action: manipulation; -webkit-user-select: none; user-select: none; }
button:active { transform: scale(0.97); }
button:active:not(:disabled) { opacity: 0.85; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes flipIn { 
  0% { transform: rotateX(90deg) scale(0.9); opacity: 0; } 
  100% { transform: rotateX(0deg) scale(1); opacity: 1; } 
}
@keyframes landIn {
  0% { transform: scale(0.92); opacity: 0; }
  60% { transform: scale(1.02); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes coinSpin {
  0% { transform: rotateY(0deg); }
  100% { transform: rotateY(1800deg); }
}
@keyframes pulseOnce {
  0% { box-shadow: 0 0 0 0 ${COLOR.gold}40; }
  70% { box-shadow: 0 0 0 10px ${COLOR.gold}00; }
  100% { box-shadow: 0 0 0 0 ${COLOR.gold}00; }
}

.practice-day-card { padding: 14px 16px; border-radius: 8px; background: ${COLOR.white}; border: 1px solid ${COLOR.border}; transition: all 0.15s ease; }
.practice-day-card.revealed { animation: landIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.practice-day-card.constrained { border-left: 3px solid ${COLOR.inkL}40; background: ${COLOR.ink}03; }
.ledger-scroll { max-height: 360px; overflow-y: auto; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.ledger-toggle { display: flex; justify-content: center; padding: 8px; font-size: 12px; color: ${COLOR.inkL}; cursor: pointer; background: none; border: none; width: 100%; font-family: ${FONT.sans}; font-weight: 600; min-height: 36px; align-items: center; }
.practice-day-row { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; }
.practice-day-actions { display: flex; gap: 8px; }
.practice-day-actions-vertical { flex-direction: column; align-items: center; min-width: 220px; }
.practice-day-center-stack { display: flex; flex-direction: column; align-items: center; gap: 8px; flex: 1; min-width: 210px; text-align: center; }
.practice-day-code { font-family: ${FONT.serif}; font-weight: 700; font-size: 18px; color: ${COLOR.ink}; }
.practice-day-title { font-size: 13px; color: ${COLOR.inkL}; }
.practice-action-option { min-height: 44px; transition: all 0.12s ease; }
.practice-action-option:active { transform: scale(0.93) !important; }
.practice-selected-action { font-family: ${FONT.serif}; font-weight: 700; font-size: 16px; text-align: center; }
.ledger-odds-cell { font-family: ${FONT.serif}; font-weight: 700; font-size: 16px; }
.practice-constrained-outcome { font-family: ${FONT.serif}; font-weight: 700; font-size: 18px; color: ${COLOR.ink}; }

.flip-btn { min-height: 48px; min-width: 120px; transition: all 0.15s ease; position: relative; overflow: hidden; }
.flip-btn:active:not(:disabled) { transform: scale(0.95) !important; }
.flip-btn.flipping { animation: pulseOnce 0.6s ease-out; }

.coin-icon { display: inline-block; transition: transform 0.1s; }
.coin-icon.spinning { animation: coinSpin 0.6s cubic-bezier(0.2, 0.8, 0.3, 1); }

.category-btn { min-height: 36px; transition: all 0.12s ease; }
.category-btn:active { transform: scale(0.95) !important; }

@media (max-width: 640px) {
  .practice-day-card { padding: 16px; }
  .practice-day-row { align-items: stretch; gap: 8px; }
  .practice-day-actions { width: 100%; gap: 10px; }
  .practice-day-actions-vertical { min-width: 100%; }
  .practice-day-center-stack { min-width: 100%; }
  .practice-day-actions button { flex: 1; min-height: 48px; }
  .practice-constrained-outcome { width: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 4px; padding-top: 2px; }
  .mobile-stack { flex-wrap: wrap; }
  .mobile-stack > div { min-width: 100%; }
  .tab-button { min-width: 40%; }
  .flip-btn { min-height: 52px; min-width: 140px; font-size: 17px !important; }
  .ledger-scroll { max-height: 320px; }
}
`;

/* ═══════════════════════════════════════════════════
   HELPERS (rules + formatting)
   ═══════════════════════════════════════════════════ */

const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;
function haptic(ms) { if (canVibrate) try { navigator.vibrate(ms); } catch(e) {} }
function hapticFlip() { haptic([40, 30, 40]); }
function hapticTap() { haptic(12); }
function hapticCommit() { haptic([20, 40, 60]); }

const DISP_MINUS = "\u2212";
const OUT = { PLUS: "+", MINUS: "-" };

function normalizeCode(code) {
  return (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2);
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

function outcomeDescription(w, outcome) {
  return normalizeOutcome(outcome) === OUT.MINUS ? w.minus : w.plus;
}

function formatOddsSymbol(odds) {
  if (!odds) return "\u2014";
  if (odds.plusPct === 100) return OUT.PLUS;
  if (odds.minusPct === 100) return OUT.MINUS;
  return "split";
}

function getWagerTooltip(w) {
  const plus = (w.plus || "").trim();
  const minus = (w.minus || "").trim();
  return [
    w.name + " (" + w.code + ")",
    "",
    "+ : " + (plus || "(unset)"),
    "\u2212 : " + (minus || "(unset)"),
    "",
    "U \u2014 you choose",
    "C \u2014 assigned by rule",
  ].join("\n");
}

/* ═══════════════════════════════════════════════════
   RULES PANEL (collapsible, lives inside Practice)
   ═══════════════════════════════════════════════════ */

function RulesPanel({ open, onToggle }) {
  return (
    <div style={{ marginBottom: 0 }}>
      <button
        onClick={onToggle}
        style={{
          ...S.btn,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "transparent",
          color: COLOR.inkL,
          border: "1px solid " + COLOR.border,
          fontSize: 13,
          padding: "8px 16px",
          width: "auto",
        }}
      >
        <span style={{ fontSize: 10, transition: "transform 0.15s", transform: open ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>{"\u25B6"}</span>
        Rules
      </button>

      {open && (
        <div style={{ ...S.card, marginTop: 10, padding: 20, animation: "fadeIn 0.2s ease" }}>
          <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>
            {[
              "A wager names a behavior domain. Two outcomes partition it: + and \u2212. They are mutually exclusive. Each day, exactly one resolves.",
              "Flip 1 determines mode. Heads = Unconstrained (U): you select the outcome. Tails = Constrained (C): the outcome is assigned.",
              "If Constrained, Flip 2 determines the rule. Heads = inverse of last entry (any mode). Tails = inverse of last constrained entry. No prior entry defaults by category.",
              "Record one cell per wager: the mode letter (U or C) in the color of the outcome (+ green, \u2212 red). The ledger stores what resolved. Nothing else.",
            ].map((text, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontFamily: FONT.serif, fontSize: 18, fontWeight: 700, color: COLOR.gold, minWidth: 20, flexShrink: 0 }}>{i + 1}</span>
                <p style={{ ...S.p, margin: 0, fontSize: 14 }}>{text}</p>
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid " + COLOR.borderL, paddingTop: 14, marginBottom: 14 }}>
            <p style={{ ...S.muted, fontSize: 12, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Classification</p>
            <p style={{ ...S.muted, fontSize: 13, marginBottom: 10 }}>Sets the first constrained default only. Describes your existing relationship to the domain.</p>
            <div style={{ display: "grid", gap: 4 }}>
              {[
                { label: "Habit", color: COLOR.inkL, desc: "Part of how you operate. You don\u2019t decide to \u2014 you already do. Default: +." },
                { label: "Contested", color: COLOR.gold, desc: "You have reasons for both sides. The narrative adjusts to justify whichever occurred. Default: +." },
                { label: "Planned Not Taken", color: COLOR.red, desc: "You identify with the intention. You enact its absence. Default: \u2212." },
              ].map(function(item) {
                return (
                  <div key={item.label} style={{ display: "flex", gap: 10, alignItems: "center", padding: "4px 0" }}>
                    <span style={{ ...S.tag, background: item.color + "18", color: item.color, minWidth: 130, textAlign: "center", flexShrink: 0, fontSize: 10 }}>{item.label}</span>
                    <p style={{ ...S.p, margin: 0, fontSize: 13 }}>{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ borderTop: "1px solid " + COLOR.borderL, paddingTop: 14 }}>
            <p style={{ ...S.muted, fontSize: 12, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Terms</p>
            <div style={{ display: "grid", gap: 4 }}>
              {[
                ["Wager", "A behavior domain partitioned into + and \u2212. Both outcomes are real. Both will occur."],
                ["Unconstrained (U)", "You select the outcome. The coin gave you the choice."],
                ["Constrained (C)", "The outcome is assigned by inversion of prior sequence. The coin removed the choice."],
                ["Ledger", "The accumulated record. Mode and outcome. No cause, no explanation."],
              ].map(function(pair) {
                return (
                  <div key={pair[0]} style={{ padding: "4px 0" }}>
                    <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 13, color: COLOR.ink }}>{pair[0]}</span>
                    <span style={{ fontSize: 13, color: COLOR.inkL }}>{" \u2014 "}{pair[1]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
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
  const [justFlipped, setJustFlipped] = useState(false);
  const [addingWager, setAddingWager] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [newWager, setNewWager] = useState({ code: "", name: "", plus: "", minus: "", category: "Habit" });
  const [rulesOpen, setRulesOpen] = useState(true);
  const [ledgerExpanded, setLedgerExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(function() {
    (async function() {
      var loadedW = null, loadedL = [], loadedT = null;
      try {
        var w = await window.storage.get(SKEY.wagers);
        if (w && w.value) loadedW = JSON.parse(w.value);
      } catch(e) {}
      try {
        var l = await window.storage.get(SKEY.ledger);
        if (l && l.value) loadedL = JSON.parse(l.value);
      } catch(e) {}
      try {
        var t = await window.storage.get(SKEY.today);
        if (t && t.value) {
          var parsed = JSON.parse(t.value);
          loadedT = parsed && parsed.day ? parsed : null;
        }
      } catch(e) {}

      /* reconcile todayState with current active wagers */
      if (loadedW && loadedT && loadedT.day) {
        var active = loadedW.filter(function(w) { return !w.removed; });
        var changed = false;

        /* add missing wagers (added since last load) */
        active.forEach(function(w) {
          if (!loadedT[w.code]) {
            var flip1Heads = Math.random() < 0.5;
            if (flip1Heads) {
              loadedT[w.code] = { mode: "U", outcome: null };
            } else {
              var defOut = w.category === "Planned Not Taken" ? OUT.MINUS : OUT.PLUS;
              loadedT[w.code] = { mode: "C", outcome: defOut, invType: "last" };
            }
            changed = true;
          }
        });

        /* remove stale wagers (removed since last load) */
        var activeCodes = new Set(active.map(function(w) { return w.code; }));
        Object.keys(loadedT).forEach(function(k) {
          if (k !== "day" && !activeCodes.has(k)) {
            delete loadedT[k];
            changed = true;
          }
        });

        if (changed) {
          try { await window.storage.set(SKEY.today, JSON.stringify(loadedT)); } catch(e) {}
        }
      }

      /* apply all state atomically */
      if (loadedW) {
        setWagers(loadedW);
        setSetupMode(false);
      }
      setLedger(loadedL);
      if (loadedL.length > 0) setRulesOpen(false);
      setTodayState(loadedT);
      setLoaded(true);
    })();
  }, []);

  const saveW = useCallback(async function(w) {
    setWagers(w);
    try { await window.storage.set(SKEY.wagers, JSON.stringify(w)); } catch(e) {}
  }, []);

  const saveL = useCallback(async function(l) {
    setLedger(l);
    try { await window.storage.set(SKEY.ledger, JSON.stringify(l)); } catch(e) {}
  }, []);

  const saveToday = useCallback(async function(t) {
    setTodayState(t);
    try {
      if (t) { await window.storage.set(SKEY.today, JSON.stringify(t)); }
      else { await window.storage.delete(SKEY.today); }
    } catch(e) {}
  }, []);

  const activeWagers = wagers ? wagers.filter(function(w) { return !w.removed; }) : [];

  const ledgerCodes = useMemo(function() {
    const codes = new Set();
    ledger.forEach(function(day) {
      Object.keys(day).forEach(function(k) { if (k !== "day") codes.add(k); });
    });
    return codes;
  }, [ledger]);

  const ledgerWagers = useMemo(function() {
    if (!wagers) return [];
    var active = wagers.filter(function(w) { return !w.removed; });
    var inactive = wagers.filter(function(w) { return w.removed && ledgerCodes.has(w.code); });
    return active.concat(inactive);
  }, [wagers, ledgerCodes]);

  const getLastEntry = useCallback(function(code) {
    for (var i = ledger.length - 1; i >= 0; i--) {
      if (ledger[i][code]) return ledger[i][code];
    }
    return null;
  }, [ledger]);

  const getLastC = useCallback(function(code) {
    for (var i = ledger.length - 1; i >= 0; i--) {
      if (ledger[i][code] && ledger[i][code].mode === "C") return ledger[i][code];
    }
    return null;
  }, [ledger]);

  const categoryDefault = function(w) { return w.category === "Planned Not Taken" ? OUT.MINUS : OUT.PLUS; };

  const getConstrainedOdds = useCallback(function(wager, forcedUnconstrainedOutcome) {
    var code = wager.code;
    var plusDefault = categoryDefault(wager) === OUT.PLUS ? 1 : 0;
    var minusDefault = categoryDefault(wager) === OUT.MINUS ? 1 : 0;

    var lastConstrained = getLastC(code);
    var constrainedOutcome = lastConstrained ? normalizeOutcome(lastConstrained.outcome) : null;

    var lastEntry = getLastEntry(code);
    if (todayState && todayState[code] && todayState[code].mode === "U" && forcedUnconstrainedOutcome) {
      lastEntry = { mode: "U", outcome: normalizeOutcome(forcedUnconstrainedOutcome) };
    }
    var lastOutcome = lastEntry ? normalizeOutcome(lastEntry.outcome) : null;

    var lastPlus = lastOutcome ? (invertOutcome(lastOutcome) === OUT.PLUS ? 1 : 0) : plusDefault;
    var lastMinus = lastOutcome ? (invertOutcome(lastOutcome) === OUT.MINUS ? 1 : 0) : minusDefault;

    var constrainedPlus = constrainedOutcome ? (invertOutcome(constrainedOutcome) === OUT.PLUS ? 1 : 0) : plusDefault;
    var constrainedMinus = constrainedOutcome ? (invertOutcome(constrainedOutcome) === OUT.MINUS ? 1 : 0) : minusDefault;

    return {
      plusPct: Math.round(((lastPlus + constrainedPlus) / 2) * 100),
      minusPct: Math.round(((lastMinus + constrainedMinus) / 2) * 100),
    };
  }, [getLastC, getLastEntry, todayState]);

  const getRollingOddsForWager = useCallback(function(wager) {
    var current = todayState ? todayState[wager.code] : null;
    var forcedOutcome = current && current.mode === "U" ? normalizeOutcome(current.outcome) : null;
    return getConstrainedOdds(wager, forcedOutcome);
  }, [getConstrainedOdds, todayState]);

  const isBrightU = useCallback(function(dayIndex, code) {
    var entry = ledger[dayIndex] ? ledger[dayIndex][code] : null;
    if (!entry || entry.mode !== "U") return false;
    var outcome = normalizeOutcome(entry.outcome);
    if (!outcome) return false;
    var sameUOutcome = function(candidate) { return candidate && candidate.mode === "U" && normalizeOutcome(candidate.outcome) === outcome; };
    var prev = ledger[dayIndex - 1] ? ledger[dayIndex - 1][code] : null;
    var next = ledger[dayIndex + 1] ? ledger[dayIndex + 1][code] : null;
    return sameUOutcome(prev) || sameUOutcome(next);
  }, [ledger]);

  var updateDraft = function(i, field, value) {
    setDrafts(function(prev) { return prev.map(function(d, j) { return j === i ? Object.assign({}, d, { [field]: value }) : d; }); });
  };

  var finishSetup = function() {
    var valid = drafts
      .map(function(d) { return Object.assign({}, d, { code: normalizeCode(d.code) }); })
      .filter(function(d) { return d.code && d.name && d.plus && d.minus; });
    if (new Set(valid.map(function(d) { return d.code; })).size !== valid.length) return;
    if (!valid.length) return;
    hapticCommit();
    saveW(valid);
    setSetupMode(false);
  };

  var buildFlippedDay = useCallback(function() {
    var state = {};
    activeWagers.forEach(function(w) {
      var flip1Heads = Math.random() < 0.5;
      if (flip1Heads) {
        state[w.code] = { mode: "U", outcome: null };
      } else {
        var flip2Heads = Math.random() < 0.5;
        var invType = flip2Heads ? "last" : "lastC";
        var ref = invType === "last" ? getLastEntry(w.code) : getLastC(w.code);
        var refOutcome = ref ? normalizeOutcome(ref.outcome) : null;
        var outcome = refOutcome ? invertOutcome(refOutcome) : categoryDefault(w);
        state[w.code] = { mode: "C", outcome: outcome, invType: invType };
      }
    });
    return state;
  }, [activeWagers, getLastC, getLastEntry]);

  var toLedgerEntry = useCallback(function(dayState) {
    var entry = { day: dayState.day };
    activeWagers.forEach(function(w) {
      var ts = dayState[w.code];
      if (!ts) return;
      entry[w.code] = { mode: ts.mode, outcome: normalizeOutcome(ts.outcome) };
      if (ts.mode === "C" && ts.invType) entry[w.code].inv = ts.invType;
    });
    return entry;
  }, [activeWagers]);

  var flipAll = function() {
    if (!activeWagers.length) return;
    var canAdvanceDay = !todayState || activeWagers.every(function(w) { return todayState[w.code] && todayState[w.code].outcome; });
    if (!canAdvanceDay) return;
    hapticFlip();
    setFlipAnim(true);
    setTimeout(function() {
      var nextDay = (todayState ? todayState.day : ledger.length) + 1;
      var nextState = Object.assign({}, buildFlippedDay(), { day: nextDay });
      var nextEntry = toLedgerEntry(nextState);
      saveL([].concat(ledger, [nextEntry]));
      saveToday(nextState);
      setFlipAnim(false);
      setJustFlipped(true);
      setRulesOpen(false);
      setTimeout(function() { setJustFlipped(false); }, 500);
    }, 600);
  };

  var setOutcomeForCode = function(code, val) {
    hapticTap();
    var nextState = Object.assign({}, todayState, {
      [code]: Object.assign({}, todayState[code], { outcome: normalizeOutcome(val) }),
    });
    saveToday(nextState);
    var nextEntry = toLedgerEntry(nextState);
    var hasDay = ledger.some(function(d) { return d.day === nextEntry.day; });
    saveL(hasDay ? ledger.map(function(d) { return d.day === nextEntry.day ? nextEntry : d; }) : [].concat(ledger, [nextEntry]));
  };

  var addWagerFn = function() {
    var cleaned = Object.assign({}, newWager, { code: normalizeCode(newWager.code) });
    if (!cleaned.code || !cleaned.name || !cleaned.plus || !cleaned.minus) return;
    if (wagers.some(function(w) { return w.code === cleaned.code && !w.removed; })) return;
    var existing = wagers.findIndex(function(w) { return w.code === cleaned.code && w.removed; });
    var updated;
    if (existing >= 0) {
      updated = wagers.map(function(w, i) { return i === existing ? Object.assign({}, cleaned, { removed: false }) : w; });
    } else {
      updated = [].concat(wagers, [Object.assign({}, cleaned)]);
    }
    hapticCommit();
    saveW(updated);

    /* integrate new wager into current day if mid-practice */
    if (todayState && todayState.day) {
      var flip1Heads = Math.random() < 0.5;
      var wagerState;
      if (flip1Heads) {
        wagerState = { mode: "U", outcome: null };
      } else {
        var flip2Heads = Math.random() < 0.5;
        var invType = flip2Heads ? "last" : "lastC";
        var ref = invType === "last" ? getLastEntry(cleaned.code) : getLastC(cleaned.code);
        var refOutcome = ref ? normalizeOutcome(ref.outcome) : null;
        var outcome = refOutcome ? invertOutcome(refOutcome) : (cleaned.category === "Planned Not Taken" ? OUT.MINUS : OUT.PLUS);
        wagerState = { mode: "C", outcome: outcome, invType: invType };
      }
      var nextTodayState = Object.assign({}, todayState, { [cleaned.code]: wagerState });
      saveToday(nextTodayState);

      /* update current day's ledger entry */
      var newEntry = { mode: wagerState.mode, outcome: normalizeOutcome(wagerState.outcome) };
      if (wagerState.mode === "C" && wagerState.invType) newEntry.inv = wagerState.invType;
      var dayNum = todayState.day;
      saveL(ledger.map(function(d) {
        if (d.day === dayNum) return Object.assign({}, d, { [cleaned.code]: newEntry });
        return d;
      }));
    }

    setNewWager({ code: "", name: "", plus: "", minus: "", category: "Habit" });
    setAddingWager(false);
  };

  var removeWagerFn = function(code) {
    var nextWagers = wagers.map(function(w) { return w.code === code ? Object.assign({}, w, { removed: true }) : w; });
    saveW(nextWagers);

    /* check if any active wagers remain */
    var remaining = nextWagers.filter(function(w) { return !w.removed; });
    if (remaining.length === 0) {
      /* no active wagers — clear today state but preserve ledger */
      saveToday(null);
      return;
    }

    if (todayState && todayState[code]) {
      var nextDayState = Object.assign({}, todayState);
      delete nextDayState[code];
      saveToday(nextDayState);

      /* update current day's ledger entry to remove this wager */
      var dayNum = todayState.day;
      if (dayNum) {
        saveL(ledger.map(function(d) {
          if (d.day === dayNum) {
            var cleaned = Object.assign({}, d);
            delete cleaned[code];
            return cleaned;
          }
          return d;
        }));
      }
    }
  };

  var startEditFn = function(w) {
    setEditingCode(w.code);
    setEditDraft({ name: w.name, plus: w.plus, minus: w.minus, category: w.category });
  };

  var saveEditFn = function() {
    if (!editDraft || !editingCode) return;
    if (!editDraft.name || !editDraft.plus || !editDraft.minus) return;
    saveW(wagers.map(function(w) {
      return w.code === editingCode ? Object.assign({}, w, { name: editDraft.name, plus: editDraft.plus, minus: editDraft.minus, category: editDraft.category }) : w;
    }));
    setEditingCode(null);
    setEditDraft(null);
  };

  var cancelEditFn = function() { setEditingCode(null); setEditDraft(null); };

  var resetAll = async function() {
    setWagers(null);
    setLedger([]);
    setSetupMode(true);
    await saveToday(null);
    setAddingWager(false);
    setEditingCode(null);
    setEditDraft(null);
    setDrafts([{ code: "", name: "", plus: "", minus: "", category: "Habit" }]);
    try { await window.storage.delete(SKEY.wagers); } catch(e) {}
    try { await window.storage.delete(SKEY.ledger); } catch(e) {}
  };

  /* ── Loading ── */
  if (!loaded) return null;

  /* ── Setup View ── */
  if (setupMode || !wagers) {
    return (
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <p style={{ ...S.muted, marginTop: 24, marginBottom: 6 }}>
          Name a behavior. Classify your relationship to it. Define both sides {"\u2014"} mutually exclusive, one per day. You decide how much changes between them.
        </p>

        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          {drafts.map(function(d, i) {
            return (
              <div key={i} style={{ ...S.card, padding: 16 }}>
                <div className="mobile-stack" style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label style={S.label}>Domain</label>
                    <input style={S.input} value={d.name} onChange={function(e) { updateDraft(i, "name", e.target.value); }} placeholder="The behavior" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                  {CATEGORIES.map(function(cat) {
                    return (
                      <button
                        key={cat}
                        className="category-btn"
                        onClick={function() { hapticTap(); updateDraft(i, "category", cat); }}
                        style={{
                          ...S.tag,
                          cursor: "pointer",
                          background: d.category === cat ? CAT_COLORS[cat] + "20" : "transparent",
                          color: d.category === cat ? CAT_COLORS[cat] : COLOR.inkL,
                          border: "1px solid " + (d.category === cat ? CAT_COLORS[cat] : COLOR.border),
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
                {d.category && (
                  <p style={{ fontSize: 12, color: CAT_COLORS[d.category], margin: "0 0 10px", lineHeight: 1.5 }}>
                    {d.category === "Habit" && "Part of how you operate. You don\u2019t decide to \u2014 you already do."}
                    {d.category === "Contested" && "You have reasons for both sides. The narrative adjusts to justify whichever occurred."}
                    {d.category === "Planned Not Taken" && "You identify with the intention. You enact its absence."}
                  </p>
                )}
                <div className="mobile-stack" style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label style={{ ...S.label, color: COLOR.green }}>+</label>
                    <input
                      style={{ ...S.input, borderColor: COLOR.green + "40" }}
                      value={d.plus}
                      onChange={function(e) { updateDraft(i, "plus", e.target.value); }}
                      placeholder="The behavior"
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label style={{ ...S.label, color: COLOR.red }}>{DISP_MINUS}</label>
                    <input
                      style={{ ...S.input, borderColor: COLOR.red + "40" }}
                      value={d.minus}
                      onChange={function(e) { updateDraft(i, "minus", e.target.value); }}
                      placeholder="Its inverse"
                    />
                  </div>
                </div>
                <div className="mobile-stack" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 60, flexShrink: 0 }}>
                    <label style={S.label}>Code</label>
                    <input
                      style={{ ...S.input, textTransform: "uppercase", fontWeight: 700, textAlign: "center" }}
                      maxLength={2}
                      value={d.code}
                      onChange={function(e) { updateDraft(i, "code", normalizeCode(e.target.value)); }}
                      placeholder="W"
                    />
                  </div>
                  {drafts.length > 1 && (
                    <button
                      onClick={function() { setDrafts(function(p) { return p.filter(function(_, j) { return j !== i; }); }); }}
                      style={{ marginLeft: "auto", background: "none", border: "none", color: COLOR.inkL, cursor: "pointer", fontSize: 20, padding: "4px 8px", minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
                      aria-label="Remove wager"
                    >
                      {"\u00d7"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center" }}>
          <button
            onClick={function() { setDrafts(function(p) { return [].concat(p, [{ code: "", name: "", plus: "", minus: "", category: "Habit" }]); }); }}
            style={{ ...S.btn, background: "transparent", border: "1px solid " + COLOR.border, color: COLOR.inkL }}
          >
            + Another
          </button>
          <button onClick={finishSetup} style={{ ...S.btn, background: COLOR.ink, color: COLOR.paper, fontSize: 15, padding: "14px 28px" }}>
            Place Wagers
          </button>
        </div>

        <div style={{ marginTop: 24 }}>
          <RulesPanel open={rulesOpen} onToggle={function() { setRulesOpen(function(p) { return !p; }); }} />
        </div>
      </div>
    );
  }

  /* ── Active Practice View ── */
  var allFilled = todayState && activeWagers.length > 0 && activeWagers.every(function(w) { return todayState[w.code] && todayState[w.code].outcome; });
  var dayNumber = todayState ? todayState.day : ledger.length + 1;

  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      <div style={{ ...S.card, textAlign: "center", marginTop: 24 }}>
        {!todayState ? (
          <div>
            <p style={{ ...S.muted, margin: "0 0 16px" }}>Day {dayNumber}</p>
            <button
              onClick={flipAll}
              className={"flip-btn" + (flipAnim ? " flipping" : "")}
              style={{ ...S.btn, background: COLOR.ink, color: COLOR.paper, fontSize: 16, padding: "14px 36px" }}
            >
              <span className={"coin-icon" + (flipAnim ? " spinning" : "")}>{"\u25CF"}</span>
              {" "}{flipAnim ? "" : "Flip"}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ ...S.muted, margin: "0 0 20px" }}>Day {dayNumber}</p>
            <div style={{ display: "grid", gap: 12, textAlign: "center" }}>
              {activeWagers.map(function(w, wi) {
                var ts = todayState[w.code];
                if (!ts) return null;
                var isC = ts.mode === "C";
                var o = normalizeOutcome(ts.outcome);
                var oc = o === OUT.PLUS ? COLOR.green : o === OUT.MINUS ? COLOR.red : COLOR.inkL;
                var selectedAction = o ? outcomeDescription(w, o) : null;
                var cardClass = "practice-day-card" + (isC ? " constrained" : "") + (justFlipped ? " revealed" : "");

                return (
                  <div key={w.code} className={cardClass} style={justFlipped ? { animationDelay: (wi * 80) + "ms" } : undefined}>
                    <div className="practice-day-row">
                      <div className="practice-day-center-stack">
                        <span className="practice-day-code" title={getWagerTooltip(w)}>{w.code}</span>
                        <span className="practice-day-title">{w.name}</span>
                        {isC ? (
                          <span className="practice-constrained-outcome" style={{ color: oc, marginTop: 6 }}>
                            <span className="practice-selected-action">{selectedAction}</span>
                          </span>
                        ) : o ? (
                          <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                            <span className="practice-selected-action" style={{ color: oc }}>{selectedAction}</span>
                            <button
                              onClick={function() { setOutcomeForCode(w.code, o === OUT.PLUS ? OUT.MINUS : OUT.PLUS); }}
                              style={{ ...S.btn, padding: "6px 12px", fontSize: 12, background: "transparent", color: COLOR.inkL, border: "1px solid " + COLOR.border, minHeight: 32 }}
                            >
                              Switch
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 10, marginTop: 8, justifyContent: "center" }}>
                            {[OUT.PLUS, OUT.MINUS].map(function(val) {
                              var c = val === OUT.PLUS ? COLOR.green : COLOR.red;
                              var sym = val === OUT.PLUS ? "+" : DISP_MINUS;
                              return (
                                <button
                                  key={val}
                                  onClick={function() { setOutcomeForCode(w.code, val); }}
                                  className="practice-action-option"
                                  title={val === OUT.PLUS ? w.plus : w.minus}
                                  style={{
                                    ...S.btn,
                                    width: 56, height: 56,
                                    padding: 0,
                                    fontSize: 22,
                                    fontWeight: 700,
                                    background: "transparent",
                                    color: c,
                                    border: "2px solid " + c,
                                    borderRadius: "50%",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                  }}
                                >
                                  {sym}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 20 }}>
              <button
                onClick={flipAll}
                disabled={!allFilled || flipAnim}
                className={"flip-btn" + (flipAnim ? " flipping" : "")}
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
                <span className={"coin-icon" + (flipAnim ? " spinning" : "")}>{"\u25CF"}</span>
                {" "}{flipAnim ? "" : "Flip"}
              </button>
            </div>
          </div>
        )}
      </div>

      {ledger.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ ...S.h3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            Ledger
            <span style={{ fontSize: 12, fontWeight: 400, color: COLOR.inkL }}>{ledger.length} {ledger.length === 1 ? "day" : "days"}</span>
          </h3>
          <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            <div className={ledgerExpanded ? "" : "ledger-scroll"} style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT.sans, fontSize: 14 }}>
                <thead style={{ position: "sticky", top: 0, background: COLOR.white, zIndex: 2 }}>
                  <tr>
                    <th style={{ padding: "10px 10px 6px", borderBottom: "2px solid " + COLOR.ink, textAlign: "left", fontWeight: 700, fontSize: 12 }} />
                    {ledgerWagers.map(function(w) {
                      return (
                        <th key={w.code} style={{
                          padding: "10px 10px 6px",
                          borderBottom: "2px solid " + COLOR.ink,
                          textAlign: "center",
                          fontWeight: 700,
                          fontSize: 14,
                          fontFamily: FONT.serif,
                          color: w.removed ? COLOR.inkL : COLOR.ink,
                          opacity: w.removed ? 0.5 : 1,
                        }} title={getWagerTooltip(w)}>
                          {w.code}
                        </th>
                      );
                    })}
                  </tr>
                  <tr style={{ borderBottom: "2px solid " + COLOR.ink + "20", background: COLOR.ink + "04" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 700, fontSize: 11, color: COLOR.inkL, letterSpacing: "0.05em" }}>ODDS</td>
                    {ledgerWagers.map(function(w) {
                      if (w.removed) return <td key={w.code} style={{ textAlign: "center", padding: 6, color: COLOR.borderL }}>{"\u2014"}</td>;
                      var odds = getRollingOddsForWager(w);
                      var symbol = formatOddsSymbol(odds);
                      return (
                        <td key={w.code} style={{ textAlign: "center", padding: 6 }}>
                          {symbol === "split" ? (
                            <span className="ledger-odds-cell" style={{ color: COLOR.gold }} title={"next C: + " + odds.plusPct + "% \u00b7 \u2212 " + odds.minusPct + "%"}>
                              =
                            </span>
                          ) : (
                            <span className="ledger-odds-cell" style={{ color: symbol === OUT.PLUS ? COLOR.green : COLOR.red }} title={"next C: + " + odds.plusPct + "% \u00b7 \u2212 " + odds.minusPct + "%"}>
                              {fmtOutcome(symbol)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {(function() {
                    var displayed = ledgerExpanded ? ledger : ledger.slice(-8);
                    var baseIdx = ledgerExpanded ? 0 : Math.max(0, ledger.length - 8);
                    var rows = displayed.map(function(day, si) { return { day: day, origIdx: baseIdx + si }; });
                    rows.reverse();
                    return rows.map(function(r) {
                      var day = r.day;
                      var i = r.origIdx;
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid " + COLOR.borderL }}>
                          <td style={{ padding: "8px 10px", fontWeight: 600, fontSize: 13, color: COLOR.inkL }}>
                            {String(day.day).padStart(2, "0")}
                          </td>
                          {ledgerWagers.map(function(w) {
                            var e = day[w.code];
                            if (!e) return <td key={w.code} style={{ textAlign: "center", padding: 6, color: COLOR.borderL }}>{"\u2014"}</td>;
                            var o = normalizeOutcome(e.outcome);
                            var brightU = isBrightU(i, w.code);
                            var isFaded = e.mode === "C" || !brightU;
                            return (
                              <td key={w.code} style={{ textAlign: "center", padding: "8px 6px" }}>
                                <span style={{
                                  fontFamily: FONT.serif,
                                  fontWeight: 700,
                                  fontSize: 17,
                                  color: o === OUT.PLUS ? COLOR.green : COLOR.red,
                                  opacity: isFaded ? 0.5 : 1,
                                }} title={
                                  e.mode === "C" && e.inv ? "C"
                                    : e.mode === "U" && brightU ? "U (in run)"
                                    : "U (isolated)"
                                }>
                                  {e.mode}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
            {ledger.length > 8 && (
              <button
                className="ledger-toggle"
                onClick={function() { setLedgerExpanded(function(p) { return !p; }); }}
              >
                {ledgerExpanded ? "Show recent" : "Show all " + ledger.length + " days"}
              </button>
            )}
            <div style={{ padding: "8px 16px 12px", display: "flex", gap: 16, justifyContent: "center", fontSize: 12, flexWrap: "wrap", borderTop: "1px solid " + COLOR.borderL }}>
              <span>
                <span style={{ display: "inline-block", width: 8, height: 8, background: COLOR.green, borderRadius: 1, marginRight: 4, verticalAlign: "middle" }} />
                <span style={{ color: COLOR.green }}>+</span>
              </span>
              <span>
                <span style={{ display: "inline-block", width: 8, height: 8, background: COLOR.red, borderRadius: 1, marginRight: 4, verticalAlign: "middle" }} />
                <span style={{ color: COLOR.red }}>{DISP_MINUS}</span>
              </span>
              <span style={{ color: COLOR.inkL }}>bright = consecutive choice {"\u00b7"} faded = constraint or chance</span>
            </div>
          </div>
        </div>
      )}

      {addingWager && (
        <div style={{ ...S.card, padding: 16, borderLeft: "3px solid " + COLOR.gold }}>
          <div className="mobile-stack" style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={S.label}>Domain</label>
              <input style={S.input} value={newWager.name} onChange={function(e) { setNewWager(function(p) { return Object.assign({}, p, { name: e.target.value }); }); }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            {CATEGORIES.map(function(cat) {
              return (
                <button key={cat} className="category-btn" onClick={function() { hapticTap(); setNewWager(function(p) { return Object.assign({}, p, { category: cat }); }); }}
                  style={{
                    ...S.tag, cursor: "pointer",
                    background: newWager.category === cat ? CAT_COLORS[cat] + "20" : "transparent",
                    color: newWager.category === cat ? CAT_COLORS[cat] : COLOR.inkL,
                    border: "1px solid " + (newWager.category === cat ? CAT_COLORS[cat] : COLOR.border),
                  }}>
                  {cat}
                </button>
              );
            })}
          </div>
          {newWager.category && (
            <p style={{ fontSize: 12, color: CAT_COLORS[newWager.category], margin: "0 0 10px", lineHeight: 1.5 }}>
              {newWager.category === "Habit" && "Part of how you operate. You don\u2019t decide to \u2014 you already do."}
              {newWager.category === "Contested" && "You have reasons for both sides. The narrative adjusts to justify whichever occurred."}
              {newWager.category === "Planned Not Taken" && "You identify with the intention. You enact its absence."}
            </p>
          )}
          <div className="mobile-stack" style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ ...S.label, color: COLOR.green }}>+</label>
              <input style={{ ...S.input, borderColor: COLOR.green + "40" }} value={newWager.plus} onChange={function(e) { setNewWager(function(p) { return Object.assign({}, p, { plus: e.target.value }); }); }} placeholder="The behavior" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ ...S.label, color: COLOR.red }}>{DISP_MINUS}</label>
              <input style={{ ...S.input, borderColor: COLOR.red + "40" }} value={newWager.minus} onChange={function(e) { setNewWager(function(p) { return Object.assign({}, p, { minus: e.target.value }); }); }} placeholder="Its inverse" />
            </div>
          </div>
          <div className="mobile-stack" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 60, flexShrink: 0 }}>
              <label style={S.label}>Code</label>
              <input
                style={{ ...S.input, textTransform: "uppercase", fontWeight: 700, textAlign: "center" }}
                maxLength={2}
                value={newWager.code}
                onChange={function(e) { setNewWager(function(p) { return Object.assign({}, p, { code: normalizeCode(e.target.value) }); }); }}
              />
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button onClick={function() { setAddingWager(false); }} style={{ ...S.btn, background: "transparent", color: COLOR.inkL, border: "1px solid " + COLOR.border, fontSize: 13, padding: "8px 16px" }}>
                Cancel
              </button>
              <button onClick={addWagerFn} style={{ ...S.btn, background: COLOR.ink, color: COLOR.paper, fontSize: 13, padding: "8px 16px" }}>
                Place
              </button>
            </div>
          </div>
        </div>
      )}

      {!addingWager && (
        <div style={{ ...S.card, padding: 16 }}>
          <h3 style={{ ...S.h3, margin: "0 0 12px", fontSize: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            Wagers
            <button onClick={function() { setAddingWager(true); setEditingCode(null); }} style={{ ...S.btn, background: "transparent", color: COLOR.gold, border: "1px solid " + COLOR.gold + "40", fontSize: 13, padding: "6px 14px" }}>
              + Add
            </button>
          </h3>
          <div style={{ display: "grid", gap: 8 }}>
            {activeWagers.map(function(w) {
              if (editingCode === w.code && editDraft) {
                return (
                  <div key={w.code} style={{ padding: 12, borderRadius: 6, background: COLOR.gold + "08", border: "1px solid " + COLOR.gold + "30" }}>
                    <div className="mobile-stack" style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <label style={S.label}>Domain</label>
                        <input style={S.input} value={editDraft.name} onChange={function(e) { setEditDraft(function(p) { return Object.assign({}, p, { name: e.target.value }); }); }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                      {CATEGORIES.map(function(cat) {
                        return (
                          <button key={cat} className="category-btn" onClick={function() { hapticTap(); setEditDraft(function(p) { return Object.assign({}, p, { category: cat }); }); }}
                            style={{ ...S.tag, cursor: "pointer", background: editDraft.category === cat ? CAT_COLORS[cat] + "20" : "transparent", color: editDraft.category === cat ? CAT_COLORS[cat] : COLOR.inkL, border: "1px solid " + (editDraft.category === cat ? CAT_COLORS[cat] : COLOR.border) }}>
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mobile-stack" style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <label style={{ ...S.label, color: COLOR.green }}>+</label>
                        <input style={{ ...S.input, borderColor: COLOR.green + "40" }} value={editDraft.plus} onChange={function(e) { setEditDraft(function(p) { return Object.assign({}, p, { plus: e.target.value }); }); }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <label style={{ ...S.label, color: COLOR.red }}>{DISP_MINUS}</label>
                        <input style={{ ...S.input, borderColor: COLOR.red + "40" }} value={editDraft.minus} onChange={function(e) { setEditDraft(function(p) { return Object.assign({}, p, { minus: e.target.value }); }); }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button onClick={cancelEditFn} style={{ ...S.btn, background: "transparent", color: COLOR.inkL, border: "1px solid " + COLOR.border, fontSize: 13, padding: "8px 16px" }}>Cancel</button>
                      <button onClick={saveEditFn} style={{ ...S.btn, background: COLOR.ink, color: COLOR.paper, fontSize: 13, padding: "8px 16px" }}>Save</button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={w.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", borderRadius: 6, background: COLOR.ink + "04", minHeight: 44 }}>
                  <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 15, color: COLOR.ink, minWidth: 28 }} title={getWagerTooltip(w)}>{w.code}</span>
                  <span style={{ fontSize: 13, color: COLOR.inkL, flex: 1 }}>{w.name}</span>
                  <span style={{ ...S.tag, background: CAT_COLORS[w.category] + "12", color: CAT_COLORS[w.category], fontSize: 9 }}>{w.category}</span>
                  <button onClick={function() { startEditFn(w); }} style={{ background: "none", border: "none", color: COLOR.inkL, cursor: "pointer", fontSize: 13, padding: "4px 6px", opacity: 0.6, minWidth: 32, minHeight: 32, display: "flex", alignItems: "center", justifyContent: "center" }} title="Edit wager">
                    {"\u270E"}
                  </button>
                  {activeWagers.length > 1 && (
                    <button onClick={function() { removeWagerFn(w.code); }} style={{ background: "none", border: "none", color: COLOR.inkL, cursor: "pointer", fontSize: 18, padding: "4px 8px", opacity: 0.6, minWidth: 32, minHeight: 32, display: "flex", alignItems: "center", justifyContent: "center" }} title="Remove wager">
                      {"\u00d7"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: 8, paddingBottom: 20, flexWrap: "wrap" }}>
        <RulesPanel open={rulesOpen} onToggle={function() { setRulesOpen(function(p) { return !p; }); }} />
        <button onClick={resetAll} style={{ ...S.btn, background: "transparent", color: COLOR.red, border: "1px solid " + COLOR.red + "40", fontSize: 13 }}>
          Reset
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
  { key: "u25", name: "25% +", bias: 0.25, note: "Usually choose \u2212 on U" },
  { key: "u0", name: "0% +", bias: 0.0, note: "Always choose \u2212 on U" },
];

const SIM_COLORS = ["#2d6a4f", "#6a994e", "#b68d40", "#c1444a", "#9b2226"];

function simulate(bias, nDays) {
  var entries = [];
  var lastE = null, lastCE = null, plusCount = 0;
  for (var d = 0; d < nDays; d++) {
    var mode = Math.random() < 0.5 ? "U" : "C";
    var outcome = null;
    var invType = null;
    if (mode === "U") {
      outcome = Math.random() < bias ? OUT.PLUS : OUT.MINUS;
    } else {
      var flip2Heads = Math.random() < 0.5;
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
    entries.push({ day: d + 1, mode: mode, outcome: outcome, invType: invType, cumRatio: plusCount / (d + 1) });
  }
  return entries;
}

function SequenceStrip(props) {
  var entries = props.entries, label = props.label, color = props.color;
  return (
    <div style={{ marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 13, color: color, minWidth: 52, flexShrink: 0 }}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {entries.map(function(e, i) {
          return (
            <div key={i}
              title={"Day " + e.day + ": " + e.mode + fmtOutcome(e.outcome) + (e.mode === "C" && e.invType ? " (" + e.invType + ")" : "")}
              style={{
                width: 6, height: 6, borderRadius: 1,
                background: e.outcome === OUT.PLUS ? COLOR.green : COLOR.red,
                opacity: e.mode === "C" ? 0.5 : 1,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function ExtendTab() {
  var _mode = useState("ledger"), extMode = _mode[0], setExtMode = _mode[1];
  var _seed = useState(0), seed = _seed[0], setSeed = _seed[1];
  var _running = useState(false), running = _running[0], setRunning = _running[1];
  var _wagers = useState(null), extWagers = _wagers[0], setExtWagers = _wagers[1];
  var _ledger = useState([]), extLedger = _ledger[0], setExtLedger = _ledger[1];
  var _loaded = useState(false), extLoaded = _loaded[0], setExtLoaded = _loaded[1];

  useEffect(function() {
    (async function() {
      try {
        var w = await window.storage.get(SKEY.wagers);
        if (w && w.value) setExtWagers(JSON.parse(w.value));
      } catch(e) {}
      try {
        var l = await window.storage.get(SKEY.ledger);
        if (l && l.value) setExtLedger(JSON.parse(l.value));
      } catch(e) {}
      setExtLoaded(true);
    })();
  }, []);

  var activeExtWagers = extWagers ? extWagers.filter(function(w) { return !w.removed; }) : [];

  /* ── Per-wager analysis (lean-relative) ── */
  var wagerAnalysis = useMemo(function() {
    if (!extWagers || !extLedger.length) return [];
    var active = extWagers.filter(function(w) { return !w.removed; });
    return active.map(function(w) {
      var entries = [];
      extLedger.forEach(function(day, i) {
        var e = day[w.code];
        if (e && normalizeOutcome(e.outcome)) {
          entries.push({ day: day.day, dayIdx: i, mode: e.mode, outcome: normalizeOutcome(e.outcome), inv: e.inv });
        }
      });
      if (!entries.length) return null;

      /* determine lean from U days */
      var uEntries = entries.filter(function(e) { return e.mode === "U"; });
      var uPlus = uEntries.filter(function(e) { return e.outcome === OUT.PLUS; }).length;
      var uMinus = uEntries.length - uPlus;
      var lean = uPlus >= uMinus ? OUT.PLUS : OUT.MINUS;
      var leanLabel = lean === OUT.PLUS ? w.plus : w.minus;
      var otherLabel = lean === OUT.PLUS ? w.minus : w.plus;

      var isLean = function(o) { return o === lean; };

      /* stats */
      var uLeanCount = lean === OUT.PLUS ? uPlus : uMinus;
      var uLeanPct = uEntries.length ? Math.round((uLeanCount / uEntries.length) * 100) : 50;
      var totalLean = entries.filter(function(e) { return isLean(e.outcome); }).length;
      var overallPct = Math.round((totalLean / entries.length) * 100);
      var cDays = entries.filter(function(e) { return e.mode === "C"; }).length;

      /* longest U run of lean (C days break runs) */
      var maxRun = 0, curRun = 0;
      entries.forEach(function(e) {
        if (e.mode !== "U") { curRun = 0; return; }
        if (isLean(e.outcome)) { curRun++; if (curRun > maxRun) maxRun = curRun; }
        else curRun = 0;
      });

      /* longest U run of other */
      var maxRunOther = 0, curRunOther = 0;
      entries.forEach(function(e) {
        if (e.mode !== "U") { curRunOther = 0; return; }
        if (!isLean(e.outcome)) { curRunOther++; if (curRunOther > maxRunOther) maxRunOther = curRunOther; }
        else curRunOther = 0;
      });

      /* running lean ratio */
      var cumLean = 0;
      var runningData = entries.map(function(e, i) {
        if (isLean(e.outcome)) cumLean++;
        return { day: e.day, idx: i + 1, ratio: cumLean / (i + 1) };
      });

      return {
        wager: w,
        entries: entries,
        lean: lean,
        leanLabel: leanLabel,
        otherLabel: otherLabel,
        uTotal: uEntries.length,
        uLeanPct: uLeanPct,
        overallPct: overallPct,
        totalDays: entries.length,
        cDays: cDays,
        maxRunLean: maxRun,
        maxRunOther: maxRunOther,
        runningData: runningData,
      };
    }).filter(Boolean);
  }, [extWagers, extLedger]);

  /* ── Simulation ── */
  var results = useMemo(function() {
    if (seed === 0) return null;
    var r = {};
    SIM_PROFILES.forEach(function(p) { r[p.key] = simulate(p.bias, 365); });
    return r;
  }, [seed]);

  var run = function() {
    setRunning(true);
    setTimeout(function() { setSeed(function(s) { return s + 1; }); setRunning(false); }, 50);
  };

  var convergence = useMemo(function() {
    if (!results) return null;
    return Array.from({ length: 365 }, function(_, d) {
      var pt = { day: d + 1 };
      SIM_PROFILES.forEach(function(p) { pt[p.key] = results[p.key][d].cumRatio; });
      return pt;
    });
  }, [results]);

  var finals = useMemo(function() {
    if (!results) return null;
    return SIM_PROFILES.map(function(p, i) {
      var entries = results[p.key];
      var last = entries[entries.length - 1];
      var cDays = entries.filter(function(e) { return e.mode === "C"; }).length;
      var maxRun = 0, curRun = 0, prev = null;
      entries.forEach(function(e) {
        if (e.outcome === prev) curRun++; else { curRun = 1; prev = e.outcome; }
        if (curRun > maxRun) maxRun = curRun;
      });
      return Object.assign({}, p, { color: SIM_COLORS[i], finalRatio: last.cumRatio, cDays: cDays, longestRun: maxRun });
    });
  }, [results]);

  var hasLedgerData = extLoaded && wagerAnalysis.length > 0;

  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 4, margin: "20px 0 24px" }}>
        {[
          { id: "ledger", label: "Your Ledger" },
          { id: "simulate", label: "Simulate" },
        ].map(function(m) {
          return (
            <button key={m.id} onClick={function() { hapticTap(); setExtMode(m.id); }}
              style={{
                ...S.btn,
                fontSize: 13, fontWeight: 600,
                padding: "8px 20px",
                background: extMode === m.id ? COLOR.ink : "transparent",
                color: extMode === m.id ? COLOR.paper : COLOR.inkL,
                border: "1px solid " + (extMode === m.id ? COLOR.ink : COLOR.border),
              }}>
              {m.label}
            </button>
          );
        })}
      </div>

      {/* ═══ YOUR LEDGER ═══ */}
      {extMode === "ledger" && (
        <div>
          {!extLoaded ? null : !hasLedgerData ? (
            <div style={{ ...S.card, textAlign: "center", padding: 32 }}>
              <p style={{ ...S.muted }}>No entries yet. Flip a few days in Practice, then return here.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 20 }}>
              {wagerAnalysis.map(function(a) {
                var w = a.wager;
                var leanColor = a.lean === OUT.PLUS ? COLOR.green : COLOR.red;
                var otherColor = a.lean === OUT.PLUS ? COLOR.red : COLOR.green;

                return (
                  <div key={w.code} style={{ ...S.card, padding: 0, overflow: "hidden" }}>
                    {/* header */}
                    <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid " + COLOR.borderL }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                        <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 18, color: COLOR.ink }}>{w.code}</span>
                        <span style={{ fontSize: 14, color: COLOR.inkL }}>{w.name}</span>
                        <span style={{ ...S.tag, background: CAT_COLORS[w.category] + "12", color: CAT_COLORS[w.category], fontSize: 9, marginLeft: "auto" }}>{w.category}</span>
                      </div>
                      <p style={{ fontSize: 13, color: COLOR.inkL, margin: 0 }}>
                        You lean toward <strong style={{ color: leanColor }}>{a.leanLabel}</strong>
                        {a.uTotal > 0 ? " (" + a.uLeanPct + "% of unconstrained days)" : ""}
                      </p>
                    </div>

                    {/* stats */}
                    <div style={{ padding: "14px 20px", display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: COLOR.inkL, borderBottom: "1px solid " + COLOR.borderL }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", marginBottom: 2 }}>DAYS</div>
                        <strong style={{ color: COLOR.ink, fontSize: 17 }}>{a.totalDays}</strong>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", marginBottom: 2 }}>OVERALL</div>
                        <strong style={{ color: leanColor, fontSize: 17 }}>{a.overallPct}%</strong>
                        <span style={{ fontSize: 11, marginLeft: 3 }}>{a.leanLabel}</span>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", marginBottom: 2 }}>CONSTRAINED</div>
                        <strong style={{ color: COLOR.ink, fontSize: 17 }}>{a.cDays}</strong>
                        <span style={{ fontSize: 11, marginLeft: 3 }}>/ {a.totalDays}</span>
                      </div>
                      {(a.maxRunLean > 1 || a.maxRunOther > 1) && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", marginBottom: 2 }}>LONGEST U RUN</div>
                        <span style={{ color: leanColor }}><strong style={{ fontSize: 17 }}>{a.maxRunLean}</strong> <span style={{ fontSize: 11 }}>{a.leanLabel}</span></span>
                        <span style={{ margin: "0 6px", color: COLOR.borderL }}>/</span>
                        <span style={{ color: otherColor }}><strong style={{ fontSize: 17 }}>{a.maxRunOther}</strong> <span style={{ fontSize: 11 }}>{a.otherLabel}</span></span>
                      </div>
                      )}
                    </div>

                    {/* sequence strip */}
                    <div style={{ padding: "14px 20px", borderBottom: "1px solid " + COLOR.borderL }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: COLOR.inkL, marginBottom: 8 }}>SEQUENCE</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                        {a.entries.map(function(e, i) {
                          return (
                            <div key={i}
                              title={"Day " + e.day + ": " + e.mode + " " + fmtOutcome(e.outcome)}
                              style={{
                                width: 8, height: 8, borderRadius: 1,
                                background: e.outcome === OUT.PLUS ? COLOR.green : COLOR.red,
                                opacity: e.mode === "C" ? 0.4 : 1,
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* running ratio chart */}
                    {a.runningData.length > 2 && (
                      <div style={{ padding: "14px 20px 16px" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: COLOR.inkL, marginBottom: 8 }}>
                          RUNNING {a.leanLabel.toUpperCase()} RATIO
                        </div>
                        <ResponsiveContainer width="100%" height={180}>
                          <LineChart data={a.runningData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={COLOR.borderL} />
                            <XAxis dataKey="idx" tick={{ fontSize: 10, fill: COLOR.inkL }} label={{ value: "Day", position: "insideBottom", offset: -2, fontSize: 10, fill: COLOR.inkL }} />
                            <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tick={{ fontSize: 10, fill: COLOR.inkL }} tickFormatter={function(v) { return Math.round(v * 100) + "%"; }} />
                            <ReferenceLine y={0.5} stroke={COLOR.gold} strokeDasharray="4 4" strokeWidth={1.5} />
                            <Tooltip contentStyle={{ fontSize: 11, fontFamily: FONT.sans }} formatter={function(v) { return (v * 100).toFixed(1) + "% " + a.leanLabel; }} />
                            <Line type="monotone" dataKey="ratio" stroke={leanColor} strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* legend */}
              <div style={{ display: "flex", gap: 16, justifyContent: "center", fontSize: 12, color: COLOR.inkL, flexWrap: "wrap", padding: "0 0 8px" }}>
                <span>bright = full opacity {"\u00b7"} faded = constrained</span>
                <span>
                  <span style={{ display: "inline-block", width: 8, height: 1.5, background: COLOR.gold, marginRight: 4, verticalAlign: "middle" }} />
                  50% center line
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ SIMULATE ═══ */}
      {extMode === "simulate" && (
        <div>
          <div style={{ borderLeft: "3px solid " + COLOR.gold, paddingLeft: 20, margin: "0 0 28px" }}>
            <p style={{ ...S.muted, fontStyle: "italic" }}>
              Five agents run the same rules for one year with one wager. They differ only in what they choose when
              unconstrained. The ledger that results is neither random nor predictable {"\u2014"} it is the structure the
              rules produce when applied to a pattern of free choice.
            </p>
          </div>

          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <button onClick={run} disabled={running}
              style={{ ...S.btn, background: COLOR.ink, color: COLOR.paper, fontSize: 16, padding: "14px 48px", opacity: running ? 0.6 : 1 }}>
              {running ? "..." : results ? "Run Again" : "Simulate One Year"}
            </button>
          </div>

          {results && finals && (
            <>
              <div style={{ ...S.card, padding: "20px 20px 16px" }}>
                <h3 style={{ ...S.h3, margin: "0 0 4px" }}>The Year</h3>
                <p style={{ fontSize: 12, color: COLOR.inkL, margin: "0 0 14px" }}>Each row is 365 days. Color = outcome. Opacity = mode.</p>
                {SIM_PROFILES.map(function(p, i) {
                  return <SequenceStrip key={p.key} entries={results[p.key]} label={p.name} color={SIM_COLORS[i]} />;
                })}
              </div>

              <div style={{ ...S.card, padding: 20 }}>
                <h3 style={{ ...S.h3, margin: "0 0 4px" }}>First 30 Days</h3>
                <p style={{ fontSize: 12, color: COLOR.inkL, margin: "0 0 16px" }}>Hover for details.</p>
                {SIM_PROFILES.map(function(p, i) {
                  return (
                    <div key={p.key} style={{ marginBottom: 12 }}>
                      <div style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 13, color: SIM_COLORS[i], marginBottom: 4 }}>{p.name}</div>
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {results[p.key].slice(0, 30).map(function(e, j) {
                          return (
                            <div key={j}
                              title={"Day " + e.day + ": " + e.mode + fmtOutcome(e.outcome) + (e.invType ? " (" + e.invType + ")" : "")}
                              style={{
                                width: 22, height: 22, borderRadius: 3,
                                background: e.outcome === OUT.PLUS ? COLOR.green : COLOR.red,
                                opacity: e.mode === "C" ? 0.45 : 1,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 10, fontWeight: 700, color: COLOR.white, fontFamily: FONT.serif,
                              }}>
                              {e.mode}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ ...S.card, padding: 20 }}>
                <h3 style={{ ...S.h3, margin: "0 0 4px" }}>Convergence</h3>
                <p style={{ fontSize: 12, color: COLOR.inkL, margin: "0 0 16px" }}>Cumulative lean-side proportion over 365 days.</p>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={convergence}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLOR.borderL} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: COLOR.inkL }} />
                    <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tick={{ fontSize: 11, fill: COLOR.inkL }} tickFormatter={function(v) { return Math.round(v * 100) + "%"; }} />
                    <ReferenceLine y={0.5} stroke={COLOR.gold} strokeDasharray="4 4" strokeWidth={1.5} />
                    <Tooltip contentStyle={{ fontSize: 12, fontFamily: FONT.sans }} formatter={function(v) { return (v * 100).toFixed(1) + "%"; }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {SIM_PROFILES.map(function(p, i) {
                      return <Line key={p.key} type="monotone" dataKey={p.key} stroke={SIM_COLORS[i]} strokeWidth={2} dot={false} name={p.name} />;
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={{ ...S.card, padding: 20 }}>
                <h3 style={{ ...S.h3, margin: "0 0 16px" }}>Summary</h3>
                <div style={{ display: "grid", gap: 12 }}>
                  {finals.map(function(f) {
                    var overall = Math.round(f.finalRatio * 100);
                    var input = Math.round(f.bias * 100);
                    return (
                      <div key={f.key} style={{ padding: "14px 16px", borderRadius: 6, borderLeft: "3px solid " + f.color, background: f.color + "08" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                          <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 17, color: f.color }}>{f.name}</span>
                          <span style={{ fontSize: 12, color: COLOR.inkL }}>{f.note}</span>
                        </div>
                        <div style={{ display: "flex", gap: 20, fontSize: 13, color: COLOR.inkL, flexWrap: "wrap" }}>
                          <span>U input: <strong style={{ color: COLOR.ink }}>{input}% +</strong></span>
                          <span>Year-end: <strong style={{ color: f.color, fontSize: 15 }}>{overall}% +</strong></span>
                          <span>C days: <strong style={{ color: COLOR.ink }}>{f.cDays}</strong>/365</span>
                          <span>Longest run: <strong style={{ color: COLOR.ink }}>{f.longestRun}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   APP SHELL
   ═══════════════════════════════════════════════════ */

const TABS = [
  { id: "practice", label: "Practice" },
  { id: "extend", label: "Extend" },
];

export default function App() {
  var _tab = useState("practice"), tab = _tab[0], setTab = _tab[1];

  return (
    <div style={{
      fontFamily: FONT.sans,
      background: COLOR.paper,
      color: COLOR.ink,
      minHeight: "100vh",
      maxWidth: 900,
      margin: "0 auto",
      padding: "0 max(14px, env(safe-area-inset-right)) 0 max(14px, env(safe-area-inset-left))",
    }}>
      <style>{GLOBAL_CSS}</style>
      <header style={{ textAlign: "center", padding: "36px 0 8px" }}>
        <h1 style={{ fontFamily: FONT.serif, fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", color: COLOR.ink }}>ATDU</h1>
        <p style={{ ...S.muted, marginTop: 6, fontSize: 13 }}>A coin, a wager, a ledger.</p>
      </header>
      <nav style={{ display: "flex", justifyContent: "center", gap: 4, margin: "24px 0 8px", borderBottom: "1px solid " + COLOR.border, flexWrap: "wrap" }}>
        {TABS.map(function(t) {
          return (
            <button key={t.id} onClick={function() { hapticTap(); setTab(t.id); }}
              aria-current={tab === t.id ? "page" : undefined}
              className="tab-button"
              style={{
                fontFamily: FONT.sans, fontSize: 14, fontWeight: 600,
                padding: "12px clamp(20px, 5vw, 36px) 14px",
                background: "none", border: "none",
                borderBottom: "2px solid " + (tab === t.id ? COLOR.ink : "transparent"),
                color: tab === t.id ? COLOR.ink : COLOR.inkL,
                cursor: "pointer", transition: "all 0.15s",
                minHeight: 44,
              }}>
              {t.label}
            </button>
          );
        })}
      </nav>
      <main style={{ animation: "fadeIn 0.3s ease", paddingBottom: "max(40px, env(safe-area-inset-bottom))" }}>
        {tab === "practice" && <PracticeTab />}
        {tab === "extend" && <ExtendTab />}
      </main>
    </div>
  );
}
