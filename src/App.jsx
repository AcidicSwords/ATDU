import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  commitDay,
  exportText,
  flipDay,
  memory,
  reconciled,
  unresolvedCount,
} from "./engine.js";
import "./App.css";

const STORAGE_KEYS = {
  wagers: "atdu2-w",
  ledger: "atdu2-l",
  day: "atdu2-d",
};

const STRUCTURES = [
  {
    key: "NOT",
    label: "Negation",
    description: "One act, positively enacted or positively not enacted.",
  },
  {
    key: "BIFURCATION",
    label: "Bifurcation",
    description: "One consequence, produced through two routes.",
  },
  {
    key: "ASYMPTOTE",
    label: "Asymptote",
    description: "One measure, constrained toward a shared boundary.",
  },
  {
    key: "PRECEDENCE",
    label: "Precedence",
    description: "One act, positioned around a shared anchor.",
  },
];

const EMPTY_DRAFT = {
  code: "",
  name: "",
  type: "NOT",
  act: "",
  consequence: "",
  routeA: "",
  routeB: "",
  measure: "",
  boundary: "",
  unit: "",
  anchor: "",
  exactA: "",
  exactB: "",
  exact: false,
};

const canVibrate =
  typeof navigator !== "undefined" && "vibrate" in navigator;

function haptic(pattern) {
  if (!canVibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Haptics are optional.
  }
}

function parse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function storageGet(key) {
  try {
    const value = await window.storage.get(key);
    return value?.value ?? null;
  } catch {
    return null;
  }
}

async function storageSet(key, value) {
  try {
    await window.storage.set(key, value);
  } catch {
    // The interface remains usable if persistence is unavailable.
  }
}

async function storageDelete(key) {
  try {
    await window.storage.delete(key);
  } catch {
    // No-op.
  }
}

function normalizeCode(value) {
  return (value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 2);
}

function todayISO() {
  return new Date().toISOString();
}

function sideText(wager, side) {
  return side === "A" ? wager.a : wager.b;
}

function resolutionCode(entry) {
  if (!entry || entry.null) return "∅";
  return `${entry.mode}${entry.side}`;
}

function draftFromWager(wager) {
  const schema = wager.schema || {};
  return {
    ...EMPTY_DRAFT,
    code: wager.code,
    name: wager.name,
    type: wager.type || "NOT",
    act: schema.act || "",
    consequence: schema.consequence || "",
    routeA: schema.routeA || "",
    routeB: schema.routeB || "",
    measure: schema.measure || "",
    boundary: schema.boundary || "",
    unit: schema.unit || "",
    anchor: schema.anchor || "",
    exactA: wager.a || "",
    exactB: wager.b || "",
    exact: !wager.schema,
  };
}

function generatedSides(draft) {
  if (draft.exact) {
    return { a: draft.exactA.trim(), b: draft.exactB.trim() };
  }

  switch (draft.type) {
    case "NOT": {
      const act = draft.act.trim();
      return {
        a: act ? `Do ${act}` : "",
        b: act ? `Do not ${act}` : "",
      };
    }
    case "BIFURCATION": {
      const consequence = draft.consequence.trim();
      const routeA = draft.routeA.trim();
      const routeB = draft.routeB.trim();
      return {
        a: consequence && routeA ? `${consequence} through ${routeA}` : "",
        b: consequence && routeB ? `${consequence} through ${routeB}` : "",
      };
    }
    case "ASYMPTOTE": {
      const measure = draft.measure.trim();
      const boundary = draft.boundary.trim();
      const unit = draft.unit.trim();
      const amount = [boundary, unit].filter(Boolean).join(" ");
      return {
        a: measure && amount ? `${measure} at most ${amount}` : "",
        b: measure && amount ? `${measure} at least ${amount}` : "",
      };
    }
    case "PRECEDENCE": {
      const act = draft.act.trim();
      const anchor = draft.anchor.trim();
      return {
        a: act && anchor ? `${act} before ${anchor}` : "",
        b: act && anchor ? `${act} after ${anchor}` : "",
      };
    }
    default:
      return { a: "", b: "" };
  }
}

function schemaFromDraft(draft) {
  if (draft.exact) return null;
  if (draft.type === "NOT") return { act: draft.act.trim() };
  if (draft.type === "BIFURCATION") {
    return {
      consequence: draft.consequence.trim(),
      routeA: draft.routeA.trim(),
      routeB: draft.routeB.trim(),
    };
  }
  if (draft.type === "ASYMPTOTE") {
    return {
      measure: draft.measure.trim(),
      boundary: draft.boundary.trim(),
      unit: draft.unit.trim(),
    };
  }
  return {
    act: draft.act.trim(),
    anchor: draft.anchor.trim(),
  };
}

function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}

function WagerGeometry({ wager, compact = false, activeSide = null }) {
  const schema = wager.schema || {};
  const type = wager.type || "NOT";

  let left = "A";
  let center = wager.name;
  let right = "B";
  let leftDetail = wager.a;
  let rightDetail = wager.b;

  if (type === "NOT" && schema.act) {
    left = "Do";
    center = schema.act;
    right = "Do not";
    leftDetail = wager.a;
    rightDetail = wager.b;
  } else if (type === "BIFURCATION" && schema.consequence) {
    left = schema.routeA || "A";
    center = schema.consequence;
    right = schema.routeB || "B";
  } else if (type === "ASYMPTOTE" && schema.boundary) {
    left = "At most";
    center = [schema.boundary, schema.unit].filter(Boolean).join(" ");
    right = "At least";
    leftDetail = wager.a;
    rightDetail = wager.b;
  } else if (type === "PRECEDENCE" && schema.anchor) {
    left = "Before";
    center = schema.anchor;
    right = "After";
    leftDetail = wager.a;
    rightDetail = wager.b;
  }

  return (
    <div
      className={`wager-geometry wager-geometry--${type.toLowerCase()} ${
        compact ? "wager-geometry--compact" : ""
      }`}
      aria-label={`Side A: ${wager.a}. Side B: ${wager.b}.`}
    >
      <div
        className={`wager-geometry__side wager-geometry__side--a ${
          activeSide === "A" ? "is-active" : ""
        }`}
      >
        <span className="wager-geometry__marker">A</span>
        <strong>{left}</strong>
        {!compact ? <small>{leftDetail}</small> : null}
      </div>

      <div className="wager-geometry__axis" aria-hidden="true">
        <i />
        <span>{center}</span>
        <i />
      </div>

      <div
        className={`wager-geometry__side wager-geometry__side--b ${
          activeSide === "B" ? "is-active" : ""
        }`}
      >
        <span className="wager-geometry__marker">B</span>
        <strong>{right}</strong>
        {!compact ? <small>{rightDetail}</small> : null}
      </div>
    </div>
  );
}

function WagerBuilder({ initial, existingCodes, onPlace, onCancel, title }) {
  const [draft, setDraft] = useState(initial || EMPTY_DRAFT);
  const sides = generatedSides(draft);
  const normalizedCode = normalizeCode(draft.code);
  const duplicate =
    !initial && existingCodes.some((code) => code === normalizedCode);
  const valid =
    normalizedCode &&
    draft.name.trim() &&
    sides.a &&
    sides.b &&
    !duplicate;

  const preview = {
    code: normalizedCode || "—",
    name: draft.name.trim() || "Situation",
    type: draft.type,
    a: sides.a || "Side A",
    b: sides.b || "Side B",
    schema: schemaFromDraft(draft),
  };

  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  function submit(event) {
    event.preventDefault();
    if (!valid) return;
    haptic([16, 28]);
    onPlace({
      code: normalizedCode,
      name: draft.name.trim(),
      type: draft.type,
      a: sides.a,
      b: sides.b,
      schema: schemaFromDraft(draft),
      retired: false,
    });
  }

  return (
    <form className="builder" onSubmit={submit}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Wager</span>
          <h2>{title || "Place Wager"}</h2>
        </div>
        {onCancel ? (
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close">
            ×
          </button>
        ) : null}
      </div>

      <div className="builder__identity">
        <Field label="Code">
          <input
            value={draft.code}
            onChange={(event) => set("code", normalizeCode(event.target.value))}
            maxLength={2}
            disabled={Boolean(initial)}
            inputMode="text"
            autoCapitalize="characters"
          />
        </Field>
        <Field label="Situation" hint="The bounded circumstance in which this Wager exists.">
          <input
            value={draft.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="Work lunch"
          />
        </Field>
      </div>

      <fieldset className="structure-picker">
        <legend>Structure</legend>
        <div className="structure-picker__grid">
          {STRUCTURES.map((structure) => (
            <button
              key={structure.key}
              type="button"
              className={draft.type === structure.key ? "is-selected" : ""}
              onClick={() => {
                haptic(8);
                setDraft((current) => ({ ...current, type: structure.key, exact: false }));
              }}
            >
              <strong>{structure.label}</strong>
              <span>{structure.description}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="builder__definition">
        {draft.exact ? (
          <div className="builder__two-fields">
            <Field label="Side A">
              <input
                value={draft.exactA}
                onChange={(event) => set("exactA", event.target.value)}
              />
            </Field>
            <Field label="Side B">
              <input
                value={draft.exactB}
                onChange={(event) => set("exactB", event.target.value)}
              />
            </Field>
          </div>
        ) : null}

        {!draft.exact && draft.type === "NOT" ? (
          <Field label="Act" hint="The same act is positively enacted or positively not enacted.">
            <input
              value={draft.act}
              onChange={(event) => set("act", event.target.value)}
              placeholder="buy lunch"
            />
          </Field>
        ) : null}

        {!draft.exact && draft.type === "BIFURCATION" ? (
          <>
            <Field label="Consequence" hint="What remains indistinguishable between the two routes.">
              <input
                value={draft.consequence}
                onChange={(event) => set("consequence", event.target.value)}
                placeholder="Obtain an adequate low-friction lunch"
              />
            </Field>
            <div className="builder__two-fields">
              <Field label="Route A">
                <input
                  value={draft.routeA}
                  onChange={(event) => set("routeA", event.target.value)}
                  placeholder="Maple Pizza"
                />
              </Field>
              <Field label="Route B">
                <input
                  value={draft.routeB}
                  onChange={(event) => set("routeB", event.target.value)}
                  placeholder="prepared fallback"
                />
              </Field>
            </div>
          </>
        ) : null}

        {!draft.exact && draft.type === "ASYMPTOTE" ? (
          <>
            <Field label="Measure" hint="The act or quantity measured on the shared axis.">
              <input
                value={draft.measure}
                onChange={(event) => set("measure", event.target.value)}
                placeholder="Use nicotine"
              />
            </Field>
            <div className="builder__boundary-fields">
              <Field label="Boundary">
                <input
                  value={draft.boundary}
                  onChange={(event) => set("boundary", event.target.value)}
                  placeholder="6"
                  inputMode="decimal"
                />
              </Field>
              <Field label="Unit">
                <input
                  value={draft.unit}
                  onChange={(event) => set("unit", event.target.value)}
                  placeholder="units"
                />
              </Field>
            </div>
          </>
        ) : null}

        {!draft.exact && draft.type === "PRECEDENCE" ? (
          <>
            <Field label="Act">
              <input
                value={draft.act}
                onChange={(event) => set("act", event.target.value)}
                placeholder="Make the payment"
              />
            </Field>
            <Field label="Anchor" hint="The shared point around which temporal direction differs.">
              <input
                value={draft.anchor}
                onChange={(event) => set("anchor", event.target.value)}
                placeholder="payday"
              />
            </Field>
          </>
        ) : null}

        <button
          type="button"
          className="text-button"
          onClick={() => {
            const nextSides = generatedSides(draft);
            setDraft((current) => ({
              ...current,
              exact: !current.exact,
              exactA: current.exactA || nextSides.a,
              exactB: current.exactB || nextSides.b,
            }));
          }}
        >
          {draft.exact ? "Use structured wording" : "Use exact wording"}
        </button>
      </div>

      <div className="builder__preview">
        <span className="eyebrow">Wager object</span>
        <div className="wager-ticket">
          <div className="wager-ticket__head">
            <strong>{preview.code}</strong>
            <span>{preview.name}</span>
            <small>{STRUCTURES.find((item) => item.key === preview.type)?.label}</small>
          </div>
          <WagerGeometry wager={preview} />
        </div>
      </div>

      {duplicate ? <p className="form-error">That code is already in use.</p> : null}

      <div className="builder__actions">
        {onCancel ? (
          <button type="button" className="button button--quiet" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="button button--primary" disabled={!valid}>
          {initial ? "Revise Wager" : "Place Wager"}
        </button>
      </div>
    </form>
  );
}

function WagerTicket({ wager, onEdit, onRetire, onRestore }) {
  return (
    <article className={`wager-ticket ${wager.retired ? "is-retired" : ""}`}>
      <div className="wager-ticket__head">
        <strong>{wager.code}</strong>
        <span>{wager.name}</span>
        <small>{STRUCTURES.find((item) => item.key === wager.type)?.label || wager.type}</small>
      </div>
      <WagerGeometry wager={wager} compact />
      <div className="wager-ticket__actions">
        {wager.retired ? (
          <button className="text-button" onClick={onRestore}>Restore</button>
        ) : (
          <>
            <button className="text-button" onClick={onEdit}>Revise</button>
            <button className="text-button" onClick={onRetire}>Retire</button>
          </>
        )}
      </div>
    </article>
  );
}

function WagerSurface({ wagers, saveWagers, day, saveDay }) {
  const [builder, setBuilder] = useState(null);
  const active = wagers.filter((wager) => !wager.retired);
  const retired = wagers.filter((wager) => wager.retired);

  function place(wager) {
    if (builder?.code) {
      saveWagers(
        wagers.map((current) =>
          current.code === builder.code ? { ...current, ...wager } : current,
        ),
      );
    } else {
      saveWagers([...wagers, wager]);
    }
    setBuilder(null);
  }

  function retire(code) {
    saveWagers(
      wagers.map((wager) =>
        wager.code === code ? { ...wager, retired: true } : wager,
      ),
    );
    if (day?.wagers?.[code]) {
      const nextWagers = { ...day.wagers };
      delete nextWagers[code];
      saveDay({ ...day, wagers: nextWagers });
    }
  }

  function restore(code) {
    saveWagers(
      wagers.map((wager) =>
        wager.code === code ? { ...wager, retired: false } : wager,
      ),
    );
  }

  if (builder) {
    const existing = builder.code
      ? wagers.find((wager) => wager.code === builder.code)
      : null;
    return (
      <section className="surface surface--wager">
        <WagerBuilder
          initial={existing ? draftFromWager(existing) : null}
          existingCodes={wagers.map((wager) => wager.code)}
          title={existing ? "Revise Wager" : "Place Wager"}
          onPlace={place}
          onCancel={() => setBuilder(null)}
        />
      </section>
    );
  }

  return (
    <section className="surface surface--wager">
      <div className="surface-heading">
        <div>
          <span className="eyebrow">Wager</span>
          <h1>Placed Wagers</h1>
        </div>
        <button className="button button--primary" onClick={() => setBuilder({})}>
          Place Wager
        </button>
      </div>

      {active.length ? (
        <div className="wager-list">
          {active.map((wager) => (
            <WagerTicket
              key={wager.code}
              wager={wager}
              onEdit={() => setBuilder({ code: wager.code })}
              onRetire={() => retire(wager.code)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state__symbol">◇</div>
          <h2>No active Wagers</h2>
          <p>A Wager defines the field of the Flip.</p>
          <button className="button button--primary" onClick={() => setBuilder({})}>
            Place first Wager
          </button>
        </div>
      )}

      {retired.length ? (
        <details className="retired-list">
          <summary>Retired · {retired.length}</summary>
          <div className="wager-list wager-list--retired">
            {retired.map((wager) => (
              <WagerTicket
                key={wager.code}
                wager={wager}
                onRestore={() => restore(wager.code)}
              />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function Reel({ label, value, spinning, tone = "neutral" }) {
  return (
    <div className={`reel reel--${tone} ${spinning ? "is-spinning" : ""}`}>
      <span className="reel__label">{label}</span>
      <div className="reel__window">
        <div className="reel__value">{value}</div>
      </div>
    </div>
  );
}

function FlipEvent({ dayNumber, closingDay, wagers, results, onFinished }) {
  const [index, setIndex] = useState(-1);
  const [phase, setPhase] = useState(closingDay ? "record" : "day");
  const timers = useRef([]);
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const current = index >= 0 ? results[index] : null;
  const wager = current
    ? wagers.find((candidate) => candidate.code === current.code)
    : null;

  const delay = useCallback(
    (callback, milliseconds) => {
      const timer = window.setTimeout(callback, reducedMotion ? 30 : milliseconds);
      timers.current.push(timer);
    },
    [reducedMotion],
  );

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  const advanceWager = useCallback(() => {
    if (index + 1 < results.length) {
      setIndex((value) => value + 1);
      setPhase("load");
    } else {
      setPhase("settle");
    }
  }, [index, results.length]);

  useEffect(() => {
    clearTimers();

    if (phase === "record") {
      haptic(18);
      delay(() => setPhase("day"), 650);
    } else if (phase === "day") {
      delay(() => {
        if (results.length) {
          setIndex(0);
          setPhase("load");
        } else {
          setPhase("settle");
        }
      }, 600);
    } else if (phase === "load") {
      haptic(8);
      delay(() => setPhase("gate-spin"), 520);
    } else if (phase === "gate-spin") {
      haptic([12, 20, 12]);
      delay(() => setPhase("gate-land"), 1050);
    } else if (phase === "gate-land") {
      delay(() => {
        if (current?.mode === "O") {
          setPhase("open");
        } else if (current?.seed) {
          setPhase("seed");
        } else {
          setPhase("reference-spin");
        }
      }, 680);
    } else if (phase === "open" || phase === "seed") {
      haptic(current?.mode === "O" ? 16 : [18, 32]);
      delay(advanceWager, 1050);
    } else if (phase === "reference-spin") {
      haptic([14, 24, 14]);
      delay(() => setPhase("reference-land"), 900);
    } else if (phase === "reference-land") {
      delay(() => setPhase("invert"), 650);
    } else if (phase === "invert") {
      haptic([16, 24, 24]);
      delay(() => setPhase("resolved"), 760);
    } else if (phase === "resolved") {
      haptic(22);
      delay(advanceWager, 900);
    } else if (phase === "settle") {
      haptic(18);
      delay(onFinished, 1050);
    }

    return clearTimers;
  }, [
    advanceWager,
    clearTimers,
    current?.mode,
    current?.seed,
    delay,
    onFinished,
    phase,
    results.length,
  ]);

  const gateValue = phase === "gate-spin" ? "OPEN · CONSTRAINED" : current?.mode === "O" ? "OPEN" : "CONSTRAINED";
  const referenceValue = current?.reference === "L" ? "LAST" : "LAST CONSTRAINED";
  const referenceSide = current?.referenceSide || (current?.side === "A" ? "B" : "A");

  return (
    <div className="flip-event" role="dialog" aria-modal="true" aria-label={`Flip Day ${dayNumber}`}>
      <div className="machine-shell">
        <div className="machine-shell__brand">
          <span>ATDU</span>
          <small>Wager · Coin · Ledger</small>
        </div>

        {phase === "record" ? (
          <div className="event-stage event-stage--record">
            <span className="eyebrow">Ledger</span>
            <h2>Record Day {closingDay?.day}</h2>
            <div className="ledger-tape ledger-tape--event">
              <strong>{String(closingDay?.day || "").padStart(3, "0")}</strong>
              {Object.entries(closingDay?.entries || {}).map(([code, entry]) => (
                <span key={code}>{code} {resolutionCode(entry)}</span>
              ))}
            </div>
          </div>
        ) : null}

        {phase === "day" ? (
          <div className="event-stage event-stage--day">
            <span className="eyebrow">Coin</span>
            <h2>Day {dayNumber}</h2>
            <p>{results.length} Wager{results.length === 1 ? "" : "s"} loaded</p>
          </div>
        ) : null}

        {current && wager && !["record", "day", "settle"].includes(phase) ? (
          <div className="event-stage event-stage--machine">
            <div className="loaded-wager">
              <span>{wager.code}</span>
              <strong>{wager.name}</strong>
              <small>{index + 1} / {results.length}</small>
            </div>

            <WagerGeometry
              wager={wager}
              compact
              activeSide={["resolved", "invert"].includes(phase) ? current.side : null}
            />

            <div className="reel-bank">
              <Reel
                label="Gate"
                value={gateValue}
                spinning={phase === "gate-spin"}
                tone={current.mode === "O" ? "open" : "constrained"}
              />

              {["reference-spin", "reference-land", "invert", "resolved"].includes(phase) ? (
                <Reel
                  label="Reference"
                  value={phase === "reference-spin" ? "LAST · LAST CONSTRAINED" : referenceValue}
                  spinning={phase === "reference-spin"}
                />
              ) : null}
            </div>

            {phase === "open" ? (
              <div className="event-result event-result--open">
                <span>OPEN</span>
                <strong>A ↔ B</strong>
                <small>Unresolved</small>
              </div>
            ) : null}

            {phase === "seed" ? (
              <div className="event-result">
                <span>CONSTRAINED</span>
                <strong>No Reference</strong>
                <small>Resolve today</small>
              </div>
            ) : null}

            {phase === "reference-land" ? (
              <div className="memory-token">
                <span>{referenceValue}</span>
                <strong>{referenceSide}</strong>
              </div>
            ) : null}

            {phase === "invert" ? (
              <div className="inversion">
                <span>{referenceSide}</span>
                <i>→</i>
                <strong>{current.side}</strong>
              </div>
            ) : null}

            {phase === "resolved" ? (
              <div className="event-result event-result--resolved">
                <span>Resolved</span>
                <strong>{current.mode}{current.side}</strong>
                <small>{sideText(wager, current.side)}</small>
              </div>
            ) : null}
          </div>
        ) : null}

        {phase === "settle" ? (
          <div className="event-stage event-stage--settle">
            <span className="eyebrow">Coin</span>
            <h2>Day {dayNumber}</h2>
            <div className="resolution-register">
              {results.map((result) => (
                <span key={result.code}>
                  <small>{result.code}</small>
                  <strong>{result.mode}{result.side || "·"}</strong>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <button className="event-skip" onClick={onFinished}>Enter Day {dayNumber}</button>
    </div>
  );
}

function DayWager({ wager, state, onSide, onNull, onRestore }) {
  if (state.nulled) {
    return (
      <article className="day-wager day-wager--null">
        <div className="day-wager__head">
          <strong>{wager.code}</strong>
          <span>{wager.name}</span>
          <em>Null</em>
        </div>
        <div className="null-object">
          <strong>∅</strong>
          <span>Null</span>
        </div>
        <button className="text-button" onClick={onRestore}>Restore Wager</button>
      </article>
    );
  }

  const openLike = state.mode === "O" || state.seed;
  const code = state.side ? `${state.mode}${state.side}` : null;

  return (
    <article className="day-wager">
      <div className="day-wager__head">
        <strong>{wager.code}</strong>
        <span>{wager.name}</span>
        <em>{state.mode === "O" ? "Open" : state.seed ? "Constrained · no reference" : "Constrained"}</em>
      </div>

      <WagerGeometry wager={wager} compact activeSide={state.side} />

      {openLike ? (
        <div className="resolution-controls">
          <button
            className={`side-control side-control--a ${state.side === "A" ? "is-selected" : ""}`}
            onClick={() => onSide("A")}
          >
            <span>{state.mode}A</span>
            <strong>{wager.a}</strong>
          </button>
          <button
            className={`side-control side-control--b ${state.side === "B" ? "is-selected" : ""}`}
            onClick={() => onSide("B")}
          >
            <span>{state.mode}B</span>
            <strong>{wager.b}</strong>
          </button>
        </div>
      ) : (
        <div className="locked-resolution">
          <span>{code}</span>
          <strong>{sideText(wager, state.side)}</strong>
        </div>
      )}

      <button className="text-button day-wager__null" onClick={onNull}>
        Wager unavailable
      </button>
    </article>
  );
}

function CoinSurface({ wagers, ledger, day, saveDay, saveLedger, goWager }) {
  const [event, setEvent] = useState(null);
  const active = wagers.filter((wager) => !wager.retired);
  const currentWagers = day
    ? active.filter((wager) => day.wagers[wager.code])
    : [];
  const pending = day
    ? active.filter((wager) => !day.wagers[wager.code])
    : active;
  const remaining = unresolvedCount(day);
  const canFlip = active.length > 0 && (!day || reconciled(day));

  function setSide(code, side) {
    haptic(10);
    const current = day.wagers[code];
    saveDay({
      ...day,
      wagers: {
        ...day.wagers,
        [code]: { ...current, side, nulled: false },
      },
    });
  }

  function setNull(code, nulled) {
    haptic(8);
    const current = day.wagers[code];
    saveDay({
      ...day,
      wagers: {
        ...day.wagers,
        [code]: {
          ...current,
          nulled,
          side: nulled && (current.mode === "O" || current.seed) ? null : current.side,
        },
      },
    });
  }

  function flip() {
    if (!canFlip) return;
    haptic([28, 24, 28]);
    const closingDay = day
      ? {
          day: day.day,
          date: day.date,
          entries: Object.fromEntries(
            Object.entries(day.wagers).map(([code, state]) => [
              code,
              state.nulled
                ? { null: true }
                : { mode: state.mode, side: state.side },
            ]),
          ),
        }
      : null;
    const nextLedger = day ? commitDay(day, ledger) : ledger;
    const flipped = flipDay(active.map((wager) => wager.code), nextLedger);
    const nextNumber = (day ? day.day : nextLedger.length) + 1;
    const nextDay = { day: nextNumber, date: todayISO(), wagers: flipped };

    saveLedger(nextLedger);
    saveDay(nextDay);
    setEvent({
      dayNumber: nextNumber,
      closingDay,
      results: active.map((wager) => ({ code: wager.code, ...flipped[wager.code] })),
    });
  }

  if (!active.length) {
    return (
      <section className="surface surface--coin">
        <div className="coin-empty">
          <div className="machine-miniature" aria-hidden="true">
            <i /><i /><i />
          </div>
          <span className="eyebrow">Coin</span>
          <h1>No active Wagers</h1>
          <button className="button button--primary" onClick={goWager}>Wager</button>
        </div>
      </section>
    );
  }

  return (
    <section className="surface surface--coin">
      <div className="coin-cabinet">
        <div className="coin-cabinet__marquee">
          <span>ATDU</span>
          <small>Deterministic uncertainty</small>
        </div>

        <div className="coin-cabinet__status">
          <span className="eyebrow">Coin</span>
          <h1>{day ? `Day ${day.day}` : "No day recorded"}</h1>
          {day ? (
            remaining === 0 ? (
              <strong>Reconciled</strong>
            ) : (
              <strong>{remaining} unresolved</strong>
            )
          ) : (
            <strong>{active.length} Wager{active.length === 1 ? "" : "s"} loaded</strong>
          )}
        </div>

        {day ? (
          <div className="day-board">
            {currentWagers.map((wager) => (
              <DayWager
                key={wager.code}
                wager={wager}
                state={day.wagers[wager.code]}
                onSide={(side) => setSide(wager.code, side)}
                onNull={() => setNull(wager.code, true)}
                onRestore={() => setNull(wager.code, false)}
              />
            ))}
          </div>
        ) : null}

        {pending.length && day ? (
          <div className="pending-strip">
            <span>Next Flip</span>
            <strong>{pending.map((wager) => wager.code).join(" · ")}</strong>
          </div>
        ) : null}

        <div className="flip-control">
          <button
            type="button"
            className="flip-button"
            disabled={!canFlip}
            onClick={flip}
            aria-label={`Flip Day ${(day ? day.day : ledger.length) + 1}`}
          >
            <span className="flip-button__cap">●</span>
            <span className="flip-button__label">Flip</span>
          </button>
          <small>
            {canFlip
              ? `Day ${(day ? day.day : ledger.length) + 1}`
              : `Reconcile ${remaining} Wager${remaining === 1 ? "" : "s"}`}
          </small>
        </div>
      </div>

      {event ? (
        <FlipEvent
          dayNumber={event.dayNumber}
          closingDay={event.closingDay}
          wagers={wagers}
          results={event.results}
          onFinished={() => setEvent(null)}
        />
      ) : null}
    </section>
  );
}

function LedgerSurface({ wagers, ledger }) {
  const [selected, setSelected] = useState(null);
  const wagerColumns = useMemo(() => {
    const inLedger = new Set();
    ledger.forEach((day) => Object.keys(day.entries).forEach((code) => inLedger.add(code)));
    return wagers.filter((wager) => !wager.retired || inLedger.has(wager.code));
  }, [ledger, wagers]);

  const selectedWager =
    wagerColumns.find((wager) => wager.code === selected) || wagerColumns[0] || null;
  const selectedMemory = selectedWager ? memory(ledger, selectedWager.code) : null;

  function downloadLedger() {
    const text = exportText(wagers, ledger);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "atdu-ledger.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="surface surface--ledger">
      <div className="surface-heading">
        <div>
          <span className="eyebrow">Ledger</span>
          <h1>Persistent trace</h1>
        </div>
        {ledger.length ? (
          <button className="button button--quiet" onClick={downloadLedger}>Export</button>
        ) : null}
      </div>

      {!ledger.length ? (
        <div className="empty-state">
          <div className="empty-state__symbol">≡</div>
          <h2>The Ledger is empty</h2>
          <p>The first reconciled day enters at the next Flip.</p>
        </div>
      ) : (
        <>
          <div className="ledger-machine">
            <div className="ledger-machine__slot">LEDGER</div>
            <div className="ledger-scroll" tabIndex="0">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    {wagerColumns.map((wager) => (
                      <th key={wager.code}>
                        <button
                          className={selectedWager?.code === wager.code ? "is-selected" : ""}
                          onClick={() => setSelected(wager.code)}
                          title={wager.name}
                        >
                          {wager.code}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((record) => (
                    <tr key={record.day}>
                      <th>{String(record.day).padStart(3, "0")}</th>
                      {wagerColumns.map((wager) => {
                        const entry = record.entries[wager.code];
                        const code = entry ? resolutionCode(entry) : "";
                        return (
                          <td key={wager.code}>
                            {entry ? (
                              <span
                                className={`ledger-code ledger-code--${code === "∅" ? "null" : code.toLowerCase()}`}
                                title={entry.null ? "Null" : `${sideText(wager, entry.side)} · ${entry.mode === "O" ? "Open" : "Constrained"}`}
                              >
                                {code}
                              </span>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedWager && selectedMemory ? (
            <div className="memory-panel">
              <div>
                <span className="eyebrow">Wager</span>
                <h2>{selectedWager.code} · {selectedWager.name}</h2>
              </div>
              <div className="memory-pair">
                <div>
                  <span>Last</span>
                  <strong>{selectedMemory.L || "—"}</strong>
                </div>
                <div>
                  <span>Last Constrained</span>
                  <strong>{selectedMemory.K || "—"}</strong>
                </div>
              </div>
              <WagerGeometry wager={selectedWager} compact />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function RuleDialog({ onClose, onReset }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="rule-dialog" role="dialog" aria-modal="true" aria-labelledby="rule-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="panel-heading">
          <div>
            <span className="eyebrow">ATDU</span>
            <h2 id="rule-title">The rule</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="rule-copy">
          <p>A Wager is one Situation divided into two Sides through one differentiator. Both Sides must be available.</p>
          <p>Flip once. Open: resolve either Side.</p>
          <p>Constrained: the Coin selects Last or Last Constrained; invert the selected Side.</p>
          <p>If either Side is unavailable, the Wager is Null.</p>
          <p>Reconcile every Wager before the next Flip. Record the day in the Ledger.</p>
        </div>
        <div className="proof-strip">
          <span>π = (2 + 3p) / 7</span>
          <span>2/7 ≤ π ≤ 5/7</span>
        </div>
        <div className="rule-dialog__danger">
          <button className="text-button" onClick={onReset}>Reset all data</button>
        </div>
      </section>
    </div>
  );
}

const NAVIGATION = [
  { id: "wager", label: "Wager", symbol: "◇" },
  { id: "coin", label: "Coin", symbol: "●" },
  { id: "ledger", label: "Ledger", symbol: "≡" },
];

export default function App() {
  const [view, setView] = useState(null);
  const [wagers, setWagers] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [day, setDay] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [showRule, setShowRule] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await navigator.storage?.persist?.();
      } catch {
        // Optional persistence request.
      }
      const storedWagers = parse(await storageGet(STORAGE_KEYS.wagers), []);
      const storedLedger = parse(await storageGet(STORAGE_KEYS.ledger), []);
      const storedDay = parse(await storageGet(STORAGE_KEYS.day), null);
      if (!active) return;
      const nextWagers = Array.isArray(storedWagers) ? storedWagers : [];
      setWagers(nextWagers);
      setLedger(Array.isArray(storedLedger) ? storedLedger : []);
      setDay(storedDay?.day ? storedDay : null);
      setView(nextWagers.some((wager) => !wager.retired) ? "coin" : "wager");
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const saveWagers = useCallback((next) => {
    setWagers(next);
    storageSet(STORAGE_KEYS.wagers, JSON.stringify(next));
  }, []);

  const saveLedger = useCallback((next) => {
    setLedger(next);
    storageSet(STORAGE_KEYS.ledger, JSON.stringify(next));
  }, []);

  const saveDay = useCallback((next) => {
    setDay(next);
    if (next) storageSet(STORAGE_KEYS.day, JSON.stringify(next));
    else storageDelete(STORAGE_KEYS.day);
  }, []);

  function reset() {
    if (!window.confirm("Erase all Wagers, the current day, and the Ledger?")) return;
    saveWagers([]);
    saveLedger([]);
    saveDay(null);
    setShowRule(false);
    setView("wager");
  }

  if (!loaded) return <div className="app-loading" aria-label="Loading" />;

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="brand" onClick={() => setView("coin")} aria-label="ATDU Coin">
          <strong>ATDU</strong>
          <span>Wager · Coin · Ledger</span>
        </button>
        <button className="rule-button" onClick={() => setShowRule(true)}>Rule</button>
      </header>

      <main className="app-main">
        {view === "wager" ? (
          <WagerSurface wagers={wagers} saveWagers={saveWagers} day={day} saveDay={saveDay} />
        ) : null}
        {view === "coin" ? (
          <CoinSurface
            wagers={wagers}
            ledger={ledger}
            day={day}
            saveDay={saveDay}
            saveLedger={saveLedger}
            goWager={() => setView("wager")}
          />
        ) : null}
        {view === "ledger" ? <LedgerSurface wagers={wagers} ledger={ledger} /> : null}
      </main>

      <nav className="primary-nav" aria-label="Primary objects">
        {NAVIGATION.map((item) => (
          <button
            key={item.id}
            className={view === item.id ? "is-current" : ""}
            onClick={() => {
              haptic(6);
              setView(item.id);
            }}
            aria-current={view === item.id ? "page" : undefined}
          >
            <span>{item.symbol}</span>
            <strong>{item.label}</strong>
          </button>
        ))}
      </nav>

      {showRule ? <RuleDialog onClose={() => setShowRule(false)} onReset={reset} /> : null}
    </div>
  );
}
