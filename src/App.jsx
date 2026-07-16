import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  commitDay,
  exportText,
  memory,
  notation,
  nextDayNumber,
  PI_MAX,
  PI_MIN,
  piTheory,
  prepareDay,
  reconciled,
  simulate,
  unresolvedCount,
} from "./engine.js";
import { storage } from "./storage.js";
import {
  STORAGE_KEYS,
  TEXT_LIMITS,
  WAGER_STRUCTURES,
  hydrateDay,
  hydrateLedger,
  hydrateNextNull,
  hydrateWagers,
  normalizeAuthoredText,
  normalizeCode,
  parseStored,
  sameWagerDefinition,
  schemaFromDraft,
  snapshotDay,
  snapshotWager,
  updateWager,
  validateWagerDraft,
} from "./model.js";
import "./App.css";

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
  anchor: "",
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

function createMechanicalSound(enabled) {
  if (!enabled || typeof window === "undefined") return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  let context;
  try {
    context = new AudioContext();
    context.resume?.().catch?.(() => {});
  } catch {
    return null;
  }

  function pulse(frequency, duration = 0.045, offset = 0, volume = 0.026, type = "square") {
    const start = context.currentTime + offset;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  return {
    engage() {
      pulse(82, 0.09, 0, 0.04, "sine");
      pulse(123, 0.07, 0.08, 0.03, "square");
    },
    load() {
      pulse(150, 0.035);
      pulse(118, 0.05, 0.065);
    },
    spin(high = false, duration = 3.2) {
      [
        0, 0.15, 0.27, 0.37, 0.46, 0.54, 0.62, 0.7,
        0.78, 0.86, 0.94, 1.02, 1.1, 1.18, 1.26, 1.34,
        1.42, 1.5, 1.58, 1.66, 1.74, 1.82, 1.9, 1.98,
        2.07, 2.17, 2.28, 2.4, 2.54, 2.7, 2.88, 3.08,
      ].filter((offset) => offset < duration).forEach((offset, index) => {
        pulse((high ? 210 : 150) + (index % 3) * 24, 0.018, offset, 0.013);
      });
    },
    land() {
      pulse(92, 0.08, 0, 0.05, "triangle");
      pulse(64, 0.13, 0.055, 0.045, "sine");
    },
    relay() {
      pulse(235, 0.028, 0, 0.024);
      pulse(185, 0.035, 0.055, 0.022);
    },
    invert() {
      pulse(110, 0.055, 0, 0.03, "sawtooth");
      pulse(165, 0.055, 0.07, 0.03, "sawtooth");
      pulse(220, 0.07, 0.14, 0.035, "sawtooth");
    },
    lock() {
      pulse(72, 0.11, 0, 0.055, "triangle");
      pulse(72, 0.05, 0.11, 0.032, "square");
    },
    print() {
      [0, 0.055, 0.11, 0.165, 0.22, 0.275].forEach((offset) => pulse(260, 0.018, offset, 0.012));
    },
    close() {
      context.close?.();
    },
  };
}

async function storageGet(key) {
  try {
    const value = await storage.get(key);
    return value?.value ?? null;
  } catch {
    return null;
  }
}

async function storageSet(key, value) {
  try {
    await storage.set(key, value);
  } catch {
    // The interface remains usable if persistence is unavailable.
  }
}

async function storageDelete(key) {
  try {
    await storage.delete(key);
  } catch {
    // No-op.
  }
}

function todayISO() {
  return new Date().toISOString();
}

function sideText(wager, side) {
  return side === "A" ? wager.a : wager.b;
}

function SideContent({ wager, side }) {
  return (
    <>
      <i className="side-marker">{side}</i>
      <strong className="side-copy">{sideText(wager, side)}</strong>
    </>
  );
}

function CoinGlyph({ className = "" }) {
  return (
    <svg className={`coin-glyph ${className}`} viewBox="0 0 32 32" aria-hidden="true">
      <ellipse cx="17" cy="18" rx="10" ry="8" />
      <ellipse cx="15" cy="14" rx="10" ry="8" />
      <path d="M8 12.5c2.8 2.2 11.2 2.2 14 0M10 18c2.8 1.4 7.2 1.4 10 0" />
      <path className="coin-glyph__mark" d="M15 10.5v7M12.8 12.2h4.4" />
    </svg>
  );
}

function PhysicalCoin({ className = "" }) {
  return (
    <span className={`physical-coin ${className}`} aria-hidden="true">
      <span className="physical-coin__face physical-coin__face--front">
        <small>ATDU</small>
        <b>C</b>
        <i>COIN</i>
      </span>
      <span className="physical-coin__face physical-coin__face--back">
        <small>ATDU</small>
        <b>F</b>
        <i>FLIP</i>
      </span>
    </span>
  );
}

function structureLabel(wager) {
  return WAGER_STRUCTURES.find((item) => item.key === wager.type)?.label || wager.type;
}

function WagerIdentity({ wager, meta, className = "" }) {
  return (
    <div className={`wager-identity ${className}`}>
      <strong>{wager.code}</strong>
      <span>{wager.name}</span>
      <small>{meta || structureLabel(wager)}</small>
    </div>
  );
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
    boundary: schema.reference || [schema.boundary, schema.unit].filter(Boolean).join(" "),
    anchor: schema.anchor || "",
  };
}

function Field({ label, children, hint, error, value = "", limit }) {
  const length = value.length;
  const nearingLimit = limit && length / limit >= 0.8;
  const overLimit = limit && length > limit;

  return (
    <label className={`field ${nearingLimit ? "is-near-limit" : ""} ${overLimit ? "is-over-limit" : ""} ${error ? "is-invalid" : ""}`}>
      <span className="field__label">{label}</span>
      {children}
      {limit ? (
        <span className="field__meta">
          <span className={`field__hint ${error ? "field__error" : ""}`} role={error ? "alert" : undefined}>{error || hint || ""}</span>
          <span className="field__count">{length} / {limit}</span>
        </span>
      ) : error || hint ? <span className={`field__hint ${error ? "field__error" : ""}`} role={error ? "alert" : undefined}>{error || hint}</span> : null}
    </label>
  );
}

function WagerGeometry({ wager, compact = false }) {
  const type = wager.type || "NOT";

  return (
    <div
      className={`wager-geometry wager-geometry--${type.toLowerCase()} ${
        compact ? "wager-geometry--compact" : ""
      }`}
      aria-label={`Side A: ${wager.a}. Side B: ${wager.b}.`}
    >
      <div
        className="wager-geometry__side wager-geometry__side--a"
      >
        <SideContent wager={wager} side="A" />
      </div>

      <div
        className="wager-geometry__side wager-geometry__side--b"
      >
        <SideContent wager={wager} side="B" />
      </div>
    </div>
  );
}

function WagerBuilder({ initial, initialWager, existingCodes, onPlace, onCancel, title }) {
  const [draft, setDraft] = useState(initial || EMPTY_DRAFT);
  const [attempted, setAttempted] = useState(false);
  const validation = validateWagerDraft(draft, existingCodes, initialWager?.code);
  const { errors, sides, valid } = validation;
  const normalizedCode = normalizeCode(draft.code);
  const unchanged = Boolean(initialWager && valid && sameWagerDefinition(initialWager, validation.wager));
  const shownError = (key) => attempted ? errors[key] : null;

  const preview = {
    code: normalizedCode || "—",
    name: normalizeAuthoredText(draft.name, TEXT_LIMITS.situation) || "Wager",
    type: draft.type,
    a: sides.a || WAGER_STRUCTURES.find((item) => item.key === draft.type)?.form.split(" / ")[0],
    b: sides.b || WAGER_STRUCTURES.find((item) => item.key === draft.type)?.form.split(" / ")[1],
    schema: schemaFromDraft(draft),
  };

  const set = (key, value, limit = TEXT_LIMITS.term) =>
    setDraft((current) => ({ ...current, [key]: value.slice(0, limit) }));

  function submit(event) {
    event.preventDefault();
    if (!valid) {
      setAttempted(true);
      const form = event.currentTarget;
      window.requestAnimationFrame(() => form.querySelector("[aria-invalid='true']")?.focus());
      return;
    }
    if (unchanged) return;
    haptic([16, 28]);
    onPlace(validation.wager);
  }

  return (
    <form className="builder" onSubmit={submit} noValidate>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Wager</span>
          <h1>{title || "Place Wager"}</h1>
        </div>
        {onCancel ? (
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close">
            ×
          </button>
        ) : null}
      </div>

      <div className="builder__identity">
        <Field label="Code" value={draft.code} limit={TEXT_LIMITS.code} error={shownError("code")}>
          <input
            value={draft.code}
            onChange={(event) => set("code", normalizeCode(event.target.value))}
            maxLength={TEXT_LIMITS.code}
            disabled={Boolean(initial)}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            required
            pattern="[A-Z0-9]{1,2}"
            aria-invalid={Boolean(shownError("code"))}
          />
        </Field>
        <Field
          label="Situation"
          hint="The bounded circumstance in which this Wager exists."
          value={draft.name}
          limit={TEXT_LIMITS.situation}
          error={shownError("name")}
        >
          <input
            value={draft.name}
            onChange={(event) => set("name", event.target.value, TEXT_LIMITS.situation)}
            maxLength={TEXT_LIMITS.situation}
            required
            aria-invalid={Boolean(shownError("name"))}
          />
        </Field>
      </div>

      <fieldset className="structure-picker">
        <legend>Structure</legend>
        <div className="structure-picker__grid">
          {WAGER_STRUCTURES.map((structure) => (
            <button
              key={structure.key}
              type="button"
              className={draft.type === structure.key ? "is-selected" : ""}
              aria-pressed={draft.type === structure.key}
              onClick={() => {
                haptic(8);
                setDraft((current) => ({ ...current, type: structure.key }));
              }}
            >
              <strong>{structure.form}</strong>
              <span><b>{structure.label}</b> · {structure.description}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="builder__definition">
        {draft.type === "NOT" ? (
          <Field label="X — Act" hint="The shared act in both resolved Sides." value={draft.act} limit={TEXT_LIMITS.term} error={shownError("act")}>
            <input
              value={draft.act}
              onChange={(event) => set("act", event.target.value)}
              maxLength={TEXT_LIMITS.term}
              placeholder="X"
              required
              aria-invalid={Boolean(shownError("act"))}
            />
          </Field>
        ) : null}

        {draft.type === "BIFURCATION" ? (
          <>
            <Field label="X — Shared consequence" hint="The consequence held invariant across both routes." value={draft.consequence} limit={TEXT_LIMITS.term} error={shownError("consequence")}>
              <input
                value={draft.consequence}
                onChange={(event) => set("consequence", event.target.value)}
                maxLength={TEXT_LIMITS.term}
                placeholder="X"
                required
                aria-invalid={Boolean(shownError("consequence"))}
              />
            </Field>
            <div className="builder__two-fields">
              <Field label="Y — First route" value={draft.routeA} limit={TEXT_LIMITS.term} error={shownError("routeA")}>
                <input
                  value={draft.routeA}
                  onChange={(event) => set("routeA", event.target.value)}
                  maxLength={TEXT_LIMITS.term}
                  placeholder="Y"
                  required
                  aria-invalid={Boolean(shownError("routeA"))}
                />
              </Field>
              <Field label="Z — Second route" value={draft.routeB} limit={TEXT_LIMITS.term} error={shownError("routeB")}>
                <input
                  value={draft.routeB}
                  onChange={(event) => set("routeB", event.target.value)}
                  maxLength={TEXT_LIMITS.term}
                  placeholder="Z"
                  required
                  aria-invalid={Boolean(shownError("routeB"))}
                />
              </Field>
            </div>
          </>
        ) : null}

        {draft.type === "ASYMPTOTE" ? (
          <div className="builder__two-fields">
            <Field label="X — Measure" hint="The shared variable resolved around one boundary." value={draft.measure} limit={TEXT_LIMITS.term} error={shownError("measure")}>
              <input
                value={draft.measure}
                onChange={(event) => set("measure", event.target.value)}
                maxLength={TEXT_LIMITS.term}
                placeholder="X"
                required
                aria-invalid={Boolean(shownError("measure"))}
              />
            </Field>
            <Field label="Y — Reference" hint="The shared midpoint, threshold, limit, or other reference." value={draft.boundary} limit={TEXT_LIMITS.term} error={shownError("boundary")}>
              <input
                value={draft.boundary}
                onChange={(event) => set("boundary", event.target.value)}
                maxLength={TEXT_LIMITS.term}
                placeholder="Y"
                required
                aria-invalid={Boolean(shownError("boundary"))}
              />
            </Field>
          </div>
        ) : null}

        {draft.type === "PRECEDENCE" ? (
          <>
            <Field label="X — Act or event" value={draft.act} limit={TEXT_LIMITS.term} error={shownError("act")}>
              <input
                value={draft.act}
                onChange={(event) => set("act", event.target.value)}
                maxLength={TEXT_LIMITS.term}
                placeholder="X"
                required
                aria-invalid={Boolean(shownError("act"))}
              />
            </Field>
            <Field label="Y — Temporal anchor" hint="The shared point around which temporal direction differs." value={draft.anchor} limit={TEXT_LIMITS.term} error={shownError("anchor")}>
              <input
                value={draft.anchor}
                onChange={(event) => set("anchor", event.target.value)}
                maxLength={TEXT_LIMITS.term}
                placeholder="Y"
                required
                aria-invalid={Boolean(shownError("anchor"))}
              />
            </Field>
          </>
        ) : null}
      </div>

      <div className="builder__preview">
        <span className="eyebrow">Wager object</span>
        <div className="wager-ticket">
          <WagerIdentity wager={preview} className="wager-ticket__head" />
          <WagerGeometry wager={preview} />
        </div>
      </div>

      {unchanged ? <p className="form-status">No definition has changed; no revision is required.</p> : null}

      <div className="builder__actions">
        {onCancel ? (
          <button type="button" className="button button--quiet" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="button button--primary" disabled={unchanged}>
          {unchanged ? "No changes" : initial ? "Revise Wager" : "Place Wager"}
        </button>
      </div>
    </form>
  );
}

function WagerTicket({ wager, notice, onEdit, onRetire, onRestore }) {
  return (
    <article className={`wager-ticket ${notice ? "has-notice" : ""} ${wager.retired ? "is-retired" : ""}`}>
      <WagerIdentity wager={wager} className="wager-ticket__head" />
      {notice ? <p className="wager-ticket__notice">{notice}</p> : null}
      <WagerGeometry wager={wager} compact />
      <div className="wager-ticket__actions">
        {wager.retired ? (
          <button className="text-button" onClick={onRestore}>Restore</button>
        ) : (
          <>
            {onEdit ? <button className="text-button" onClick={onEdit}>Revise</button> : null}
            <button className="text-button" onClick={onRetire}>Retire</button>
          </>
        )}
      </div>
    </article>
  );
}

function WagerSurface({ wagers, saveWagers, day }) {
  const [builder, setBuilder] = useState(null);
  const active = wagers.filter((wager) => !wager.retired);
  const retired = wagers.filter((wager) => wager.retired);

  function place(wager) {
    if (builder?.code) {
      const current = wagers.find((candidate) => candidate.code === builder.code);
      if (!current || sameWagerDefinition(current, wager)) {
        setBuilder(null);
        return;
      }
      saveWagers(
        updateWager(wagers, builder.code, {
          ...wager,
          revision: (current?.revision || 1) + 1,
        }),
      );
    } else {
      saveWagers([...wagers, { ...wager, revision: 1 }]);
    }
    setBuilder(null);
  }

  function retire(code) {
    saveWagers(
      wagers.map((wager) =>
        wager.code === code ? { ...wager, retired: true } : wager,
      ),
    );
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
          initialWager={existing}
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
          <h1>Wagers</h1>
        </div>
        {active.length ? (
          <button className="button button--primary" onClick={() => setBuilder({})}>
            Place Wager
          </button>
        ) : null}
      </div>

      {active.length ? (
        <div className="wager-list">
          {active.map((wager) => (
            <WagerTicket
              key={wager.code}
              wager={wager}
              notice={day
                ? !day.wagers[wager.code]
                  ? `Added for the Flip after Day ${day.day}`
                  : (day.wagers[wager.code].definition?.revision || 1) !== (wager.revision || 1)
                    ? `Revision ${wager.revision || 1} applies after Day ${day.day}`
                    : null
                : null}
              onEdit={wager.schema ? () => setBuilder({ code: wager.code }) : null}
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
                notice={day?.wagers[wager.code]
                  ? `Bound to Day ${day.day}; retirement begins afterward`
                  : null}
                onRestore={() => restore(wager.code)}
              />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function SideDefinition({ wager, side, subdued = false }) {
  if (!side) return <span className="side-definition side-definition--empty">Not established</span>;
  return (
    <span className={`side-definition side-definition--${side.toLowerCase()} ${subdued ? "is-subdued" : ""}`}>
      <SideContent wager={wager} side={side} />
    </span>
  );
}

function MemorySlot({ label, side, wager }) {
  const established = side === "A" || side === "B";
  return (
    <div
      className={`memory-slot ${established ? `memory-slot--${side.toLowerCase()}` : ""}`}
      aria-label={`${label}: ${established ? `Side ${side}, ${sideText(wager, side)}` : "not established"}`}
    >
      <span className="memory-slot__label">{label}</span>
      {established ? (
        <span className="memory-slot__side">
          <i className="side-marker">{side}</i>
        </span>
      ) : <span className="memory-slot__empty">Not established</span>}
    </div>
  );
}

function Reel({
  label,
  value,
  options,
  spinning,
  braking = false,
  tone = "neutral",
  duration,
}) {
  const stripRef = useRef(null);
  const rollingValues = [
    ...Array.from({ length: 32 }, (_, index) => options[index % options.length]),
    value,
  ];
  const compoundLabels = options.some((option) => option.length > 15);
  const longLabels = options.some((option) => option.length > 9);
  const travel = (rollingValues.length - 1) * 76;

  useEffect(() => {
    const strip = stripRef.current;
    if (!spinning || !strip || !strip.animate) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

    const animation = strip.animate([
      { transform: "translate3d(0, 0, 0)", offset: 0 },
      { transform: `translate3d(0, ${-travel * 0.003}px, 0)`, offset: 0.04 },
      { transform: `translate3d(0, ${-travel * 0.025}px, 0)`, offset: 0.1 },
      { transform: `translate3d(0, ${-travel * 0.09}px, 0)`, offset: 0.18 },
      { transform: `translate3d(0, ${-travel * 0.22}px, 0)`, offset: 0.3 },
      { transform: `translate3d(0, ${-travel * 0.48}px, 0)`, offset: 0.5 },
      { transform: `translate3d(0, ${-travel * 0.68}px, 0)`, offset: 0.64 },
      { transform: `translate3d(0, ${-travel * 0.8}px, 0)`, offset: 0.74 },
      { transform: `translate3d(0, ${-travel * 0.9}px, 0)`, offset: 0.84 },
      { transform: `translate3d(0, ${-travel * 0.96}px, 0)`, offset: 0.92 },
      { transform: `translate3d(0, ${-travel}px, 0)`, offset: 1 },
    ], {
      duration,
      easing: "linear",
      fill: "forwards",
    });

    return () => animation.cancel();
  }, [duration, spinning, travel, value]);

  return (
    <div className={`reel reel--${tone} ${longLabels ? "reel--long" : ""} ${compoundLabels ? "reel--compound" : ""} ${spinning ? "is-spinning" : ""} ${braking ? "is-braking" : ""}`}>
      <span className="reel__label">{label}</span>
      <div className="reel__window">
        {spinning ? (
          <div className="reel__strip" aria-hidden="true" ref={stripRef}>
            {rollingValues.map((option, index) => <span key={`${option}-${index}`}>{option}</span>)}
          </div>
        ) : (
          <div className="reel__value">{value}</div>
        )}
      </div>
      <span className="sr-only" aria-live="polite">{spinning ? `${label} rolling` : `${label}: ${value}`}</span>
    </div>
  );
}

function FlipEvent({ dayNumber, closingDay, wagers, results, predeclaredNulls = [], sound, onFinished }) {
  const [index, setIndex] = useState(-1);
  const [phase, setPhase] = useState(closingDay ? "record" : "day");
  const timers = useRef([]);
  const dialogRef = useRef(null);
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const current = index >= 0 ? results[index] : null;
  const wager = current
    ? current.definition || wagers.find((candidate) => candidate.code === current.code)
    : null;
  const pace = results.length >= 12 ? 0.16 : results.length >= 6 ? 0.36 : 1;
  const hasUpcomingDay = results.length + predeclaredNulls.length > 0;

  const delay = useCallback(
    (callback, milliseconds) => {
      const timer = window.setTimeout(
        callback,
        reducedMotion ? 30 : Math.max(70, milliseconds * pace),
      );
      timers.current.push(timer);
    },
    [pace, reducedMotion],
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

  const advancePhase = useCallback(() => {
    clearTimers();
    if (phase === "record") {
      setPhase(hasUpcomingDay ? "day" : "settle");
    } else if (phase === "day") {
      if (results.length) {
        setIndex(0);
        setPhase("load");
      } else {
        setPhase("settle");
      }
    } else if (phase === "load") {
      setPhase("gate-spin");
    } else if (phase === "gate-spin") {
      setPhase("gate-brake");
    } else if (phase === "gate-brake") {
      setPhase("gate-land");
    } else if (phase === "gate-land") {
      setPhase(current?.mode === "O" ? "open" : current?.seed ? "seed" : "reference-spin");
    } else if (phase === "open" || phase === "seed" || phase === "resolved") {
      advanceWager();
    } else if (phase === "reference-spin") {
      setPhase("reference-brake");
    } else if (phase === "reference-brake") {
      setPhase("reference-land");
    } else if (phase === "reference-land") {
      setPhase("invert");
    } else if (phase === "invert") {
      setPhase("resolved");
    }
  }, [advanceWager, clearTimers, current?.mode, current?.seed, hasUpcomingDay, phase, results.length]);

  const revealAll = useCallback(() => {
    clearTimers();
    setPhase("settle");
  }, [clearTimers]);

  useEffect(() => {
    const inertNodes = [...document.querySelectorAll(".app-header, .primary-nav, .coin-cabinet")];
    const previousOverflow = document.body.style.overflow;
    inertNodes.forEach((node) => { node.inert = true; });
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      inertNodes.forEach((node) => { node.inert = false; });
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    clearTimers();

    if (phase === "record") {
      haptic(18);
      sound?.print();
      delay(() => setPhase(hasUpcomingDay ? "day" : "settle"), 1400);
    } else if (phase === "day") {
      sound?.engage();
      delay(() => {
        if (results.length) {
          setIndex(0);
          setPhase("load");
        } else {
          setPhase("settle");
        }
      }, 900);
    } else if (phase === "load") {
      haptic(8);
      sound?.load();
      delay(() => setPhase("gate-spin"), 700);
    } else if (phase === "gate-spin") {
      haptic([12, 20, 12]);
      sound?.spin(false, 3.25 * pace);
      delay(() => setPhase("gate-brake"), 2200);
    } else if (phase === "gate-brake") {
      delay(() => setPhase("gate-land"), 1050);
    } else if (phase === "gate-land") {
      sound?.land();
      delay(() => {
        if (current?.mode === "O") {
          setPhase("open");
        } else if (current?.seed) {
          setPhase("seed");
        } else {
          setPhase("reference-spin");
        }
      }, 900);
    } else if (phase === "open" || phase === "seed") {
      haptic(current?.mode === "O" ? 16 : [18, 32]);
      sound?.lock();
      delay(advanceWager, 1500);
    } else if (phase === "reference-spin") {
      haptic([14, 24, 14]);
      sound?.spin(true, 2.8 * pace);
      delay(() => setPhase("reference-brake"), 1800);
    } else if (phase === "reference-brake") {
      delay(() => setPhase("reference-land"), 1000);
    } else if (phase === "reference-land") {
      sound?.relay();
      delay(() => setPhase("invert"), 900);
    } else if (phase === "invert") {
      haptic([16, 24, 24]);
      sound?.invert();
      delay(() => setPhase("resolved"), 1000);
    } else if (phase === "resolved") {
      haptic(22);
      sound?.lock();
      delay(advanceWager, 1400);
    } else if (phase === "settle") {
      haptic(18);
      sound?.land();
      dialogRef.current?.querySelector(".event-enter")?.focus();
    }

    return clearTimers;
  }, [
    advanceWager,
    clearTimers,
    current?.mode,
    current?.seed,
    delay,
    hasUpcomingDay,
    phase,
    pace,
    results.length,
    sound,
  ]);

  const open = current?.mode === "O";
  const gateValue = open ? "OPEN" : "CONSTRAINED";
  const conditionDisplay = phase === "load" ? "READY" : gateValue;
  const referenceValue = current?.reference === "L" ? "LAST SIDE" : "LAST CONSTRAINED SIDE";
  const referenceDisplay = ["reference-spin", "reference-brake", "reference-land", "invert", "resolved"].includes(phase)
    ? referenceValue
    : "READY";
  const referenceSide = current?.referenceSide;
  const firstCoinSpinning = ["gate-spin", "gate-brake"].includes(phase);
  const secondCoinSpinning = ["reference-spin", "reference-brake"].includes(phase);
  const gateComplete = ["gate-land", "open", "seed", "reference-spin", "reference-brake", "reference-land", "invert", "resolved"].includes(phase);
  const awaitingCondition = !gateComplete;
  const agentCoinRequired = gateComplete && !open && !current?.seed;
  const agentActive = ["reference-spin", "reference-brake", "reference-land", "invert", "resolved"].includes(phase);

  return (
    <div
      className="flip-event"
      data-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-label={`Flip Day ${dayNumber}`}
      ref={dialogRef}
      tabIndex="-1"
      onKeyDown={(event) => {
        if (["Enter", " "].includes(event.key) && event.target === dialogRef.current && phase !== "settle") {
          event.preventDefault();
          advancePhase();
        } else if (event.key === "Tab") {
          event.preventDefault();
          const target = phase === "settle"
            ? dialogRef.current?.querySelector(".event-enter")
            : dialogRef.current?.querySelector(".event-reveal-all") || dialogRef.current;
          target?.focus();
        }
      }}
    >
      <div
        className={`machine-shell machine-shell--${phase}`}
        aria-live="polite"
        aria-atomic="true"
        onClick={(event) => {
          if (phase === "settle" || event.target.closest("button")) return;
          advancePhase();
        }}
      >
        <div className="machine-shell__brand">
          <span>ATDU</span>
          <small>{phase === "settle" ? "Bound" : "Click stage to advance"}</small>
          {phase !== "settle" ? (
            <button
              type="button"
              className="event-reveal-all"
              onClick={(event) => {
                event.stopPropagation();
                revealAll();
              }}
            >
              <span className="event-reveal-all__long">Reveal all</span>
              <span className="event-reveal-all__short">All</span>
            </button>
          ) : null}
        </div>

        {phase === "record" ? (
          <div className="event-stage event-stage--record">
            <span className="eyebrow">Ledger</span>
            <h2>Record Day {closingDay?.day}</h2>
            <div className="ledger-tape ledger-tape--event">
              <strong>{String(closingDay?.day || "").padStart(3, "0")}</strong>
              {Object.entries(closingDay?.entries || {}).map(([code, entry]) => (
                <span key={code}>{code} {notation(entry)}</span>
              ))}
            </div>
          </div>
        ) : null}

        {phase === "day" ? (
          <div className="event-stage event-stage--day">
            <span className="eyebrow">Coin</span>
            <h2>Day {dayNumber}</h2>
            <p>
              {results.length
                ? `${results.length} Wager${results.length === 1 ? "" : "s"} passed to Coin`
                : "No Wagers passed to Coin"}
              {predeclaredNulls.length
                ? ` · ${predeclaredNulls.length} Null before Flip`
                : ""}
            </p>
          </div>
        ) : null}

        {current && wager && !["record", "day", "settle"].includes(phase) ? (
          <div className="event-stage event-stage--machine">
            <WagerIdentity wager={wager} meta={`${index + 1} / ${results.length}`} className="loaded-wager" />

            <WagerGeometry wager={wager} compact />

            <div className="mechanism-deck" aria-label="Flip mechanism">
              <section className={`mechanism-step ${firstCoinSpinning ? "is-active" : gateComplete ? "is-complete" : ""}`}>
                <header>
                  <span>Condition</span>
                  <small>{gateComplete ? "Resolved" : "Coin"}</small>
                </header>
                <Reel
                  label="Environmental condition"
                  value={conditionDisplay}
                  options={["OPEN", "CONSTRAINED"]}
                  spinning={firstCoinSpinning}
                  braking={phase === "gate-brake"}
                  tone={open ? "open" : "constrained"}
                  duration={Math.max(520, 3250 * pace)}
                />
              </section>

              <section className={`mechanism-step ${agentActive ? "is-active" : gateComplete ? "is-complete" : "is-waiting"}`}>
                <header>
                  <span>Agent</span>
                  <small>{awaitingCondition ? "Pending" : agentCoinRequired ? "Coin" : "You"}</small>
                </header>
                {awaitingCondition ? (
                  <div className="mechanism-pending">
                    <CoinGlyph />
                    <span>Awaits condition</span>
                  </div>
                ) : agentCoinRequired ? (
                  <Reel
                    label="Memory selected"
                    value={referenceDisplay}
                    options={["LAST SIDE", "LAST CONSTRAINED SIDE"]}
                    spinning={secondCoinSpinning}
                    braking={phase === "reference-brake"}
                    duration={Math.max(450, 2800 * pace)}
                  />
                ) : (
                  <div className="mechanism-pending mechanism-pending--resolved">
                    <span>YOU</span>
                    <small>{open ? "Select after entry" : "Establish first Side"}</small>
                  </div>
                )}
              </section>
            </div>

            <div className={`resolution-bay resolution-bay--${phase}`}>
              {["load", "gate-spin", "gate-brake", "gate-land", "reference-spin", "reference-brake"].includes(phase) ? (
                <div className="resolution-awaiting">
                  <CoinGlyph />
                  <span>Outcome concealed</span>
                </div>
              ) : null}

              {phase === "open" ? (
                <div className="event-result event-result--open">
                  <span>Open condition · You resolve</span>
                  <strong className="agent-handoff">You are the agent</strong>
                  <small>Both defined Sides remain available. Resolve one after entry.</small>
                </div>
              ) : null}

              {phase === "seed" ? (
                <div className="event-result">
                  <span>Constrained condition · You establish the first Side</span>
                  <strong className="agent-handoff">You establish</strong>
                  <small>This Wager has no prior Constrained result. Resolve one defined Side after entry.</small>
                </div>
              ) : null}

              {phase === "reference-land" ? (
                <div className="memory-token">
                  <span>{referenceValue}</span>
                  <SideDefinition wager={wager} side={referenceSide} />
                </div>
              ) : null}

              {phase === "invert" ? (
                <div className="inversion">
                  <SideDefinition wager={wager} side={referenceSide} subdued />
                  <i aria-label="becomes opposite Side">→</i>
                  <SideDefinition wager={wager} side={current.side} />
                </div>
              ) : null}

              {phase === "resolved" ? (
                <div className="event-result event-result--resolved">
                  <span>Constrained condition · Coin resolved</span>
                  <SideDefinition wager={wager} side={current.side} />
                  <small>Opposite the selected prior Side.</small>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {phase === "settle" ? (
          <div className="event-stage event-stage--settle">
            <span className="eyebrow">Coin</span>
            <h2>{hasUpcomingDay ? `Day ${dayNumber}` : `Day ${closingDay?.day} recorded`}</h2>
            <div className="resolution-register">
              {results.map((result) => {
                const resultWager = result.definition || wagers.find((item) => item.code === result.code);
                return (
                  <div key={result.code} className={`register-state ${result.side ? `register-state--${result.side.toLowerCase()}` : ""} register-state--${result.mode === "O" ? "open" : "constrained"}`}>
                    <small>{result.code} · {result.mode === "O" ? "Open" : "Constrained"}</small>
                    {result.side ? (
                      <SideDefinition wager={resultWager} side={result.side} />
                    ) : <span className="register-state__pending">A / B · You resolve after entry</span>}
                  </div>
                );
              })}
              {predeclaredNulls.map((result) => (
                <div key={result.code} className="register-state register-state--null">
                  <small>{result.code} · Null before Flip</small>
                  <strong className="register-state__null">∅</strong>
                  <em>Coin bypassed</em>
                </div>
              ))}
            </div>
            <button className="event-enter" onClick={onFinished}>{hasUpcomingDay ? `Enter Day ${dayNumber}` : "Return"}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DayWager({ wager, state, onSide, onNull, onRestore }) {
  if (state.nulled) {
    return (
      <article className={`day-wager day-wager--null ${state.predeclared ? "day-wager--predeclared" : ""}`}>
        <WagerIdentity wager={wager} meta={state.predeclared ? "Null · before Flip" : "Null · this Day"} className="day-wager__head" />
        <div className="null-object">
          <strong>∅</strong>
          <span>Null</span>
          {state.predeclared ? <small>Coin bypassed</small> : null}
        </div>
        {state.predeclared
          ? <small className="day-wager__fixed-null">Fixed for this Day</small>
          : <button className="text-button" onClick={onRestore}>Restore this Day</button>}
      </article>
    );
  }

  const openLike = state.mode === "O" || state.seed;
  return (
    <article className={`day-wager day-wager--${state.mode === "O" ? "open" : "constrained"}`}>
      <WagerIdentity
        wager={wager}
        meta={state.mode === "O" ? "Open · you resolve" : state.seed ? "Constrained · you establish" : "Constrained · Coin resolved"}
        className="day-wager__head"
      />

      {openLike ? (
        <div className="resolution-controls">
          <button
            className={`side-control side-control--a ${state.side === "A" ? "is-selected" : state.side ? "is-excluded" : ""}`}
            aria-pressed={state.side === "A"}
            disabled={state.side === "A"}
            onClick={() => onSide("A")}
          >
            <SideContent wager={wager} side="A" />
          </button>
          <button
            className={`side-control side-control--b ${state.side === "B" ? "is-selected" : state.side ? "is-excluded" : ""}`}
            aria-pressed={state.side === "B"}
            disabled={state.side === "B"}
            onClick={() => onSide("B")}
          >
            <SideContent wager={wager} side="B" />
          </button>
        </div>
      ) : (
        <div className={`locked-resolution locked-resolution--${state.side.toLowerCase()}`}>
          <SideContent wager={wager} side={state.side} />
        </div>
      )}

      <button className="text-button day-wager__null" onClick={onNull}>
        Null for this Day
      </button>
    </article>
  );
}

function NextDayPreflight({ wagers, nextNull, dayNumber, onChange }) {
  const nullCount = wagers.filter((wager) => nextNull[wager.code]).length;
  return (
    <section className="next-day-preflight" aria-labelledby="next-day-title">
      <header className="next-day-preflight__head">
        <div>
          <span className="eyebrow">Next Day</span>
          <h2 id="next-day-title">Day {dayNumber} availability</h2>
        </div>
        <small>{wagers.length - nullCount} active · {nullCount} Null</small>
      </header>
      <p className="next-day-preflight__intro">
        Declare known structural unavailability before Flip. Null Wagers bypass the Coin; unexpected unavailability can still be reconciled during the Day.
      </p>
      <div className="next-day-preflight__list">
        {wagers.map((wager) => {
          const isNull = Boolean(nextNull[wager.code]);
          return (
            <article className={`next-day-choice ${isNull ? "is-null" : "is-active"}`} key={wager.code}>
              <WagerIdentity wager={wager} className="next-day-choice__identity" />
              <div className="next-day-choice__control" role="group" aria-label={`${wager.code} availability for Day ${dayNumber}`}>
                <button
                  type="button"
                  className={!isNull ? "is-selected" : ""}
                  aria-pressed={!isNull}
                  disabled={!isNull}
                  onClick={() => onChange(wager.code, false)}
                >
                  Active
                </button>
                <button
                  type="button"
                  className={isNull ? "is-selected" : ""}
                  aria-pressed={isNull}
                  disabled={isNull}
                  onClick={() => onChange(wager.code, true)}
                >
                  Null
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TossToFlip({ disabled, label, onCommit, controlRef }) {
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const progressRef = useRef(0);
  const draggingRef = useRef(false);
  const armedRef = useRef(false);
  const committed = useRef(false);
  const releaseTimer = useRef(null);

  const update = useCallback((next) => {
    const bounded = Math.max(0, Math.min(100, next));
    const armed = bounded >= 82;
    if (armed && !armedRef.current) haptic(10);
    armedRef.current = armed;
    progressRef.current = bounded;
    setProgress(bounded);
  }, []);

  useEffect(() => () => window.clearTimeout(releaseTimer.current), []);

  function commit() {
    if (disabled || committed.current) return;
    committed.current = true;
    update(100);
    setReleasing(true);
    haptic([18, 18, 28]);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    releaseTimer.current = window.setTimeout(onCommit, reduced ? 20 : 180);
  }

  function moveFromPointer(event) {
    const box = event.currentTarget.parentElement.getBoundingClientRect();
    const usable = Math.max(1, box.height - 66);
    update(((box.bottom - event.clientY - 30) / usable) * 100);
  }

  return (
    <div
      className={`coin-toss ${disabled ? "is-disabled" : ""} ${dragging ? "is-dragging" : ""} ${releasing ? "is-releasing" : ""} ${progress >= 82 ? "is-armed" : ""}`}
      ref={controlRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={Math.round(progress)}
      aria-valuetext={progress >= 82 ? "Armed; press Enter to commit" : `${Math.round(progress)} percent toward commit`}
      aria-orientation="vertical"
      onKeyDown={(event) => {
        if (disabled) return;
        if (["ArrowUp", "ArrowRight"].includes(event.key)) {
          event.preventDefault();
          update(progressRef.current + 10);
        } else if (["ArrowDown", "ArrowLeft"].includes(event.key)) {
          event.preventDefault();
          update(progressRef.current - 10);
        } else if (event.key === "Home") {
          event.preventDefault();
          update(0);
        } else if (event.key === "End") {
          event.preventDefault();
          update(100);
        } else if (["Enter", " "].includes(event.key) && progressRef.current >= 82) {
          event.preventDefault();
          commit();
        }
      }}
    >
      <span className="coin-toss__threshold" aria-hidden="true" />
      <span className="coin-toss__trajectory" aria-hidden="true" />
      <span className="coin-toss__label">{disabled ? label : progress >= 82 ? "Release to Flip" : "Flick coin up to Flip"}</span>
      <span
        className="coin-toss__token"
        style={{ transform: `translate3d(0, ${-progress * 0.5}px, 0) rotateY(${progress * 5.4}deg)` }}
        onPointerDown={(event) => {
          if (disabled) return;
          draggingRef.current = true;
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
          haptic(8);
        }}
        onPointerMove={(event) => {
          if (draggingRef.current) moveFromPointer(event);
        }}
        onPointerUp={(event) => {
          if (!draggingRef.current) return;
          draggingRef.current = false;
          setDragging(false);
          event.currentTarget.releasePointerCapture(event.pointerId);
          if (progressRef.current >= 82) commit();
          else update(0);
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
          setDragging(false);
          update(0);
        }}
        aria-hidden="true"
      >
        <PhysicalCoin />
      </span>
    </div>
  );
}

function CoinSurface({ wagers, ledger, day, nextNull, saveDay, saveLedger, saveNextNull, goWager }) {
  const [event, setEvent] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const flipping = useRef(false);
  const sound = useRef(null);
  const flipButton = useRef(null);
  const active = wagers.filter((wager) => !wager.retired);
  const currentWagers = day
    ? Object.entries(day.wagers)
        .map(([code, state]) =>
          state.definition || wagers.find((wager) => wager.code === code),
        )
        .filter(Boolean)
    : [];
  const pending = day
    ? active.filter((wager) => {
        const bound = day.wagers[wager.code]?.definition;
        return !bound || (bound.revision || 1) !== (wager.revision || 1);
      })
    : active;
  const remaining = unresolvedCount(day);
  const canFlip = day ? reconciled(day) : active.length > 0;

  function setSide(code, side) {
    const current = day.wagers[code];
    if (!current || !["A", "B"].includes(side) || (!current.seed && current.mode !== "O") || current.side === side) return;
    haptic(10);
    saveDay({
      ...day,
      wagers: {
        ...day.wagers,
        [code]: { ...current, side, nulled: false },
      },
    });
  }

  function setNull(code, nulled) {
    const current = day.wagers[code];
    if (!current || current.predeclared || current.nulled === nulled) return;
    haptic(8);
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

  function setUpcomingNull(code, nulled) {
    saveNextNull((current) => {
      if (Boolean(current[code]) === nulled) return current;
      haptic(8);
      const next = { ...current };
      if (nulled) next[code] = true;
      else delete next[code];
      return next;
    });
  }

  function flip() {
    if (flipping.current || !canFlip) return;
    flipping.current = true;
    sound.current?.close();
    sound.current = createMechanicalSound(soundEnabled);
    const eventSound = sound.current;
    haptic([28, 24, 28]);
    const nextLedger = day ? commitDay(day, ledger) : ledger;
    const closingDay = day ? nextLedger.at(-1) : null;
    const nullCodes = active.filter((wager) => nextNull[wager.code]).map((wager) => wager.code);
    const live = active.filter((wager) => !nextNull[wager.code]);
    const flipped = prepareDay(active.map((wager) => wager.code), nextLedger, nullCodes);
    active.forEach((wager) => {
      flipped[wager.code] = {
        ...flipped[wager.code],
        definition: snapshotWager(wager),
      };
    });
    const nextNumber = nextDayNumber(nextLedger);
    const nextDay = active.length
      ? { day: nextNumber, date: todayISO(), wagers: flipped }
      : null;

    saveLedger(nextLedger);
    saveDay(nextDay);
    saveNextNull({});
    setEvent({
      dayNumber: nextNumber,
      closingDay,
      results: live.map((wager) => ({ code: wager.code, ...flipped[wager.code] })),
      predeclaredNulls: active
        .filter((wager) => nextNull[wager.code])
        .map((wager) => ({ code: wager.code, definition: flipped[wager.code].definition })),
      sound: eventSound,
    });
  }

  if (!active.length && !currentWagers.length && !event) {
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

  const upcomingDayNumber = nextDayNumber(ledger, day);
  const closingOnly = Boolean(day && !active.length);

  return (
    <section className="surface surface--coin">
      <div className="coin-cabinet">
        <div className="coin-cabinet__marquee">
          <div className="coin-cabinet__coin" aria-label="Coin">
            <PhysicalCoin className="physical-coin--display" />
          </div>
          <button className="sound-toggle" onClick={() => setSoundEnabled((value) => !value)} aria-pressed={soundEnabled}>
            Sound {soundEnabled ? "on" : "off"}
          </button>
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
            <span>Next Day</span>
            <strong>{pending.map((wager) => `${wager.code} r${wager.revision || 1}`).join(" · ")}</strong>
          </div>
        ) : null}

        {canFlip && active.length && !event ? (
          <NextDayPreflight
            wagers={active}
            nextNull={nextNull}
            dayNumber={upcomingDayNumber}
            onChange={setUpcomingNull}
          />
        ) : null}

        <div className="flip-control">
          <p>{closingOnly ? `The Ledger receives Day ${day.day}.` : "The Coin binds the next Day."}</p>
          <TossToFlip
            key={`${upcomingDayNumber}-${canFlip}-${closingOnly}`}
            disabled={!canFlip}
            label={canFlip
              ? closingOnly ? `Flick to record Day ${day.day}` : `Flick to Flip Day ${upcomingDayNumber}`
              : `Resolve ${remaining} Wager${remaining === 1 ? "" : "s"} before the next Flip`}
            onCommit={flip}
            controlRef={flipButton}
          />
        </div>
      </div>

      {event ? (
        <FlipEvent
          dayNumber={event.dayNumber}
          closingDay={event.closingDay}
          wagers={wagers}
          results={event.results}
          predeclaredNulls={event.predeclaredNulls}
          sound={event.sound}
          onFinished={() => {
            event.sound?.close();
            sound.current = null;
            flipping.current = false;
            setEvent(null);
            window.requestAnimationFrame(() => {
              const unresolvedSide = document.querySelector(".side-control");
              (unresolvedSide || flipButton.current)?.focus();
            });
          }}
        />
      ) : null}
    </section>
  );
}

function LedgerSurface({ wagers, ledger }) {
  const [selected, setSelected] = useState(null);
  const displayLedger = useMemo(
    () => [...ledger].sort((left, right) => right.day - left.day),
    [ledger],
  );
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
                    <th aria-sort="descending">Day</th>
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
                  {displayLedger.map((record) => (
                    <tr key={record.day}>
                      <th>{String(record.day).padStart(3, "0")}</th>
                      {wagerColumns.map((wager) => {
                        const entry = record.entries[wager.code];
                        const boundWager = record.definitions?.[wager.code] || wager;
                        const code = entry ? notation(entry) : "";
                        return (
                          <td key={wager.code}>
                            {entry ? (
                              <span
                                className={`ledger-code ledger-code--${code === "∅" ? "null" : code.toLowerCase()}`}
                                title={entry.null ? "Null" : `${sideText(boundWager, entry.side)} · ${entry.mode === "O" ? "Open" : "Constrained"} · revision ${boundWager.revision || 1}`}
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
            <div className="ledger-legend" aria-label="Ledger notation">
              <span><i className="legend-side legend-side--a" />A</span>
              <span><i className="legend-side legend-side--b" />B</span>
              <span><i className="legend-channel legend-channel--open" />Open</span>
              <span><i className="legend-channel legend-channel--constrained" />Constrained</span>
            </div>
          </div>

          {selectedWager && selectedMemory ? (
            <div className="memory-panel">
              <div className="memory-panel__head">
                <span className="eyebrow">Wager</span>
                <h2>{selectedWager.code} · {selectedWager.name}</h2>
                <small>{structureLabel(selectedWager)}</small>
              </div>
              <div className="memory-pair">
                <MemorySlot label="Last Side" side={selectedMemory.L} wager={selectedWager} />
                <MemorySlot label="Last Constrained Side" side={selectedMemory.K} wager={selectedWager} />
              </div>
              <div className="memory-panel__definitions">
                <span className="eyebrow">Defined Sides</span>
                <WagerGeometry wager={selectedWager} compact />
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

const SIMULATION_POLICIES = [0, 0.25, 0.5, 0.75, 1];

function binomialDistribution(n) {
  const values = [];
  let coefficient = 1;
  for (let k = 0; k <= n; k += 1) {
    if (k > 0) coefficient = (coefficient * (n - k + 1)) / k;
    values.push(coefficient * (0.5 ** n));
  }
  return values;
}

function FairDistribution({ title, left, right, leftCount, total, observedInWindow }) {
  const bars = binomialDistribution(20);
  const maximum = Math.max(...bars);
  return (
    <div className="fair-distribution">
      <div className="fair-distribution__head">
        <div>
          <small>{title}</small>
          <strong>{left} / {right}</strong>
        </div>
        <span>{leftCount} / {total}<small>{total ? `${Math.round((leftCount / total) * 100)}% ${left}` : "—"}</small></span>
      </div>
      <div className="binomial-bars" aria-label={`Theoretical binomial distribution for 20 fair ${title} tosses; recent result ${observedInWindow} ${left}`}>
        {bars.map((probability, count) => (
          <i
            key={count}
            className={count === observedInWindow ? "is-observed" : ""}
            style={{ height: `${Math.max(4, (probability / maximum) * 100)}%` }}
            title={`${count} ${left}`}
          />
        ))}
      </div>
      <div className="binomial-axis"><span>0</span><b>10 of 20</b><span>20</span></div>
      <p>p = ½ per toss · 1 bit of entropy · maximum binary uncertainty</p>
    </div>
  );
}

function RuleSurface({ onReset }) {
  const [, setRunId] = useState(1);
  const simulation = SIMULATION_POLICIES.map((p) => {
    const series = simulate(p, 365);
    return {
      p,
      observed: series.at(-1)?.pi || 0,
      theory: piTheory(p),
    };
  });
  const chain = (() => {
    const series = simulate(0.5, 1024);
    const openCount = series.filter((step) => step.mode === "O").length;
    const references = series.filter((step) => step.reference);
    const lastConditions = series.slice(-20);
    const lastReferences = references.slice(-20);
    return {
      openCount,
      conditionTotal: series.length,
      lastCount: references.filter((step) => step.reference === "L").length,
      referenceTotal: references.length,
      recentOpen: lastConditions.filter((step) => step.mode === "O").length,
      recentLast: lastReferences.filter((step) => step.reference === "L").length,
    };
  })();
  const percent = (value) => `${Math.round(value * 100)}%`;

  return (
    <section className="surface surface--rule">
      <div className="surface-heading">
        <div>
          <span className="eyebrow">Rule</span>
          <h1>One mechanism</h1>
        </div>
      </div>

      <div className="rule-stack">
        <article className="rule-card rule-card--lead">
          <span className="eyebrow">Wager</span>
          <h2>One shared field. One discriminant. Two positive resolved Sides.</h2>
          <p>The builder validates required variables, unique identity, distinct Route terms, and exact derived Side form; it does not judge the content. Both defined Sides must remain available. Known unavailability is declared Null before Flip and bypasses the Coin; unexpected unavailability is reconciled as Null during the Day. Neither form updates memory.</p>
          <div className="grammar-grid">
            {WAGER_STRUCTURES.map((structure) => (
              <div key={structure.key}>
                <strong>{structure.form}</strong>
                <span>{structure.label}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rule-card">
          <span className="eyebrow">Mechanism</span>
          <h2>The Coin makes fair uncertainty operative.</h2>
          <p>It externalizes the environmental condition and, under constraint, acts as agent through memory and involution. Both processes remain independent and fair; structure emerges from how Open choice, memory, inversion, and registration are connected.</p>
          <div className="fair-distributions">
            <FairDistribution
              title="Condition Coin"
              left="Open"
              right="Constrained"
              leftCount={chain.openCount}
              total={chain.conditionTotal}
              observedInWindow={chain.recentOpen}
            />
            <FairDistribution
              title="Coin as agent"
              left="Last Side"
              right="Last Constrained Side"
              leftCount={chain.lastCount}
              total={chain.referenceTotal}
              observedInWindow={chain.recentLast}
            />
          </div>
          <div className="chain-map" aria-label="Relation between the two fair Coins and the resolved Side">
            <div className="chain-node">
              <small>Environment</small>
              <b>Condition Coin</b>
              <span>½ Open · ½ Constrained</span>
            </div>
            <i>→</i>
            <div className="chain-branches">
              <span><b>Open</b><small>You act as agent and select an available Side.</small></span>
              <span><b>Constrained</b><small>The Coin acts as agent: ½ Last, ½ Last Constrained, then opposite.</small></span>
            </div>
            <i>→</i>
            <div className="chain-node">
              <small>Registration</small>
              <b>Resolved Side</b>
              <span>The Ledger retains the trace. Last always updates; Last Constrained updates only after C.</span>
            </div>
          </div>
        </article>

        <article className="rule-card">
          <div className="rule-card__heading">
            <div>
              <span className="eyebrow">Simulation</span>
              <h2>Chain convergence across five Open policies</h2>
            </div>
            <button className="button button--quiet" onClick={() => setRunId((value) => value + 1)}>Run again</button>
          </div>
          <p className="rule-note">Each row runs 365 linked resolutions. The observed Side proportion converges toward the chain’s expectation while both upstream Coins remain 50/50.</p>
          <div className="simulation" role="table" aria-label="One-year ATDU simulation">
            <div className="simulation__head" role="row">
              <span role="columnheader">Open resolves A</span>
              <span role="columnheader">Observed A</span>
              <span role="columnheader">Expected A</span>
            </div>
            {simulation.map((row) => (
              <div className="simulation__row" role="row" key={row.p}>
                <strong role="cell">{percent(row.p)}</strong>
                <div className="simulation__track" role="cell" aria-label={`Observed ${percent(row.observed)}; expected ${percent(row.theory)}`}>
                  <i className="simulation__bounds" style={{ left: percent(PI_MIN), width: percent(PI_MAX - PI_MIN) }} />
                  <i className="simulation__expected" style={{ left: percent(row.theory) }} />
                  <i className="simulation__observed" style={{ left: percent(row.observed) }} />
                </div>
                <span role="cell"><b>{percent(row.observed)}</b><small>{percent(row.theory)}</small></span>
              </div>
            ))}
          </div>
          <p className="simulation__legend"><i /> observed <i /> expected</p>
        </article>

        <div className="rule-danger">
          <button className="text-button" onClick={onReset}>Reset all data</button>
        </div>
      </div>
    </section>
  );
}

const NAVIGATION = [
  { id: "wager", label: "Wager", symbol: "◇" },
  { id: "coin", label: "Coin", symbol: <CoinGlyph /> },
  { id: "ledger", label: "Ledger", symbol: "≡" },
  { id: "rule", label: "Rule", symbol: "§" },
];

export default function App() {
  const [view, setView] = useState(null);
  const [wagers, setWagers] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [day, setDay] = useState(null);
  const [nextNull, setNextNull] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await navigator.storage?.persist?.();
      } catch {
        // Optional persistence request.
      }
      const storedWagers = hydrateWagers(parseStored(await storageGet(STORAGE_KEYS.wagers), []));
      const storedLedger = hydrateLedger(parseStored(await storageGet(STORAGE_KEYS.ledger), []));
      const activeCodes = new Set(storedWagers.filter((wager) => !wager.retired).map((wager) => wager.code));
      const storedNextNull = Object.fromEntries(
        Object.entries(hydrateNextNull(parseStored(await storageGet(STORAGE_KEYS.nextNull), {})))
          .filter(([code]) => activeCodes.has(code)),
      );
      const storedDay = snapshotDay(
        hydrateDay(parseStored(await storageGet(STORAGE_KEYS.day), null)),
        storedWagers,
      );
      if (!active) return;
      setWagers(storedWagers);
      setLedger(storedLedger);
      setDay(storedDay);
      setNextNull(storedNextNull);
      storageSet(STORAGE_KEYS.wagers, JSON.stringify(storedWagers));
      storageSet(STORAGE_KEYS.ledger, JSON.stringify(storedLedger));
      if (storedDay) storageSet(STORAGE_KEYS.day, JSON.stringify(storedDay));
      else storageDelete(STORAGE_KEYS.day);
      setView(storedWagers.some((wager) => !wager.retired) ? "coin" : "wager");
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const saveNextNull = useCallback((nextOrUpdater) => {
    setNextNull(nextOrUpdater);
  }, []);

  useEffect(() => {
    if (loaded) storageSet(STORAGE_KEYS.nextNull, JSON.stringify(nextNull));
  }, [loaded, nextNull]);

  const saveWagers = useCallback((next) => {
    const canonical = hydrateWagers(next);
    if (canonical.length !== next.length) throw new TypeError("Refusing to store an invalid Wager");
    setWagers(canonical);
    storageSet(STORAGE_KEYS.wagers, JSON.stringify(canonical));
    const activeCodes = new Set(canonical.filter((wager) => !wager.retired).map((wager) => wager.code));
    saveNextNull((current) => Object.fromEntries(
      Object.entries(current).filter(([code]) => activeCodes.has(code)),
    ));
  }, [saveNextNull]);

  const saveLedger = useCallback((next) => {
    const canonical = hydrateLedger(next);
    if (canonical.length !== next.length) throw new TypeError("Refusing to store an invalid Ledger Day");
    setLedger(canonical);
    storageSet(STORAGE_KEYS.ledger, JSON.stringify(canonical));
  }, []);

  const saveDay = useCallback((next) => {
    const canonical = next ? hydrateDay(next) : null;
    if (next && !canonical) throw new TypeError("Refusing to store an invalid active Day");
    setDay(canonical);
    if (canonical) storageSet(STORAGE_KEYS.day, JSON.stringify(canonical));
    else storageDelete(STORAGE_KEYS.day);
  }, []);

  function reset() {
    if (!window.confirm("Erase all Wagers, the current day, and the Ledger?")) return;
    saveWagers([]);
    saveLedger([]);
    saveDay(null);
    saveNextNull({});
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
      </header>

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

      <main className="app-main">
        {view === "wager" ? (
          <WagerSurface wagers={wagers} saveWagers={saveWagers} day={day} />
        ) : null}
        {view === "coin" ? (
          <CoinSurface
            wagers={wagers}
            ledger={ledger}
            day={day}
            nextNull={nextNull}
            saveDay={saveDay}
            saveLedger={saveLedger}
            saveNextNull={saveNextNull}
            goWager={() => setView("wager")}
          />
        ) : null}
        {view === "ledger" ? <LedgerSurface wagers={wagers} ledger={ledger} /> : null}
        {view === "rule" ? <RuleSurface onReset={reset} /> : null}
      </main>

    </div>
  );
}
