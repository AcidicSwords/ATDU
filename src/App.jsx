import { useState, useEffect, useCallback, useMemo } from "react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, ReferenceLine,
} from "recharts";

/* ═══════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════ */

const COLOR = {
  paper: "#f5f0e8",
  ink: "#2c2416",
  inkL: "#6b5d4d",
  sideA: "#4E6E8E",
  sideB: "#8E6E4E",
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
const CAT_COLORS = { Habit: COLOR.inkL, Contested: COLOR.gold, "Planned Not Taken": "#8A6565" };
const SKEY = { wagers: "atdu-w", ledger: "atdu-l", today: "atdu-t" };

const S = {
  h3: { fontFamily: FONT.serif, fontSize: 19, fontWeight: 600, margin: "24px 0 12px", color: COLOR.ink },
  p: { fontSize: 15, lineHeight: 1.7, margin: "0 0 14px", color: COLOR.ink },
  muted: { fontSize: 14, lineHeight: 1.7, color: COLOR.inkL },
  tag: {
    display: "inline-block", fontSize: 12, fontWeight: 600,
    letterSpacing: "0.06em", textTransform: "uppercase",
    padding: "6px 12px", borderRadius: 4, minHeight: 36,
  },
  card: { background: COLOR.white, border: "1px solid " + COLOR.border, borderRadius: 8, padding: 24, marginBottom: 20 },
  btn: {
    fontFamily: FONT.sans, fontSize: 14, fontWeight: 600,
    padding: "12px 24px", borderRadius: 6, border: "none",
    cursor: "pointer", transition: "all 0.15s", minHeight: 44,
  },
  input: {
    fontFamily: FONT.sans, fontSize: 16, padding: "10px 12px",
    border: "1px solid " + COLOR.border, borderRadius: 5,
    background: COLOR.white, color: COLOR.ink, outline: "none",
    width: "100%", boxSizing: "border-box",
  },
  label: {
    fontSize: 11, fontWeight: 600, color: COLOR.inkL,
    textTransform: "uppercase", letterSpacing: "0.05em",
    display: "block", marginBottom: 4,
  },
};

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=Source+Sans+3:wght@400;600;700&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { min-height: 100%; }
html { -webkit-text-size-adjust: 100%; }
body { background: ${COLOR.paper}; color: ${COLOR.ink}; -webkit-tap-highlight-color: transparent; }
button, input { font: inherit; touch-action: manipulation; }
input { font-size: 16px !important; }
input:focus { border-color: ${COLOR.gold} !important; box-shadow: 0 0 0 2px ${COLOR.gold}30; }
::selection { background: ${COLOR.goldFade}; }
table tr:last-child { border-bottom: none !important; }
button { touch-action: manipulation; -webkit-user-select: none; user-select: none; }
button:active { transform: scale(0.97); }
button:active:not(:disabled) { opacity: 0.85; }

@keyframes landIn {
  0% { transform: scale(0.92); opacity: 0; }
  60% { transform: scale(1.02); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes coinSpin { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(1800deg); } }
@keyframes pulseOnce {
  0% { box-shadow: 0 0 0 0 ${COLOR.gold}40; }
  70% { box-shadow: 0 0 0 10px ${COLOR.gold}00; }
  100% { box-shadow: 0 0 0 0 ${COLOR.gold}00; }
}

.today-card { padding: 20px; border-radius: 8px; background: ${COLOR.white}; border: 1px solid ${COLOR.border}; transition: all 0.15s ease; }
.today-card.revealed { animation: landIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.today-card.assigned { border-left: 3px solid ${COLOR.inkL}40; background: ${COLOR.ink}03; }
.flip-btn { min-height: 48px; min-width: 120px; transition: all 0.15s ease; position: relative; overflow: hidden; }
.flip-btn:active:not(:disabled) { transform: scale(0.95) !important; }
.flip-btn.flipping { animation: pulseOnce 0.6s ease-out; }
.coin-icon { display: inline-block; transition: transform 0.1s; }
.coin-icon.spinning { animation: coinSpin 0.6s cubic-bezier(0.2, 0.8, 0.3, 1); }
.category-btn { min-height: 36px; transition: all 0.12s ease; }
.category-btn:active { transform: scale(0.95) !important; }
.action-btn { min-height: 48px; transition: all 0.12s ease; }
.action-btn:active { transform: scale(0.93) !important; }
.toggle-btn { display: flex; justify-content: center; padding: 8px; font-size: 12px; color: ${COLOR.inkL}; cursor: pointer; background: none; border: none; width: 100%; font-family: ${FONT.sans}; font-weight: 600; min-height: 36px; align-items: center; }

@media (max-width: 640px) {
  .today-card { padding: 16px; }
  .mobile-stack { flex-wrap: wrap; }
  .mobile-stack > div { min-width: 100%; }
  .tab-button { min-width: 30%; }
  .flip-btn { min-height: 52px; min-width: 140px; font-size: 17px !important; }
}
`;

/* ═══════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════ */

var canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;
function haptic(ms) { if (canVibrate) try { navigator.vibrate(ms); } catch(e) {} }
function hapticFlip() { haptic([40, 30, 40]); }
function hapticTap() { haptic(12); }
function hapticCommit() { haptic([20, 40, 60]); }

var OUT = { PLUS: "+", MINUS: "-" };

function normalizeCode(code) { return (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2); }
function invertOutcome(o) { return o === OUT.PLUS ? OUT.MINUS : OUT.PLUS; }
function normalizeOutcome(o) {
  if (o === OUT.PLUS || o === OUT.MINUS) return o;
  if (o === "\u2212") return OUT.MINUS;
  return o;
}
function outcomeColor(o) {
  var n = normalizeOutcome(o);
  return n === OUT.PLUS ? COLOR.sideA : n === OUT.MINUS ? COLOR.sideB : COLOR.inkL;
}
function actionText(w, outcome) { return normalizeOutcome(outcome) === OUT.MINUS ? w.minus : w.plus; }
function categoryDefault(w) { return w.category === "Planned Not Taken" ? OUT.MINUS : OUT.PLUS; }

function catDesc(cat) {
  if (cat === "Habit") return "This is how it has usually gone. You do it without deciding, then call it a choice afterward.";
  if (cat === "Contested") return "It has gone both ways. You can explain either outcome depending on what happens.";
  if (cat === "Planned Not Taken") return "You have reasons to do it. There is always an explanation for doing it later.";
  return "";
}

function sitTooltip(w) { return w.name + " (" + w.code + ")\n\n" + (w.plus || "") + "\n" + (w.minus || ""); }

/* ═══════════════════════════════════════════════════
   SIMULATION
   ═══════════════════════════════════════════════════ */

var SIM_PROFILES = [
  { key: "s100", name: "100%", bias: 1.0, note: "Always choose the same" },
  { key: "s75", name: "75%", bias: 0.75, note: "Usually choose the same" },
  { key: "s50", name: "50/50", bias: 0.5, note: "No preference" },
  { key: "s25", name: "25%", bias: 0.25, note: "Usually choose the other" },
  { key: "s0", name: "0%", bias: 0.0, note: "Always choose the other" },
];

var SIM_COLORS = ["#4A7585", "#5A8A72", "#8A8565", "#9A7A60", "#7A5A45"];

function simulate(bias, nDays) {
  var entries = [], lastE = null, lastCE = null, aCount = 0;
  for (var d = 0; d < nDays; d++) {
    var mode = Math.random() < 0.5 ? "U" : "C";
    var outcome = null, invType = null;
    if (mode === "U") {
      outcome = Math.random() < bias ? OUT.PLUS : OUT.MINUS;
    } else {
      var flip2 = Math.random() < 0.5;
      invType = flip2 ? "last" : "lastC";
      if (invType === "last") { outcome = lastE ? invertOutcome(lastE) : OUT.PLUS; }
      else { outcome = lastCE ? invertOutcome(lastCE) : OUT.PLUS; }
    }
    lastE = outcome;
    if (mode === "C") lastCE = outcome;
    if (outcome === OUT.PLUS) aCount++;
    entries.push({ day: d + 1, mode: mode, outcome: outcome, invType: invType, cumRatio: aCount / (d + 1) });
  }
  return entries;
}

/* ═══════════════════════════════════════════════════
   SITUATION FORM (reusable)
   ═══════════════════════════════════════════════════ */

function SituationForm(props) {
  var d = props.draft, onChange = props.onChange, onSubmit = props.onSubmit, onCancel = props.onCancel;
  var submitLabel = props.submitLabel || "Add";
  var showCode = props.showCode !== false;
  var showRemove = props.showRemove;
  var set = function(f, v) { onChange(Object.assign({}, d, { [f]: v })); };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="mobile-stack" style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={S.label}>Situation</label>
          <input style={S.input} value={d.name} onChange={function(e) { set("name", e.target.value); }} placeholder="What is this about" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {CATEGORIES.map(function(cat) {
          return (
            <button key={cat} className="category-btn" onClick={function() { hapticTap(); set("category", cat); }}
              style={{ ...S.tag, cursor: "pointer", background: d.category === cat ? CAT_COLORS[cat] + "20" : "transparent", color: d.category === cat ? CAT_COLORS[cat] : COLOR.inkL, border: "1px solid " + (d.category === cat ? CAT_COLORS[cat] : COLOR.border) }}>
              {cat}
            </button>
          );
        })}
      </div>
      {d.category && <p style={{ fontSize: 12, color: CAT_COLORS[d.category], margin: 0, lineHeight: 1.5 }}>{catDesc(d.category)}</p>}
      <div>
        <label style={{ ...S.label, marginBottom: 8 }}>This could go</label>
        <div className="mobile-stack" style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input style={{ ...S.input, borderLeft: "3px solid " + COLOR.sideA + "60" }} value={d.plus}
              onChange={function(e) { set("plus", e.target.value); }} placeholder="What you do" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input style={{ ...S.input, borderLeft: "3px solid " + COLOR.sideB + "60" }} value={d.minus}
              onChange={function(e) { set("minus", e.target.value); }} placeholder="What you do instead" />
          </div>
        </div>
      </div>
      <div className="mobile-stack" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {showCode && (
          <div style={{ width: 60, flexShrink: 0 }}>
            <label style={S.label}>Code</label>
            <input style={{ ...S.input, textTransform: "uppercase", fontWeight: 700, textAlign: "center" }}
              maxLength={2} value={d.code} onChange={function(e) { set("code", normalizeCode(e.target.value)); }} placeholder="W" />
          </div>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {onCancel && <button onClick={onCancel} style={{ ...S.btn, background: "transparent", color: COLOR.inkL, border: "1px solid " + COLOR.border, fontSize: 13, padding: "8px 16px" }}>Cancel</button>}
          {showRemove && <button onClick={showRemove} style={{ ...S.btn, background: "transparent", color: "#8A6565", border: "1px solid #8A656540", fontSize: 13, padding: "8px 16px" }}>Remove</button>}
          <button onClick={onSubmit} style={{ ...S.btn, background: COLOR.ink, color: COLOR.paper, fontSize: 13, padding: "8px 16px" }}>{submitLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TAB 1 — RULES + SIMULATION
   ═══════════════════════════════════════════════════ */

function RulesTab(props) {
  var situations = props.situations, saveSituations = props.saveSituations, onGoToToday = props.onGoToToday;
  var _seed = useState(0), seed = _seed[0], setSeed = _seed[1];
  var _running = useState(false), running = _running[0], setRunning = _running[1];
  var _adding = useState(false), adding = _adding[0], setAdding = _adding[1];
  var _draft = useState({ code: "", name: "", plus: "", minus: "", category: "Habit" }), draft = _draft[0], setDraft = _draft[1];
  var active = situations ? situations.filter(function(w) { return !w.removed; }) : [];

  var addFn = function() {
    var c = Object.assign({}, draft, { code: normalizeCode(draft.code) });
    if (!c.code || !c.name || !c.plus || !c.minus) return;
    if (situations && situations.some(function(w) { return w.code === c.code && !w.removed; })) return;
    var updated;
    if (!situations) { updated = [c]; }
    else {
      var ex = situations.findIndex(function(w) { return w.code === c.code && w.removed; });
      if (ex >= 0) { updated = situations.map(function(w, i) { return i === ex ? Object.assign({}, c, { removed: false }) : w; }); }
      else { updated = [].concat(situations, [c]); }
    }
    hapticCommit();
    saveSituations(updated);
    setDraft({ code: "", name: "", plus: "", minus: "", category: "Habit" });
    setAdding(false);
  };

  var results = useMemo(function() {
    if (seed === 0) return null;
    var r = {};
    SIM_PROFILES.forEach(function(p) { r[p.key] = simulate(p.bias, 365); });
    return r;
  }, [seed]);

  var run = function() { setRunning(true); setTimeout(function() { setSeed(function(s) { return s + 1; }); setRunning(false); }, 50); };

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
      var maxR = 0, cP = 0, cM = 0;
      entries.forEach(function(e) {
        if (e.mode !== "U") { cP = 0; cM = 0; return; }
        if (e.outcome === OUT.PLUS) { cP++; cM = 0; } else { cM++; cP = 0; }
        var b = cP > cM ? cP : cM;
        if (b > maxR) maxR = b;
      });
      return Object.assign({}, p, { color: SIM_COLORS[i], finalRatio: last.cumRatio, cDays: cDays, longestRun: maxR });
    });
  }, [results]);

  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      <div style={{ ...S.card, marginTop: 24 }}>
        <div style={{ display: "grid", gap: 10 }}>
          {["You define a situation that can go two ways.", "Each day a coin is flipped.", "Sometimes you choose. Sometimes it is assigned based on what happened before.", "Only one outcome is recorded each day. The record does not explain why."].map(function(t, i) {
            return <p key={i} style={{ ...S.p, margin: 0, fontSize: 14 }}>{t}</p>;
          })}
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <h3 style={{ ...S.h3, margin: "0 0 8px" }}>What the rules produce</h3>
        <p style={{ ...S.muted, marginBottom: 20, fontSize: 13 }}>Five agents run the same rules for one year with different preferences on choice days.</p>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <button onClick={run} disabled={running} style={{ ...S.btn, background: COLOR.ink, color: COLOR.paper, fontSize: 15, padding: "14px 40px", opacity: running ? 0.6 : 1 }}>
            {running ? "..." : results ? "Run again" : "Simulate one year"}
          </button>
        </div>

        {results && finals && convergence && (<>
          <div style={{ ...S.card, padding: 20 }}>
            <h3 style={{ ...S.h3, margin: "0 0 4px" }}>365 days</h3>
            <p style={{ fontSize: 12, color: COLOR.inkL, margin: "0 0 12px" }}>Each row is one year. Bright means chosen, faded means assigned.</p>
            {SIM_PROFILES.map(function(p, i) {
              return (
                <div key={p.key} style={{ marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 13, color: SIM_COLORS[i], minWidth: 44, flexShrink: 0 }}>{p.name}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {results[p.key].map(function(e, j) {
                      return <div key={j} style={{ width: 6, height: 6, borderRadius: 1, background: e.outcome === OUT.PLUS ? COLOR.sideA : COLOR.sideB, opacity: e.mode === "C" ? 0.4 : 1 }} />;
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ ...S.card, padding: 20 }}>
            <h3 style={{ ...S.h3, margin: "0 0 4px" }}>Convergence</h3>
            <p style={{ fontSize: 12, color: COLOR.inkL, margin: "0 0 16px" }}>Cumulative ratio over 365 days. All lines move toward center.</p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={convergence}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLOR.borderL} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: COLOR.inkL }} />
                <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tick={{ fontSize: 11, fill: COLOR.inkL }} tickFormatter={function(v) { return Math.round(v * 100) + "%"; }} />
                <ReferenceLine y={0.5} stroke={COLOR.gold} strokeDasharray="4 4" strokeWidth={1.5} />
                <Tooltip contentStyle={{ fontSize: 12, fontFamily: FONT.sans }} formatter={function(v) { return (v * 100).toFixed(1) + "%"; }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {SIM_PROFILES.map(function(p, i) { return <Line key={p.key} type="monotone" dataKey={p.key} stroke={SIM_COLORS[i]} strokeWidth={2} dot={false} name={p.name} />; })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ ...S.card, padding: 20 }}>
            <h3 style={{ ...S.h3, margin: "0 0 12px" }}>Summary</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {finals.map(function(f) {
                return (
                  <div key={f.key} style={{ padding: "12px 16px", borderRadius: 6, borderLeft: "3px solid " + f.color, background: f.color + "08" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 16, color: f.color }}>{f.name}</span>
                      <span style={{ fontSize: 12, color: COLOR.inkL }}>{f.note}</span>
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: 13, color: COLOR.inkL, flexWrap: "wrap" }}>
                      <span>Preference: <strong style={{ color: COLOR.ink }}>{Math.round(f.bias * 100)}%</strong></span>
                      <span>Year-end: <strong style={{ color: f.color }}>{Math.round(f.finalRatio * 100)}%</strong></span>
                      <span>Assigned: <strong style={{ color: COLOR.ink }}>{f.cDays}</strong>/365</span>
                      <span>Longest chosen run: <strong style={{ color: COLOR.ink }}>{f.longestRun}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>)}
      </div>

      <div style={{ marginTop: 28 }}>
        <h3 style={{ ...S.h3, margin: "0 0 12px" }}>{active.length ? "Situations" : "Define a situation"}</h3>
        {active.length > 0 && (
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            {active.map(function(w) {
              return (
                <div key={w.code} style={{ ...S.card, padding: 16, marginBottom: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 16, color: COLOR.ink }}>{w.code}</span>
                    <span style={{ fontSize: 14, color: COLOR.inkL }}>{w.name}</span>
                    <span style={{ ...S.tag, background: CAT_COLORS[w.category] + "12", color: CAT_COLORS[w.category], fontSize: 9, marginLeft: "auto" }}>{w.category}</span>
                  </div>
                  <div style={{ fontSize: 13, color: COLOR.inkL }}>
                    <span style={{ color: COLOR.sideA }}>{w.plus}</span>
                    <span style={{ margin: "0 8px", color: COLOR.borderL }}>or</span>
                    <span style={{ color: COLOR.sideB }}>{w.minus}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {adding ? (
          <div style={{ ...S.card, padding: 16, borderLeft: "3px solid " + COLOR.gold }}>
            <SituationForm draft={draft} onChange={setDraft} onSubmit={addFn} onCancel={function() { setAdding(false); }} />
          </div>
        ) : (
          <button onClick={function() { setAdding(true); }} style={{ ...S.btn, background: "transparent", border: "1px solid " + COLOR.border, color: COLOR.inkL }}>
            {active.length ? "Add another" : "Define your first situation"}
          </button>
        )}
        {active.length > 0 && (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <button onClick={onGoToToday} style={{ ...S.btn, background: COLOR.ink, color: COLOR.paper, fontSize: 15, padding: "14px 36px" }}>Go to Today</button>
          </div>
        )}
      </div>
      <div style={{ height: 40 }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TAB 2 — TODAY
   ═══════════════════════════════════════════════════ */

function TodayTab(props) {
  var situations = props.situations, ledger = props.ledger, todayState = props.todayState;
  var saveSituations = props.saveSituations, saveLedger = props.saveLedger, saveToday = props.saveToday;
  var onGoToRules = props.onGoToRules;

  var _flipAnim = useState(false), flipAnim = _flipAnim[0], setFlipAnim = _flipAnim[1];
  var _justFlipped = useState(false), justFlipped = _justFlipped[0], setJustFlipped = _justFlipped[1];
  var _adding = useState(false), adding = _adding[0], setAdding = _adding[1];
  var _editCode = useState(null), editCode = _editCode[0], setEditCode = _editCode[1];
  var _editDraft = useState(null), editDraft = _editDraft[0], setEditDraft = _editDraft[1];
  var _newDraft = useState({ code: "", name: "", plus: "", minus: "", category: "Habit" }), newDraft = _newDraft[0], setNewDraft = _newDraft[1];

  var active = situations ? situations.filter(function(w) { return !w.removed; }) : [];

  var getLastEntry = useCallback(function(code) {
    for (var i = ledger.length - 1; i >= 0; i--) { if (ledger[i][code]) return ledger[i][code]; }
    return null;
  }, [ledger]);

  var getLastC = useCallback(function(code) {
    for (var i = ledger.length - 1; i >= 0; i--) { if (ledger[i][code] && ledger[i][code].mode === "C") return ledger[i][code]; }
    return null;
  }, [ledger]);

  var getNextAssigned = useCallback(function(w) {
    var lc = getLastC(w.code);
    var cOut = lc ? normalizeOutcome(lc.outcome) : null;
    var le = getLastEntry(w.code);
    if (todayState && todayState[w.code] && todayState[w.code].outcome) {
      le = { mode: todayState[w.code].mode, outcome: normalizeOutcome(todayState[w.code].outcome) };
    }
    var lOut = le ? normalizeOutcome(le.outcome) : null;
    var fromLast = lOut ? invertOutcome(lOut) : categoryDefault(w);
    var fromLastC = cOut ? invertOutcome(cOut) : categoryDefault(w);
    if (fromLast === fromLastC) return { certain: true, outcome: fromLast };
    return { certain: false };
  }, [getLastEntry, getLastC, todayState]);

  var buildFlippedDay = useCallback(function() {
    var state = {};
    active.forEach(function(w) {
      var flip1 = Math.random() < 0.5;
      if (flip1) { state[w.code] = { mode: "U", outcome: null }; }
      else {
        var flip2 = Math.random() < 0.5;
        var inv = flip2 ? "last" : "lastC";
        var ref = inv === "last" ? getLastEntry(w.code) : getLastC(w.code);
        var refOut = ref ? normalizeOutcome(ref.outcome) : null;
        var outcome = refOut ? invertOutcome(refOut) : categoryDefault(w);
        state[w.code] = { mode: "C", outcome: outcome, invType: inv };
      }
    });
    return state;
  }, [active, getLastC, getLastEntry]);

  var toLedgerEntry = useCallback(function(ds) {
    var entry = { day: ds.day };
    active.forEach(function(w) {
      var ts = ds[w.code];
      if (!ts) return;
      entry[w.code] = { mode: ts.mode, outcome: normalizeOutcome(ts.outcome) };
      if (ts.mode === "C" && ts.invType) entry[w.code].inv = ts.invType;
    });
    return entry;
  }, [active]);

  var flipAll = function() {
    if (!active.length) return;
    var canAdvance = !todayState || active.every(function(w) { return todayState[w.code] && todayState[w.code].outcome; });
    if (!canAdvance) return;
    hapticFlip();
    setFlipAnim(true);
    setTimeout(function() {
      var nextDay = (todayState ? todayState.day : ledger.length) + 1;
      var ns = Object.assign({}, buildFlippedDay(), { day: nextDay });
      saveLedger([].concat(ledger, [toLedgerEntry(ns)]));
      saveToday(ns);
      setFlipAnim(false);
      setJustFlipped(true);
      setTimeout(function() { setJustFlipped(false); }, 500);
    }, 600);
  };

  var setOutcome = function(code, val) {
    hapticTap();
    var ns = Object.assign({}, todayState, { [code]: Object.assign({}, todayState[code], { outcome: normalizeOutcome(val) }) });
    saveToday(ns);
    var entry = toLedgerEntry(ns);
    var has = ledger.some(function(d) { return d.day === entry.day; });
    saveLedger(has ? ledger.map(function(d) { return d.day === entry.day ? entry : d; }) : [].concat(ledger, [entry]));
  };

  var addSitFn = function() {
    var c = Object.assign({}, newDraft, { code: normalizeCode(newDraft.code) });
    if (!c.code || !c.name || !c.plus || !c.minus) return;
    if (situations.some(function(w) { return w.code === c.code && !w.removed; })) return;
    var ex = situations.findIndex(function(w) { return w.code === c.code && w.removed; });
    var updated;
    if (ex >= 0) { updated = situations.map(function(w, i) { return i === ex ? Object.assign({}, c, { removed: false }) : w; }); }
    else { updated = [].concat(situations, [c]); }
    hapticCommit();
    saveSituations(updated);
    if (todayState && todayState.day) {
      var flip1 = Math.random() < 0.5;
      var ws;
      if (flip1) { ws = { mode: "U", outcome: null }; }
      else {
        var f2 = Math.random() < 0.5;
        var inv = f2 ? "last" : "lastC";
        var ref = inv === "last" ? getLastEntry(c.code) : getLastC(c.code);
        var ro = ref ? normalizeOutcome(ref.outcome) : null;
        var out = ro ? invertOutcome(ro) : categoryDefault(c);
        ws = { mode: "C", outcome: out, invType: inv };
      }
      var nts = Object.assign({}, todayState, { [c.code]: ws });
      saveToday(nts);
      var ne = { mode: ws.mode, outcome: normalizeOutcome(ws.outcome) };
      if (ws.mode === "C" && ws.invType) ne.inv = ws.invType;
      saveLedger(ledger.map(function(d) { return d.day === todayState.day ? Object.assign({}, d, { [c.code]: ne }) : d; }));
    }
    setNewDraft({ code: "", name: "", plus: "", minus: "", category: "Habit" });
    setAdding(false);
  };

  var removeSitFn = function(code) {
    var next = situations.map(function(w) { return w.code === code ? Object.assign({}, w, { removed: true }) : w; });
    saveSituations(next);
    if (!next.filter(function(w) { return !w.removed; }).length) { saveToday(null); return; }
    if (todayState && todayState[code]) {
      var nts = Object.assign({}, todayState); delete nts[code]; saveToday(nts);
      if (todayState.day) { saveLedger(ledger.map(function(d) { if (d.day === todayState.day) { var cl = Object.assign({}, d); delete cl[code]; return cl; } return d; })); }
    }
    setEditCode(null); setEditDraft(null);
  };

  var startEdit = function(w) { setEditCode(w.code); setEditDraft({ name: w.name, plus: w.plus, minus: w.minus, category: w.category }); };
  var saveEdit = function() {
    if (!editDraft || !editCode || !editDraft.name || !editDraft.plus || !editDraft.minus) return;
    saveSituations(situations.map(function(w) { return w.code === editCode ? Object.assign({}, w, editDraft) : w; }));
    setEditCode(null); setEditDraft(null);
  };

  var resetAll = async function() {
    saveSituations(null); saveLedger([]); saveToday(null);
    setAdding(false); setEditCode(null); setEditDraft(null);
    try { await window.storage.delete(SKEY.wagers); } catch(e) {}
    try { await window.storage.delete(SKEY.ledger); } catch(e) {}
  };

  if (!situations || !active.length) {
    return (
      <div style={{ maxWidth: 780, margin: "0 auto", textAlign: "center", padding: "60px 20px" }}>
        <p style={{ ...S.muted, marginBottom: 20 }}>No situations defined yet.</p>
        <button onClick={onGoToRules} style={{ ...S.btn, background: COLOR.ink, color: COLOR.paper, fontSize: 15, padding: "14px 32px" }}>Go to Rules</button>
      </div>
    );
  }

  var allFilled = todayState && active.length > 0 && active.every(function(w) { return todayState[w.code] && todayState[w.code].outcome; });
  var dayNumber = todayState ? todayState.day : ledger.length + 1;

  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      <div style={{ ...S.card, textAlign: "center", marginTop: 24, padding: 28 }}>
        <p style={{ fontFamily: FONT.serif, fontSize: 14, color: COLOR.inkL, marginBottom: 16, letterSpacing: "0.04em" }}>Day {dayNumber}</p>
        {!todayState ? (
          <button onClick={flipAll} className={"flip-btn" + (flipAnim ? " flipping" : "")}
            style={{ ...S.btn, background: COLOR.ink, color: COLOR.paper, fontSize: 16, padding: "14px 40px" }}>
            <span className={"coin-icon" + (flipAnim ? " spinning" : "")}>{"\u25CF"}</span>{" "}{flipAnim ? "" : "Flip"}
          </button>
        ) : (
          <div>
            <div style={{ display: "grid", gap: 14, textAlign: "center", marginBottom: 20 }}>
              {active.map(function(w, wi) {
                var ts = todayState[w.code];
                if (!ts) return null;
                var isAssigned = ts.mode === "C";
                var o = normalizeOutcome(ts.outcome);
                var oc = outcomeColor(o);
                var chosen = o ? actionText(w, o) : null;
                var cardClass = "today-card" + (isAssigned ? " assigned" : "") + (justFlipped ? " revealed" : "");

                var lastE = (function() {
                  for (var i = ledger.length - 1; i >= 0; i--) {
                    if (ledger[i].day !== (todayState ? todayState.day : -1) && ledger[i][w.code]) return ledger[i][w.code];
                  }
                  return null;
                })();
                var nextA = getNextAssigned(w);

                return (
                  <div key={w.code} className={cardClass} style={justFlipped ? { animationDelay: (wi * 80) + "ms" } : undefined}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 18, color: COLOR.ink }} title={sitTooltip(w)}>{w.code}</span>
                      <span style={{ fontSize: 13, color: COLOR.inkL }}>{w.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: isAssigned ? COLOR.inkL : COLOR.gold, letterSpacing: "0.04em", marginTop: 4 }}>
                        {isAssigned ? "Assigned" : "You choose"}
                      </span>

                      {isAssigned ? (
                        <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 17, color: oc, marginTop: 4 }}>{chosen}</span>
                      ) : o ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                          <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 17, color: oc }}>{chosen}</span>
                          <button onClick={function() { setOutcome(w.code, o === OUT.PLUS ? OUT.MINUS : OUT.PLUS); }}
                            style={{ ...S.btn, padding: "6px 12px", fontSize: 12, background: "transparent", color: COLOR.inkL, border: "1px solid " + COLOR.border, minHeight: 32 }}>Switch</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                          {[OUT.PLUS, OUT.MINUS].map(function(val) {
                            var c = val === OUT.PLUS ? COLOR.sideA : COLOR.sideB;
                            return (
                              <button key={val} className="action-btn" onClick={function() { setOutcome(w.code, val); }}
                                style={{ ...S.btn, padding: "10px 18px", fontSize: 14, background: "transparent", color: c, border: "2px solid " + c, borderRadius: 6, fontWeight: 600, minWidth: 100 }}>
                                {val === OUT.PLUS ? w.plus : w.minus}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div style={{ fontSize: 11, color: COLOR.inkL, marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                        {lastE && (
                          <span>Previously: <strong style={{ color: outcomeColor(lastE.outcome) }}>{actionText(w, lastE.outcome)}</strong>
                            <span style={{ opacity: 0.6 }}>{lastE.mode === "C" ? " (assigned)" : " (chosen)"}</span>
                          </span>
                        )}
                        {o && nextA.certain && (
                          <span>If assigned next: <strong style={{ color: outcomeColor(nextA.outcome) }}>{actionText(w, nextA.outcome)}</strong></span>
                        )}
                        {o && !nextA.certain && (
                          <span style={{ opacity: 0.6 }}>Next assigned: either</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={flipAll} disabled={!allFilled || flipAnim}
              className={"flip-btn" + (flipAnim ? " flipping" : "")}
              style={{ ...S.btn, fontSize: 15, padding: "12px 36px", background: allFilled ? COLOR.ink : COLOR.border, color: COLOR.paper, opacity: allFilled ? 1 : 0.6, cursor: allFilled ? "pointer" : "default" }}>
              <span className={"coin-icon" + (flipAnim ? " spinning" : "")}>{"\u25CF"}</span>{" "}{flipAnim ? "" : "Flip"}
            </button>
          </div>
        )}
      </div>

      {adding ? (
        <div style={{ ...S.card, padding: 16, borderLeft: "3px solid " + COLOR.gold }}>
          <SituationForm draft={newDraft} onChange={setNewDraft} onSubmit={addSitFn} onCancel={function() { setAdding(false); }} />
        </div>
      ) : editCode && editDraft ? (
        <div style={{ ...S.card, padding: 16, borderLeft: "3px solid " + COLOR.gold }}>
          <SituationForm draft={editDraft} onChange={setEditDraft} onSubmit={saveEdit}
            onCancel={function() { setEditCode(null); setEditDraft(null); }}
            showCode={false} submitLabel="Save"
            showRemove={active.length > 1 ? function() { removeSitFn(editCode); } : undefined} />
        </div>
      ) : (
        <div style={{ ...S.card, padding: 16 }}>
          <h3 style={{ ...S.h3, margin: "0 0 12px", fontSize: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            Situations
            <button onClick={function() { setAdding(true); setEditCode(null); }}
              style={{ ...S.btn, background: "transparent", color: COLOR.gold, border: "1px solid " + COLOR.gold + "40", fontSize: 13, padding: "6px 14px" }}>Add</button>
          </h3>
          <div style={{ display: "grid", gap: 8 }}>
            {active.map(function(w) {
              return (
                <div key={w.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", borderRadius: 6, background: COLOR.ink + "04", minHeight: 44 }}>
                  <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 15, color: COLOR.ink, minWidth: 28 }} title={sitTooltip(w)}>{w.code}</span>
                  <span style={{ fontSize: 13, color: COLOR.inkL, flex: 1 }}>{w.name}</span>
                  <span style={{ ...S.tag, background: CAT_COLORS[w.category] + "12", color: CAT_COLORS[w.category], fontSize: 9 }}>{w.category}</span>
                  <button onClick={function() { startEdit(w); }}
                    style={{ background: "none", border: "none", color: COLOR.inkL, cursor: "pointer", fontSize: 13, padding: "4px 6px", opacity: 0.6, minWidth: 32, minHeight: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>{"\u270E"}</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 8, paddingBottom: 20 }}>
        <button onClick={resetAll} style={{ ...S.btn, background: "transparent", color: "#8A6565", border: "1px solid #8A656540", fontSize: 13 }}>Reset</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TAB 3 — RECORD
   ═══════════════════════════════════════════════════ */

function RecordTab(props) {
  var situations = props.situations, ledger = props.ledger;
  var _exp = useState(false), expanded = _exp[0], setExpanded = _exp[1];
  var active = situations ? situations.filter(function(w) { return !w.removed; }) : [];

  var ledgerCodes = useMemo(function() {
    var codes = new Set();
    ledger.forEach(function(day) { Object.keys(day).forEach(function(k) { if (k !== "day") codes.add(k); }); });
    return codes;
  }, [ledger]);

  var recordSits = useMemo(function() {
    if (!situations) return [];
    var a = situations.filter(function(w) { return !w.removed; });
    var i = situations.filter(function(w) { return w.removed && ledgerCodes.has(w.code); });
    return a.concat(i);
  }, [situations, ledgerCodes]);

  var isBrightU = useCallback(function(idx, code) {
    var e = ledger[idx] ? ledger[idx][code] : null;
    if (!e || e.mode !== "U") return false;
    var o = normalizeOutcome(e.outcome);
    if (!o) return false;
    var same = function(c) { return c && c.mode === "U" && normalizeOutcome(c.outcome) === o; };
    return same(ledger[idx - 1] ? ledger[idx - 1][code] : null) || same(ledger[idx + 1] ? ledger[idx + 1][code] : null);
  }, [ledger]);

  var MIN_DAYS = 3;
  var analysis = useMemo(function() {
    if (!situations || !ledger.length) return [];
    return active.map(function(w) {
      var entries = [];
      ledger.forEach(function(day) {
        var e = day[w.code];
        if (e && normalizeOutcome(e.outcome)) entries.push({ day: day.day, mode: e.mode, outcome: normalizeOutcome(e.outcome) });
      });
      if (entries.length < MIN_DAYS) return null;
      var uE = entries.filter(function(e) { return e.mode === "U"; });
      if (!uE.length) return null;
      var uA = uE.filter(function(e) { return e.outcome === OUT.PLUS; }).length;
      var lean = uA >= (uE.length - uA) ? OUT.PLUS : OUT.MINUS;
      var leanLabel = lean === OUT.PLUS ? w.plus : w.minus;
      var otherLabel = lean === OUT.PLUS ? w.minus : w.plus;
      var leanColor = lean === OUT.PLUS ? COLOR.sideA : COLOR.sideB;
      var otherColor = lean === OUT.PLUS ? COLOR.sideB : COLOR.sideA;
      var isL = function(o) { return o === lean; };
      var uLC = lean === OUT.PLUS ? uA : uE.length - uA;
      var uLP = Math.round((uLC / uE.length) * 100);
      var tL = entries.filter(function(e) { return isL(e.outcome); }).length;
      var oP = Math.round((tL / entries.length) * 100);
      var cD = entries.filter(function(e) { return e.mode === "C"; }).length;
      var mR = 0, cR = 0;
      entries.forEach(function(e) { if (e.mode !== "U") { cR = 0; return; } if (isL(e.outcome)) { cR++; if (cR > mR) mR = cR; } else cR = 0; });
      var mRO = 0, cRO = 0;
      entries.forEach(function(e) { if (e.mode !== "U") { cRO = 0; return; } if (!isL(e.outcome)) { cRO++; if (cRO > mRO) mRO = cRO; } else cRO = 0; });
      var cum = 0;
      var rd = entries.map(function(e, i) { if (isL(e.outcome)) cum++; return { day: e.day, ratio: cum / (i + 1) }; });
      return { w: w, entries: entries, lean: lean, leanLabel: leanLabel, otherLabel: otherLabel, leanColor: leanColor, otherColor: otherColor, uTotal: uE.length, uLeanPct: uLP, overallPct: oP, totalDays: entries.length, cDays: cD, maxRunLean: mR, maxRunOther: mRO, runningData: rd };
    }).filter(Boolean);
  }, [situations, ledger, active]);

  if (!ledger.length) {
    return <div style={{ maxWidth: 780, margin: "0 auto", textAlign: "center", padding: "60px 20px" }}><p style={S.muted}>No days recorded yet.</p></div>;
  }

  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      <div style={{ marginTop: 24 }}>
        <h3 style={{ ...S.h3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          Record
          <span style={{ fontSize: 12, fontWeight: 400, color: COLOR.inkL }}>{ledger.length} {ledger.length === 1 ? "day" : "days"}</span>
        </h3>
        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT.sans, fontSize: 14 }}>
              <thead style={{ position: "sticky", top: 0, background: COLOR.white, zIndex: 2 }}>
                <tr>
                  <th style={{ padding: "10px 10px 6px", borderBottom: "2px solid " + COLOR.ink, textAlign: "left", fontWeight: 700, fontSize: 12 }} />
                  {recordSits.map(function(w) {
                    return <th key={w.code} style={{ padding: "10px 10px 6px", borderBottom: "2px solid " + COLOR.ink, textAlign: "center", fontWeight: 700, fontSize: 14, fontFamily: FONT.serif, color: w.removed ? COLOR.inkL : COLOR.ink, opacity: w.removed ? 0.5 : 1 }} title={sitTooltip(w)}>{w.code}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {(function() {
                  var disp = expanded ? ledger : ledger.slice(-10);
                  var base = expanded ? 0 : Math.max(0, ledger.length - 10);
                  var rows = disp.map(function(day, si) { return { day: day, idx: base + si }; });
                  rows.reverse();
                  return rows.map(function(r) {
                    return (
                      <tr key={r.idx} style={{ borderBottom: "1px solid " + COLOR.borderL }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600, fontSize: 13, color: COLOR.inkL }}>{String(r.day.day).padStart(2, "0")}</td>
                        {recordSits.map(function(w) {
                          var e = r.day[w.code];
                          if (!e) return <td key={w.code} style={{ textAlign: "center", padding: 6, color: COLOR.borderL }}>{"\u2014"}</td>;
                          var o = normalizeOutcome(e.outcome);
                          var bright = isBrightU(r.idx, w.code);
                          var faded = e.mode === "C" || !bright;
                          return (
                            <td key={w.code} style={{ textAlign: "center", padding: "8px 6px" }}>
                              <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 3, background: outcomeColor(o), opacity: faded ? 0.35 : 1 }}
                                title={actionText(w, o) + " (" + (e.mode === "C" ? "assigned" : bright ? "chosen, in run" : "chosen") + ")"} />
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
          {ledger.length > 10 && (
            <button className="toggle-btn" onClick={function() { setExpanded(function(p) { return !p; }); }}>
              {expanded ? "Show recent" : "Show all " + ledger.length + " days"}
            </button>
          )}
          <div style={{ padding: "8px 16px 12px", display: "flex", gap: 16, justifyContent: "center", fontSize: 12, flexWrap: "wrap", borderTop: "1px solid " + COLOR.borderL }}>
            <span><span style={{ display: "inline-block", width: 8, height: 8, background: COLOR.sideA, borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /><span style={{ color: COLOR.inkL }}>first action</span></span>
            <span><span style={{ display: "inline-block", width: 8, height: 8, background: COLOR.sideB, borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} /><span style={{ color: COLOR.inkL }}>second action</span></span>
            <span style={{ color: COLOR.inkL }}>bright = pattern · faded = assigned or isolated</span>
          </div>
        </div>
      </div>

      {analysis.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ ...S.h3, margin: "0 0 16px" }}>By situation</h3>
          <div style={{ display: "grid", gap: 20 }}>
            {analysis.map(function(a) {
              var w = a.w;
              var seq = a.entries.length > 120 ? a.entries.slice(-120) : a.entries;
              var trunc = a.entries.length > 120;
              return (
                <div key={w.code} style={{ ...S.card, padding: 0, overflow: "hidden", marginBottom: 0 }}>
                  <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid " + COLOR.borderL }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 18, color: COLOR.ink }}>{w.code}</span>
                      <span style={{ fontSize: 14, color: COLOR.inkL }}>{w.name}</span>
                      <span style={{ ...S.tag, background: CAT_COLORS[w.category] + "12", color: CAT_COLORS[w.category], fontSize: 9, marginLeft: "auto" }}>{w.category}</span>
                    </div>
                    <p style={{ fontSize: 13, color: COLOR.inkL, margin: 0 }}>
                      <strong style={{ color: a.leanColor }}>{a.leanLabel}</strong>{": "}{a.uLeanPct}% on choice days
                    </p>
                  </div>
                  <div style={{ padding: "14px 20px", display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: COLOR.inkL, borderBottom: "1px solid " + COLOR.borderL }}>
                    <div><div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", marginBottom: 2 }}>DAYS</div><strong style={{ color: COLOR.ink, fontSize: 17 }}>{a.totalDays}</strong></div>
                    <div><div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", marginBottom: 2 }}>OVERALL</div><strong style={{ color: a.leanColor, fontSize: 17 }}>{a.overallPct}%</strong><span style={{ fontSize: 11, marginLeft: 3 }}>{a.leanLabel}</span></div>
                    <div><div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", marginBottom: 2 }}>ASSIGNED</div><strong style={{ color: COLOR.ink, fontSize: 17 }}>{a.cDays}</strong><span style={{ fontSize: 11, marginLeft: 3 }}>/ {a.totalDays}</span></div>
                    {(a.maxRunLean > 1 || a.maxRunOther > 1) && (
                      <div><div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", marginBottom: 2 }}>LONGEST CHOSEN RUN</div>
                        <span style={{ color: a.leanColor }}><strong style={{ fontSize: 17 }}>{a.maxRunLean}</strong> <span style={{ fontSize: 11 }}>{a.leanLabel}</span></span>
                        <span style={{ margin: "0 6px", color: COLOR.borderL }}>/</span>
                        <span style={{ color: a.otherColor }}><strong style={{ fontSize: 17 }}>{a.maxRunOther}</strong> <span style={{ fontSize: 11 }}>{a.otherLabel}</span></span>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid " + COLOR.borderL }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: COLOR.inkL, marginBottom: 8 }}>SEQUENCE{trunc ? " (last 120)" : ""}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                      {seq.map(function(e, i) {
                        return <div key={i} title={"Day " + e.day + ": " + actionText(w, e.outcome) + " (" + (e.mode === "C" ? "assigned" : "chosen") + ")"}
                          style={{ width: 8, height: 8, borderRadius: 1, background: outcomeColor(e.outcome), opacity: e.mode === "C" ? 0.35 : 1 }} />;
                      })}
                    </div>
                  </div>
                  {a.runningData.length > 2 && (
                    <div style={{ padding: "14px 20px 16px" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: COLOR.inkL, marginBottom: 8 }}>RUNNING RATIO</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={a.runningData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={COLOR.borderL} />
                          <XAxis dataKey="day" tick={{ fontSize: 10, fill: COLOR.inkL }} />
                          <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tick={{ fontSize: 10, fill: COLOR.inkL }} tickFormatter={function(v) { return Math.round(v * 100) + "%"; }} />
                          <ReferenceLine y={0.5} stroke={COLOR.gold} strokeDasharray="4 4" strokeWidth={1.5} />
                          <Tooltip contentStyle={{ fontSize: 11, fontFamily: FONT.sans }} formatter={function(v) { return (v * 100).toFixed(1) + "% " + a.leanLabel; }} />
                          <Line type="monotone" dataKey="ratio" stroke={a.leanColor} strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 16, justifyContent: "center", fontSize: 12, color: COLOR.inkL, flexWrap: "wrap", padding: "0 0 8px" }}>
              <span>bright = chosen · faded = assigned</span>
              <span><span style={{ display: "inline-block", width: 8, height: 1.5, background: COLOR.gold, marginRight: 4, verticalAlign: "middle" }} />50% center</span>
            </div>
          </div>
        </div>
      )}
      <div style={{ height: 40 }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   APP SHELL
   ═══════════════════════════════════════════════════ */

var TABS = [
  { id: "rules", label: "Rules" },
  { id: "today", label: "Today" },
  { id: "record", label: "Record" },
];

export default function App() {
  var _tab = useState(null), tab = _tab[0], setTab = _tab[1];
  var _sit = useState(null), situations = _sit[0], setSituations = _sit[1];
  var _led = useState([]), ledger = _led[0], setLedger = _led[1];
  var _tod = useState(null), todayState = _tod[0], setTodayState = _tod[1];
  var _loaded = useState(false), loaded = _loaded[0], setLoaded = _loaded[1];

  useEffect(function() {
    (async function() {
      var loadedW = null, loadedL = [], loadedT = null;
      try { var w = await window.storage.get(SKEY.wagers); if (w && w.value) loadedW = JSON.parse(w.value); } catch(e) {}
      try { var l = await window.storage.get(SKEY.ledger); if (l && l.value) loadedL = JSON.parse(l.value); } catch(e) {}
      try { var t = await window.storage.get(SKEY.today); if (t && t.value) { var p = JSON.parse(t.value); loadedT = p && p.day ? p : null; } } catch(e) {}

      if (loadedW && loadedT && loadedT.day) {
        var actv = loadedW.filter(function(w) { return !w.removed; });
        var changed = false;
        actv.forEach(function(w) {
          if (!loadedT[w.code]) {
            var f1 = Math.random() < 0.5;
            if (f1) { loadedT[w.code] = { mode: "U", outcome: null }; }
            else { loadedT[w.code] = { mode: "C", outcome: categoryDefault(w), invType: "last" }; }
            changed = true;
          }
        });
        var codes = new Set(actv.map(function(w) { return w.code; }));
        Object.keys(loadedT).forEach(function(k) { if (k !== "day" && !codes.has(k)) { delete loadedT[k]; changed = true; } });
        if (changed) { try { await window.storage.set(SKEY.today, JSON.stringify(loadedT)); } catch(e) {} }
      }

      setSituations(loadedW);
      setLedger(loadedL);
      setTodayState(loadedT);
      var hasActive = loadedW && loadedW.some(function(w) { return !w.removed; });
      setTab(hasActive ? "today" : "rules");
      setLoaded(true);
    })();
  }, []);

  var saveSituations = useCallback(async function(s) {
    setSituations(s);
    try { if (s) { await window.storage.set(SKEY.wagers, JSON.stringify(s)); } else { await window.storage.delete(SKEY.wagers); } } catch(e) {}
  }, []);
  var saveLedger = useCallback(async function(l) {
    setLedger(l);
    try { await window.storage.set(SKEY.ledger, JSON.stringify(l)); } catch(e) {}
  }, []);
  var saveToday = useCallback(async function(t) {
    setTodayState(t);
    try { if (t) { await window.storage.set(SKEY.today, JSON.stringify(t)); } else { await window.storage.delete(SKEY.today); } } catch(e) {}
  }, []);

  var switchTab = function(id) { hapticTap(); setTab(id); };

  if (!loaded) return null;

  return (
    <div style={{ fontFamily: FONT.sans, background: COLOR.paper, color: COLOR.ink, minHeight: "100vh", maxWidth: 900, margin: "0 auto", padding: "0 max(14px, env(safe-area-inset-right)) 0 max(14px, env(safe-area-inset-left))" }}>
      <style>{GLOBAL_CSS}</style>
      <header style={{ textAlign: "center", padding: "36px 0 8px" }}>
        <h1 style={{ fontFamily: FONT.serif, fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", color: COLOR.ink }}>ATDU</h1>
        <p style={{ ...S.muted, marginTop: 6, fontSize: 13 }}>A coin. A situation. A record.</p>
      </header>
      <nav style={{ display: "flex", justifyContent: "center", gap: 4, margin: "24px 0 8px", borderBottom: "1px solid " + COLOR.border, flexWrap: "wrap" }}>
        {TABS.map(function(t) {
          return (
            <button key={t.id} onClick={function() { switchTab(t.id); }}
              aria-current={tab === t.id ? "page" : undefined} className="tab-button"
              style={{ ...S.btn, fontSize: 14, padding: "10px 24px", background: "transparent", borderRadius: "6px 6px 0 0", color: tab === t.id ? COLOR.ink : COLOR.inkL, borderBottom: tab === t.id ? "2px solid " + COLOR.ink : "2px solid transparent", fontWeight: tab === t.id ? 700 : 400 }}>
              {t.label}
            </button>
          );
        })}
      </nav>
      {tab === "rules" && <RulesTab situations={situations} saveSituations={saveSituations} onGoToToday={function() { switchTab("today"); }} />}
      {tab === "today" && <TodayTab situations={situations} ledger={ledger} todayState={todayState} saveSituations={saveSituations} saveLedger={saveLedger} saveToday={saveToday} onGoToRules={function() { switchTab("rules"); }} />}
      {tab === "record" && <RecordTab situations={situations} ledger={ledger} />}
    </div>
  );
}
