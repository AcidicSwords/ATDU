import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine,
} from "recharts";
import {
  flipDay, reconciled, unresolvedCount, commitDay, stats,
  simulate, piTheory, PI_MIN, PI_MAX, exportText,
} from "./engine.js";

/* ═══════════════════════════════════════════════════
   TOKENS
   ═══════════════════════════════════════════════════ */

const C = {
  paper: "#f5f0e8",
  ink: "#2c2416",
  inkL: "#6b5d4d",
  sideA: "#4E6E8E",
  sideB: "#8E6E4E",
  gold: "#b68d40",
  border: "#d4c9b8",
  borderL: "#e8e0d2",
  white: "#ffffff",
  red: "#8A6565",
};

const FONT = {
  serif: "'Crimson Pro', Georgia, serif",
  sans: "'Source Sans 3', 'Helvetica Neue', sans-serif",
};

const SKEY = { wagers: "atdu2-w", ledger: "atdu2-l", day: "atdu2-d" };

const S = {
  h3: { fontFamily: FONT.serif, fontSize: 19, fontWeight: 600, margin: "0 0 12px", color: C.ink },
  muted: { fontSize: 13, lineHeight: 1.6, color: C.inkL },
  card: { background: C.white, border: "1px solid " + C.border, borderRadius: 8, padding: 20, marginBottom: 16 },
  btn: {
    fontFamily: FONT.sans, fontSize: 14, fontWeight: 600,
    padding: "12px 24px", borderRadius: 6, border: "none",
    cursor: "pointer", minHeight: 44,
  },
  ghostBtn: {
    fontFamily: FONT.sans, fontSize: 13, fontWeight: 600,
    padding: "8px 16px", borderRadius: 6, cursor: "pointer", minHeight: 36,
    background: "transparent", color: C.inkL, border: "1px solid " + C.border,
  },
  input: {
    fontFamily: FONT.sans, fontSize: 16, padding: "10px 12px",
    border: "1px solid " + C.border, borderRadius: 5,
    background: C.white, color: C.ink, outline: "none",
    width: "100%", boxSizing: "border-box",
  },
  label: {
    fontSize: 11, fontWeight: 600, color: C.inkL,
    textTransform: "uppercase", letterSpacing: "0.05em",
    display: "block", marginBottom: 4,
  },
  wrap: { overflowWrap: "anywhere", wordBreak: "break-word", minWidth: 0 },
  modeTag: {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
    textTransform: "uppercase", flexShrink: 0,
  },
};

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=Source+Sans+3:wght@400;600;700&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { min-height: 100%; }
html { -webkit-text-size-adjust: 100%; }
body { background: ${C.paper}; color: ${C.ink}; -webkit-tap-highlight-color: transparent; }
button, input { font: inherit; touch-action: manipulation; }
input { font-size: 16px !important; }
input:focus { border-color: ${C.gold} !important; box-shadow: 0 0 0 2px ${C.gold}30; }
::selection { background: ${C.gold}26; }
button { -webkit-user-select: none; user-select: none; }
button:active:not(:disabled) { transform: scale(0.97); }

@keyframes stampIn {
  0% { transform: scale(0.92); opacity: 0; }
  60% { transform: scale(1.03); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes coinSpin {
  0% { transform: rotateY(0deg); }
  100% { transform: rotateY(1800deg); }
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.stamp { animation: stampIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.fade { animation: fadeIn 0.4s ease both; }
.coin3d {
  width: 64px; height: 64px; border-radius: 50%;
  border: 2px solid ${C.ink}; background: ${C.paper};
  display: flex; align-items: center; justify-content: center;
  font-size: 26px; color: ${C.ink};
  animation: coinSpin 1.15s cubic-bezier(0.15, 0.6, 0.25, 1) both;
}
.sidebtn { transition: background 0.12s, color 0.12s, border-color 0.12s; }
`;

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */

const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;
function haptic(p) { if (canVibrate) { try { navigator.vibrate(p); } catch { /* no-op */ } } }

const normCode = (c) => (c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2);
const sideColor = (s) => (s === "A" ? C.sideA : C.sideB);
const sideText = (w, s) => (s === "A" ? w.a : w.b);
const todayISO = () => new Date().toISOString();

async function sGet(key) {
  try { const r = await window.storage.get(key); return r && r.value ? r.value : null; }
  catch { return null; }
}
async function sSet(key, value) {
  try { await window.storage.set(key, value); } catch { /* no-op */ }
}
async function sDel(key) {
  try { await window.storage.delete(key); } catch { /* no-op */ }
}
function parse(raw, fb) { try { return JSON.parse(raw); } catch { return fb; } }

/* ═══════════════════════════════════════════════════
   WAGER FORM — the four complement structures as guides
   ═══════════════════════════════════════════════════ */

const TYPES = [
  { key: "NOT", line: "One act: enact it, or do not.", pa: "X", pb: "not X" },
  { key: "BIFURCATION", line: "Same consequence, different path.", pa: "X via Y", pb: "X via Z" },
  { key: "ASYMPTOTE", line: "Extent against a boundary — the measure is in the act.", pa: "X at most n", pb: "X at least n" },
  { key: "PRECEDENCE", line: "Position against an anchor outside the act.", pa: "X before the anchor", pb: "X after the anchor" },
];

function WagerForm({ draft, onChange, onSubmit, onCancel, onRetire, lockCode, submitLabel }) {
  const set = (f, v) => onChange({ ...draft, [f]: v });
  const t = TYPES.find((x) => x.key === draft.type) || null;
  const valid = normCode(draft.code) && draft.name.trim() && draft.a.trim() && draft.b.trim();

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ width: 64, flexShrink: 0 }}>
          <label style={S.label}>Code</label>
          <input
            style={{ ...S.input, textAlign: "center", fontWeight: 700, textTransform: "uppercase", opacity: lockCode ? 0.6 : 1 }}
            maxLength={2} value={draft.code} disabled={lockCode}
            onChange={(e) => set("code", normCode(e.target.value))} placeholder="W" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={S.label}>Situation</label>
          <input style={S.input} value={draft.name}
            onChange={(e) => set("name", e.target.value)} placeholder="One situation" />
        </div>
      </div>

      <div>
        <label style={S.label}>Structure</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TYPES.map((x) => (
            <button key={x.key} onClick={() => { haptic(10); set("type", draft.type === x.key ? null : x.key); }}
              style={{
                ...S.ghostBtn, padding: "6px 12px", fontSize: 11, letterSpacing: "0.05em",
                background: draft.type === x.key ? C.ink : "transparent",
                color: draft.type === x.key ? C.paper : C.inkL,
                borderColor: draft.type === x.key ? C.ink : C.border,
              }}>
              {x.key}
            </button>
          ))}
        </div>
        {t && <p style={{ ...S.muted, fontSize: 12, margin: "6px 0 0" }}>{t.line}</p>}
      </div>

      <div>
        <label style={S.label}>Two sides — one situation, one differentiator, both realizable</label>
        <div style={{ display: "grid", gap: 8 }}>
          <input style={{ ...S.input, borderLeft: "3px solid " + C.sideA }} value={draft.a}
            onChange={(e) => set("a", e.target.value)} placeholder={t ? t.pa : "Side A"} />
          <input style={{ ...S.input, borderLeft: "3px solid " + C.sideB }} value={draft.b}
            onChange={(e) => set("b", e.target.value)} placeholder={t ? t.pb : "Side B"} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {onRetire && (
          <button onClick={onRetire} style={{ ...S.ghostBtn, color: C.red, borderColor: C.red + "40", marginRight: "auto" }}>
            Retire
          </button>
        )}
        {onCancel && <button onClick={onCancel} style={S.ghostBtn}>Cancel</button>}
        <button onClick={onSubmit} disabled={!valid}
          style={{ ...S.btn, background: valid ? C.ink : C.border, color: C.paper, fontSize: 13, padding: "8px 20px", cursor: valid ? "pointer" : "default" }}>
          {submitLabel || "Add"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   FLIP OVERLAY — Flip One: environmental. Flip Two: the coin.
   ═══════════════════════════════════════════════════ */

const GLYPHS = "◦●○◍◌∴∵·×+—";

function Scramble({ final, color, onDone }) {
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    let frame = 0;
    let delay = 36;
    let t = null;
    const tick = () => {
      frame++;
      if (frame > 12) {
        setText(final);
        setDone(true);
        haptic([15, 25]);
        onDone && onDone();
        return;
      }
      let s = "";
      for (let i = 0; i < final.length; i++) s += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      setText(s);
      delay *= 1.16; // deceleration: anticipation ramps as resolution approaches
      t = setTimeout(tick, delay);
    };
    t = setTimeout(tick, delay);
    return () => clearTimeout(t);
  }, [final, onDone]);
  return (
    <div style={{
      fontFamily: FONT.serif, fontSize: 26, fontWeight: 700, letterSpacing: "0.12em",
      color: done ? color : C.inkL, minHeight: 40, textAlign: "center",
    }}>
      {text}
    </div>
  );
}

function FlipOverlay({ dayNumber, wagers, results, onClose }) {
  // results: [{ code, mode, side, seed }]
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState("scramble"); // scramble | coin | landed | end
  const timer = useRef(null);
  const clearT = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  const r = results[idx] || null;
  const w = r ? wagers.find((x) => x.code === r.code) : null;

  const advance = useCallback(() => {
    clearT();
    if (idx + 1 < results.length) {
      setPhase("breath");
      timer.current = setTimeout(() => { setIdx(idx + 1); setPhase("scramble"); }, 340);
    } else setPhase("end");
  }, [idx, results.length]);

  const onScrambleDone = useCallback(() => {
    clearT();
    if (r && r.mode === "C" && r.side) {
      timer.current = setTimeout(() => setPhase("coin"), 350);
    } else {
      setPhase("landed");
      timer.current = setTimeout(advance, 900);
    }
  }, [r, advance]);

  useEffect(() => {
    if (phase === "coin") {
      clearT();
      timer.current = setTimeout(() => {
        haptic([20, 40, 60]);
        setPhase("landed");
        timer.current = setTimeout(advance, 1050);
      }, 1180);
    }
    return clearT;
  }, [phase, advance]);

  useEffect(() => () => clearT(), []);

  const tap = () => {
    if (phase === "end") { onClose(); return; }
    advance();
  };

  return (
    <div onClick={tap} style={{
      position: "fixed", inset: 0, background: C.paper, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, cursor: "pointer",
    }}>
      {phase === "end" || !r ? (
        <div className="stamp" style={{ textAlign: "center" }}>
          <div style={{ fontFamily: FONT.serif, fontSize: 30, fontWeight: 700, color: C.ink }}>Day {dayNumber}</div>
          <div style={{ ...S.muted, marginTop: 10 }}>tap to close</div>
        </div>
      ) : (
        <div style={{ textAlign: "center", maxWidth: 480, width: "100%" }}>
          <div style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 20, color: C.ink }}>{r.code}</div>
          {w && <div style={{ ...S.muted, ...S.wrap, marginBottom: 22 }}>{w.name}</div>}

          {phase === "breath" ? (
            <div style={{ minHeight: 40 }} />
          ) : (
            <Scramble key={idx} final={r.mode === "O" ? "OPEN" : "CONSTRAINED"}
              color={r.mode === "O" ? C.gold : C.ink} onDone={onScrambleDone} />
          )}

          {phase === "coin" && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 22 }}>
              <div className="coin3d">●</div>
            </div>
          )}

          {phase === "landed" && (
            <div style={{ marginTop: 22, minHeight: 34 }}>
              {r.mode === "C" && r.side && w && (
                <div className="stamp" style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 19, color: C.ink, ...S.wrap }}>
                  {sideText(w, r.side)}
                </div>
              )}
              {r.mode === "C" && r.seed && (
                <div className="fade" style={{ ...S.muted }}>first — resolve today</div>
              )}
              {r.mode === "O" && (
                <div className="fade" style={{ ...S.muted }}>resolve today</div>
              )}
            </div>
          )}

          <div style={{ ...S.muted, fontSize: 11, marginTop: 36, opacity: 0.6 }}>
            {idx + 1} / {results.length} · tap to advance
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TODAY
   ═══════════════════════════════════════════════════ */

function TodayTab({ wagers, ledger, day, saveDay, saveLedger, goWagers }) {
  const [overlay, setOverlay] = useState(null); // { dayNumber, results }
  const [landed, setLanded] = useState(false);
  const active = wagers.filter((w) => !w.retired);
  const inDay = day ? active.filter((w) => day.wagers[w.code]) : [];
  const pending = day ? active.filter((w) => !day.wagers[w.code]) : [];

  const setSide = (code, side) => {
    haptic(12);
    const cur = day.wagers[code];
    saveDay({ ...day, wagers: { ...day.wagers, [code]: { ...cur, side, nulled: false } } });
  };
  const setNull = (code, nulled) => {
    haptic(10);
    const cur = day.wagers[code];
    const next = { ...cur, nulled };
    if (nulled && (cur.mode === "O" || cur.seed)) next.side = null;
    saveDay({ ...day, wagers: { ...day.wagers, [code]: next } });
  };

  const doFlip = () => {
    if (day && !reconciled(day)) return;
    haptic([40, 30, 40]);
    const newLedger = day ? commitDay(day, ledger) : ledger;
    const flipped = flipDay(active.map((w) => w.code), newLedger);
    const nextNumber = (day ? day.day : newLedger.length) + 1;
    const nextDay = { day: nextNumber, date: todayISO(), wagers: flipped };
    saveLedger(newLedger);
    saveDay(nextDay);
    setOverlay({
      dayNumber: nextNumber,
      results: active.map((w) => ({ code: w.code, ...flipped[w.code] })),
    });
  };

  if (!active.length) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <p style={{ ...S.muted, marginBottom: 20 }}>No wagers.</p>
        <button onClick={goWagers} style={{ ...S.btn, background: C.ink, color: C.paper }}>Wagers</button>
      </div>
    );
  }

  const remaining = unresolvedCount(day);
  const canFlip = !day || remaining === 0;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      {day && (
        <div style={{ textAlign: "center", margin: "24px 0 16px" }}>
          <span style={{ fontFamily: FONT.serif, fontSize: 15, color: C.inkL, letterSpacing: "0.04em" }}>
            Day {day.day}
          </span>
        </div>
      )}

      {!day && (
        <div style={{ textAlign: "center", padding: "40px 0 24px" }}>
          <p style={{ ...S.muted, marginBottom: 20 }}>Day 1 has not been flipped.</p>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {inDay.map((w, wi) => {
          const st = day.wagers[w.code];
          const openLike = st.mode === "O" || (st.seed && !st.nulled);
          return (
            <div key={w.code} className={landed ? "stamp" : undefined}
              style={{ ...S.card, marginBottom: 0, opacity: st.nulled ? 0.55 : 1, animationDelay: landed ? (wi * 70) + "ms" : undefined }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, minWidth: 0 }}>
                <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 17, flexShrink: 0 }}>{w.code}</span>
                <span style={{ ...S.muted, ...S.wrap, flex: 1 }}>{w.name}</span>
                <span style={{
                  ...S.modeTag,
                  color: st.nulled ? C.inkL : st.mode === "O" ? C.gold : C.inkL,
                }}>
                  {st.nulled ? "null" : st.mode === "O" ? "open" : st.seed ? "constrained · first" : "constrained"}
                </span>
              </div>

              {st.nulled ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ ...S.muted }}>No step.</span>
                  <button onClick={() => setNull(w.code, false)} style={{ ...S.ghostBtn, padding: "6px 12px", fontSize: 12, minHeight: 32 }}>Undo</button>
                </div>
              ) : openLike ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {["A", "B"].map((s) => {
                    const sel = st.side === s;
                    return (
                      <button key={s} className="sidebtn" onClick={() => setSide(w.code, s)}
                        style={{
                          ...S.btn, ...S.wrap, textAlign: "left", fontWeight: 600, fontSize: 14,
                          background: sel ? C.ink : "transparent",
                          color: sel ? C.paper : C.ink,
                          border: "2px solid " + (sel ? C.ink : C.border),
                          borderLeft: "4px solid " + sideColor(s),
                          whiteSpace: "normal",
                        }}>
                        {sideText(w, s)}
                      </button>
                    );
                  })}
                  <div style={{ textAlign: "right" }}>
                    <button onClick={() => setNull(w.code, true)}
                      style={{ background: "none", border: "none", color: C.inkL, fontSize: 12, cursor: "pointer", padding: "4px 2px", fontFamily: FONT.sans }}>
                      Null
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{
                    fontFamily: FONT.serif, fontWeight: 700, fontSize: 17, ...S.wrap,
                    borderLeft: "4px solid " + sideColor(st.side), paddingLeft: 10,
                  }}>
                    {sideText(w, st.side)}
                  </div>
                  <div style={{ textAlign: "right", marginTop: 6 }}>
                    <button onClick={() => setNull(w.code, true)}
                      style={{ background: "none", border: "none", color: C.inkL, fontSize: 12, cursor: "pointer", padding: "4px 2px", fontFamily: FONT.sans }}>
                      Null
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {pending.length > 0 && day && (
        <p style={{ ...S.muted, fontSize: 12, textAlign: "center", marginTop: 12 }}>
          Enters at the next flip: {pending.map((w) => w.code).join(" · ")}
        </p>
      )}

      <div style={{ textAlign: "center", margin: "28px 0 8px" }}>
        <button onClick={doFlip} disabled={!canFlip} aria-label="Flip"
          style={{
            width: 76, height: 76, borderRadius: "50%", border: "none",
            background: canFlip ? C.ink : C.border, color: C.paper,
            fontSize: 26, cursor: canFlip ? "pointer" : "default",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
          ●
        </button>
        <p style={{ fontFamily: FONT.serif, fontSize: 14, color: canFlip ? C.ink : C.inkL, marginTop: 8, letterSpacing: "0.03em" }}>
          Flip — Day {(day ? day.day : ledger.length) + 1}
        </p>
        {!canFlip && (
          <p style={{ ...S.muted, fontSize: 12, marginTop: 4 }}>
            {remaining} unresolved — every wager needs a side or null.
          </p>
        )}
      </div>

      <div style={{ height: 32 }} />
      {overlay && (
        <FlipOverlay dayNumber={overlay.dayNumber} wagers={wagers}
          results={overlay.results}
          onClose={() => { setOverlay(null); setLanded(true); setTimeout(() => setLanded(false), 800); }} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   WAGERS
   ═══════════════════════════════════════════════════ */

const EMPTY_DRAFT = { code: "", name: "", a: "", b: "", type: null };

function WagersTab({ wagers, saveWagers, day, saveDay }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editCode, setEditCode] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const active = wagers.filter((w) => !w.retired);
  const retired = wagers.filter((w) => w.retired);

  const add = () => {
    const c = { ...draft, code: normCode(draft.code) };
    if (!c.code || !c.name.trim() || !c.a.trim() || !c.b.trim()) return;
    if (wagers.some((w) => w.code === c.code)) return;
    haptic([20, 40]);
    saveWagers([...wagers, { ...c, retired: false }]);
    setDraft(EMPTY_DRAFT);
    setAdding(false);
  };

  const saveEdit = () => {
    if (!editDraft || !editDraft.name.trim() || !editDraft.a.trim() || !editDraft.b.trim()) return;
    saveWagers(wagers.map((w) => (w.code === editCode ? { ...w, ...editDraft } : w)));
    setEditCode(null); setEditDraft(null);
  };

  const retire = (code) => {
    saveWagers(wagers.map((w) => (w.code === code ? { ...w, retired: true } : w)));
    if (day && day.wagers[code]) {
      const nw = { ...day.wagers }; delete nw[code];
      saveDay({ ...day, wagers: nw });
    }
    setEditCode(null); setEditDraft(null);
  };

  const restore = (code) => {
    saveWagers(wagers.map((w) => (w.code === code ? { ...w, retired: false } : w)));
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", paddingTop: 24 }}>
      <div style={{ display: "grid", gap: 8 }}>
        {active.map((w) =>
          editCode === w.code ? (
            <div key={w.code} style={{ ...S.card, marginBottom: 0, borderLeft: "3px solid " + C.gold }}>
              <WagerForm draft={editDraft} onChange={setEditDraft} onSubmit={saveEdit}
                onCancel={() => { setEditCode(null); setEditDraft(null); }}
                onRetire={() => retire(w.code)} lockCode submitLabel="Save" />
            </div>
          ) : (
            <div key={w.code} style={{ ...S.card, marginBottom: 0, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
                <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{w.code}</span>
                <span style={{ ...S.muted, ...S.wrap, flex: 1 }}>{w.name}</span>
                {w.type && <span style={{ ...S.modeTag, color: C.inkL, opacity: 0.7 }}>{w.type}</span>}
                <button onClick={() => { setEditCode(w.code); setEditDraft({ name: w.name, a: w.a, b: w.b, type: w.type || null, code: w.code }); setAdding(false); }}
                  style={{ background: "none", border: "none", color: C.inkL, cursor: "pointer", fontSize: 13, opacity: 0.6, minWidth: 32, minHeight: 32 }}>
                  ✎
                </button>
              </div>
              <div style={{ fontSize: 13, marginTop: 6, display: "flex", alignItems: "baseline", minWidth: 0, gap: 8 }}>
                <span style={{ ...S.wrap, borderLeft: "3px solid " + C.sideA, paddingLeft: 8 }}>{w.a}</span>
                <span style={{ color: C.border, flexShrink: 0 }}>·</span>
                <span style={{ ...S.wrap, borderLeft: "3px solid " + C.sideB, paddingLeft: 8 }}>{w.b}</span>
              </div>
            </div>
          )
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        {adding ? (
          <div style={{ ...S.card, borderLeft: "3px solid " + C.gold }}>
            <WagerForm draft={draft} onChange={setDraft} onSubmit={add} onCancel={() => setAdding(false)} />
            <p style={{ ...S.muted, fontSize: 12, marginTop: 10 }}>A new wager enters at the next flip.</p>
          </div>
        ) : (
          <button onClick={() => { setAdding(true); setEditCode(null); }} style={{ ...S.ghostBtn, width: "100%", minHeight: 44 }}>
            {active.length ? "Add a wager" : "Place the first wager"}
          </button>
        )}
      </div>

      {retired.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <p style={{ ...S.label, marginBottom: 8 }}>Retired</p>
          <div style={{ display: "grid", gap: 6 }}>
            {retired.map((w) => (
              <div key={w.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 6, background: C.ink + "06", minWidth: 0 }}>
                <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 14, color: C.inkL, flexShrink: 0 }}>{w.code}</span>
                <span style={{ ...S.muted, ...S.wrap, fontSize: 12, flex: 1 }}>{w.name}</span>
                <button onClick={() => restore(w.code)} style={{ background: "none", border: "none", color: C.inkL, fontSize: 12, cursor: "pointer", fontFamily: FONT.sans }}>
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ height: 32 }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   LEDGER
   ═══════════════════════════════════════════════════ */

function Band({ pHat, piHat }) {
  const pct = (v) => (v * 100).toFixed(2) + "%";
  const theory = pHat == null ? null : piTheory(pHat);
  return (
    <div style={{ padding: "14px 4px 4px" }}>
      <div style={{ position: "relative", height: 26 }}>
        <div style={{ position: "absolute", top: 11, left: 0, right: 0, height: 4, background: C.borderL, borderRadius: 2 }} />
        <div style={{ position: "absolute", top: 11, left: pct(PI_MIN), width: pct(PI_MAX - PI_MIN), height: 4, background: C.gold + "40", borderRadius: 2 }} />
        {[PI_MIN, 0.5, PI_MAX].map((v, i) => (
          <div key={i} style={{ position: "absolute", top: 8, left: pct(v), width: 1, height: 10, background: C.inkL, opacity: 0.5 }} />
        ))}
        {theory != null && (
          <div title="π(p̂) = (2+3p̂)/7" style={{
            position: "absolute", top: 6, left: `calc(${pct(theory)} - 7px)`,
            width: 12, height: 12, borderRadius: "50%", border: "2px solid " + C.ink, background: C.paper,
          }} />
        )}
        {piHat != null && (
          <div title="π̂ — ledger rate to A" style={{
            position: "absolute", top: 8, left: `calc(${pct(piHat)} - 4px)`,
            width: 9, height: 9, borderRadius: "50%", background: C.ink,
          }} />
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.inkL }}>
        <span>0</span><span style={{ position: "relative", left: "-6%" }}>2/7</span>
        <span>1/2</span>
        <span style={{ position: "relative", right: "-4%" }}>5/7</span><span>1</span>
      </div>
    </div>
  );
}

function LedgerTab({ wagers, ledger }) {
  const [expanded, setExpanded] = useState(false);
  const [sel, setSel] = useState(null);

  const cols = useMemo(() => {
    const codesInLedger = new Set();
    ledger.forEach((d) => Object.keys(d.entries).forEach((c) => codesInLedger.add(c)));
    const act = wagers.filter((w) => !w.retired);
    const ret = wagers.filter((w) => w.retired && codesInLedger.has(w.code));
    return [...act, ...ret];
  }, [wagers, ledger]);

  const doExport = () => {
    const text = exportText(wagers, ledger);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "atdu-ledger.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  if (!ledger.length) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <p style={S.muted}>The ledger is empty. It fills at the first flip.</p>
      </div>
    );
  }

  const rows = (expanded ? ledger : ledger.slice(-10)).slice().reverse();
  const selW = cols.find((w) => w.code === sel) || cols[0];
  const st = selW ? stats(ledger, selW.code) : null;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", paddingTop: 24 }}>
      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: "10px 10px 6px", borderBottom: "2px solid " + C.ink, textAlign: "left", fontWeight: 700, fontSize: 11, color: C.inkL }}>day</th>
                {cols.map((w) => (
                  <th key={w.code} title={w.name}
                    style={{ padding: "10px 8px 6px", borderBottom: "2px solid " + C.ink, textAlign: "center", fontFamily: FONT.serif, fontWeight: 700, fontSize: 13, opacity: w.retired ? 0.45 : 1 }}>
                    {w.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.day} style={{ borderBottom: "1px solid " + C.borderL }}>
                  <td style={{ padding: "7px 10px", fontWeight: 600, fontSize: 12, color: C.inkL }}>
                    {String(d.day).padStart(2, "0")}
                  </td>
                  {cols.map((w) => {
                    const e = d.entries[w.code];
                    if (!e) return <td key={w.code} />;
                    if (e.null) return <td key={w.code} style={{ textAlign: "center", color: C.inkL, opacity: 0.5, fontSize: 12 }}>—</td>;
                    return (
                      <td key={w.code} style={{ textAlign: "center", padding: "7px 6px" }}
                        title={`${sideText(w, e.side)} (${e.mode === "O" ? "open" : "constrained"})`}>
                        <span style={{
                          display: "inline-block", width: 13, height: 13, borderRadius: 3,
                          background: sideColor(e.side), opacity: e.mode === "O" ? 1 : 0.45,
                        }} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ledger.length > 10 && (
          <button onClick={() => setExpanded((p) => !p)}
            style={{ display: "block", width: "100%", padding: 8, fontSize: 12, color: C.inkL, background: "none", border: "none", borderTop: "1px solid " + C.borderL, cursor: "pointer", fontFamily: FONT.sans, fontWeight: 600 }}>
            {expanded ? "Recent" : `All ${ledger.length} days`}
          </button>
        )}
        <div style={{ padding: "8px 14px 12px", display: "flex", gap: 14, justifyContent: "center", fontSize: 11, color: C.inkL, flexWrap: "wrap", borderTop: "1px solid " + C.borderL }}>
          <span><i style={{ display: "inline-block", width: 8, height: 8, background: C.sideA, borderRadius: 2, marginRight: 4 }} />A</span>
          <span><i style={{ display: "inline-block", width: 8, height: 8, background: C.sideB, borderRadius: 2, marginRight: 4 }} />B</span>
          <span>solid = open · faded = constrained · — = null</span>
        </div>
      </div>

      {selW && st && st.n > 0 && (
        <div style={{ ...S.card }}>
          {cols.length > 1 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {cols.map((w) => (
                <button key={w.code} onClick={() => setSel(w.code)}
                  style={{
                    ...S.ghostBtn, padding: "5px 12px", fontSize: 12, minHeight: 32,
                    background: selW.code === w.code ? C.ink : "transparent",
                    color: selW.code === w.code ? C.paper : C.inkL,
                    borderColor: selW.code === w.code ? C.ink : C.border,
                  }}>
                  {w.code}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 18, fontSize: 12, color: C.inkL, flexWrap: "wrap" }}>
            <span>steps <strong style={{ color: C.ink, fontSize: 15 }}>{st.n}</strong></span>
            <span>open <strong style={{ color: C.ink, fontSize: 15 }}>{st.nO}</strong></span>
            <span>constrained <strong style={{ color: C.ink, fontSize: 15 }}>{st.nC}</strong></span>
            <span>null <strong style={{ color: C.ink, fontSize: 15 }}>{st.nNull}</strong></span>
            {st.pHat != null && <span title="open-resolution rate to A">p̂ <strong style={{ color: C.ink, fontSize: 15 }}>{(st.pHat * 100).toFixed(0)}%</strong></span>}
            {st.piHat != null && <span title="ledger rate to A">π̂ <strong style={{ color: C.ink, fontSize: 15 }}>{(st.piHat * 100).toFixed(0)}%</strong></span>}
          </div>

          <Band pHat={st.pHat} piHat={st.piHat} />

          {st.series.length > 2 && (
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={st.series} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.borderL} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.inkL }} />
                <YAxis domain={[0, 1]} ticks={[PI_MIN, 0.5, PI_MAX]} tick={{ fontSize: 10, fill: C.inkL }}
                  tickFormatter={(v) => (Math.abs(v - 0.5) < 0.01 ? "1/2" : Math.abs(v - PI_MIN) < 0.01 ? "2/7" : "5/7")} />
                <ReferenceLine y={PI_MIN} stroke={C.inkL} strokeDasharray="4 4" strokeWidth={1} />
                <ReferenceLine y={0.5} stroke={C.gold} strokeDasharray="4 4" strokeWidth={1.5} />
                <ReferenceLine y={PI_MAX} stroke={C.inkL} strokeDasharray="4 4" strokeWidth={1} />
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: FONT.sans }}
                  formatter={(v) => (v * 100).toFixed(1) + "%"} labelFormatter={(l) => "day " + l} />
                <Line type="monotone" dataKey="pi" stroke={C.ink} strokeWidth={1.5} dot={false} name="π̂" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <button onClick={doExport} style={S.ghostBtn}>Export ledger</button>
      </div>
      <div style={{ height: 32 }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SYSTEM
   ═══════════════════════════════════════════════════ */

const SIM_PS = [0, 0.25, 0.5, 0.75, 1];
const SIM_COLORS = ["#7A5A45", "#9A7A60", "#8A8565", "#5A8A72", "#4A7585"];

function SystemTab({ onReset }) {
  const [runId, setRunId] = useState(0);

  const sim = useMemo(() => {
    if (!runId) return null;
    return SIM_PS.map((p) => ({ p, series: simulate(p, 365) }));
  }, [runId]);

  const chart = useMemo(() => {
    if (!sim) return null;
    return Array.from({ length: 365 }, (_, i) => {
      const pt = { t: i + 1 };
      sim.forEach((s) => { pt["p" + s.p] = s.series[i].pi; });
      return pt;
    });
  }, [sim]);

  const rules = [
    "A wager is two sides of one situation — mutually exclusive, sharing a boundary, one differentiator.",
    "Each day, Flip One: Open or Constrained. Environmental uncertainty, fair.",
    "Open — you resolve the side.",
    "Constrained — Flip Two: heads inverts Last, tails inverts Last Constrained. The coin resolves.",
    "The first constrained resolves open and is recorded as constrained, so memory has a value to invert.",
    "Null — a side unavailable, or the wager not live: no step, no memory update, no weight.",
    "The day must be fully reconciled — every wager a side or null — before the next flip.",
    "The ledger records mode and side. It is append-only.",
  ];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", paddingTop: 24 }}>
      <div style={S.card}>
        <h3 style={S.h3}>The rule</h3>
        <div style={{ display: "grid", gap: 8 }}>
          {rules.map((r, i) => (
            <p key={i} style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>{r}</p>
          ))}
        </div>
        <p style={{ fontFamily: FONT.serif, fontSize: 16, marginTop: 14, textAlign: "center" }}>
          π = (2 + 3p) / 7&nbsp;&nbsp;·&nbsp;&nbsp;2/7 ≤ π ≤ 5/7
        </p>
      </div>

      <div style={S.card}>
        <h3 style={S.h3}>Simulation</h3>
        <p style={{ ...S.muted, marginBottom: 14 }}>
          The rule is deterministic. The coin is uniform. p is the open-resolution rate toward side A.
          One year at p = 0, ¼, ½, ¾, 1.
        </p>
        <div style={{ textAlign: "center", marginBottom: sim ? 16 : 0 }}>
          <button onClick={() => setRunId((s) => s + 1)}
            style={{ ...S.btn, background: C.ink, color: C.paper, fontSize: 14, padding: "12px 36px" }}>
            {sim ? "Run again" : "Run"}
          </button>
        </div>

        {sim && chart && (
          <>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.borderL} />
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: C.inkL }} />
                <YAxis domain={[0, 1]} ticks={[PI_MIN, 0.5, PI_MAX]} tick={{ fontSize: 10, fill: C.inkL }}
                  tickFormatter={(v) => (Math.abs(v - 0.5) < 0.01 ? "1/2" : Math.abs(v - PI_MIN) < 0.01 ? "2/7" : "5/7")} />
                {SIM_PS.map((p, i) => (
                  <ReferenceLine key={"th" + p} y={piTheory(p)} stroke={SIM_COLORS[i]} strokeDasharray="2 4" strokeWidth={1} />
                ))}
                <Tooltip contentStyle={{ fontSize: 11, fontFamily: FONT.sans }}
                  formatter={(v) => (v * 100).toFixed(1) + "%"} labelFormatter={(l) => "step " + l} />
                {SIM_PS.map((p, i) => (
                  <Line key={"p" + p} type="monotone" dataKey={"p" + p} stroke={SIM_COLORS[i]}
                    strokeWidth={1.8} dot={false} name={"p=" + p} />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <table style={{ width: "100%", marginTop: 10, fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: C.inkL }}>
                  <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 600 }}>p</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", fontWeight: 600 }}>π̂ (365)</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", fontWeight: 600 }}>(2+3p)/7</th>
                </tr>
              </thead>
              <tbody>
                {sim.map((s, i) => (
                  <tr key={s.p} style={{ borderTop: "1px solid " + C.borderL }}>
                    <td style={{ padding: "5px 6px", color: SIM_COLORS[i], fontWeight: 700 }}>{s.p}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right" }}>{(s.series[364].pi * 100).toFixed(1)}%</td>
                    <td style={{ padding: "5px 6px", textAlign: "right", color: C.inkL }}>{(piTheory(s.p) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div style={{ ...S.card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={S.muted}>Erase all wagers and the ledger.</span>
        <button onClick={onReset} style={{ ...S.ghostBtn, color: C.red, borderColor: C.red + "40" }}>Reset</button>
      </div>
      <div style={{ height: 32 }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   APP
   ═══════════════════════════════════════════════════ */

const TABS = [
  { id: "today", label: "Today" },
  { id: "wagers", label: "Wagers" },
  { id: "ledger", label: "Ledger" },
  { id: "system", label: "System" },
];

export default function App() {
  const [tab, setTab] = useState(null);
  const [wagers, setWagers] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [day, setDay] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
      } catch { /* no-op */ }
      const w = parse(await sGet(SKEY.wagers), []) || [];
      const l = parse(await sGet(SKEY.ledger), []) || [];
      const d = parse(await sGet(SKEY.day), null);
      setWagers(Array.isArray(w) ? w : []);
      setLedger(Array.isArray(l) ? l : []);
      setDay(d && d.day ? d : null);
      setTab(Array.isArray(w) && w.some((x) => !x.retired) ? "today" : "wagers");
      setLoaded(true);
    })();
  }, []);

  const saveWagers = useCallback((w) => { setWagers(w); sSet(SKEY.wagers, JSON.stringify(w)); }, []);
  const saveLedger = useCallback((l) => { setLedger(l); sSet(SKEY.ledger, JSON.stringify(l)); }, []);
  const saveDay = useCallback((d) => {
    setDay(d);
    if (d) sSet(SKEY.day, JSON.stringify(d)); else sDel(SKEY.day);
  }, []);

  const reset = () => {
    if (!window.confirm("Erase all wagers and the ledger? This cannot be undone.")) return;
    saveWagers([]); saveLedger([]); saveDay(null);
    setTab("wagers");
  };

  if (!loaded) return null;

  return (
    <div style={{
      fontFamily: FONT.sans, background: C.paper, color: C.ink, minHeight: "100vh",
      maxWidth: 900, margin: "0 auto",
      padding: "0 max(14px, env(safe-area-inset-right)) 0 max(14px, env(safe-area-inset-left))",
    }}>
      <style>{GLOBAL_CSS}</style>
      <header style={{ textAlign: "center", padding: "32px 0 4px" }}>
        <h1 style={{ fontFamily: FONT.serif, fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em" }}>ATDU</h1>
        <p style={{ ...S.muted, marginTop: 4, fontSize: 12 }}>A wager. A coin. A ledger.</p>
      </header>
      <nav style={{ display: "flex", justifyContent: "center", gap: 2, margin: "18px 0 4px", borderBottom: "1px solid " + C.border }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { haptic(8); setTab(t.id); }}
            aria-current={tab === t.id ? "page" : undefined}
            style={{
              ...S.btn, fontSize: 13, padding: "10px 18px", background: "transparent",
              borderRadius: "6px 6px 0 0", minHeight: 40,
              color: tab === t.id ? C.ink : C.inkL,
              borderBottom: tab === t.id ? "2px solid " + C.ink : "2px solid transparent",
              fontWeight: tab === t.id ? 700 : 400,
            }}>
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "today" && (
        <TodayTab wagers={wagers} ledger={ledger} day={day}
          saveDay={saveDay} saveLedger={saveLedger} goWagers={() => setTab("wagers")} />
      )}
      {tab === "wagers" && (
        <WagersTab wagers={wagers} saveWagers={saveWagers} day={day} saveDay={saveDay} />
      )}
      {tab === "ledger" && <LedgerTab wagers={wagers} ledger={ledger} />}
      {tab === "system" && <SystemTab onReset={reset} />}
    </div>
  );
}
