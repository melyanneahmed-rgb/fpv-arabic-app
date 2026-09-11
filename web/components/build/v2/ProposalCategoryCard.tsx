'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import type { BasePart } from '@core/data/assembly/types';
import type {
  CategoryDecision, RecommendationStatus,
} from '@core/data/assembly/recommendation/types';
import { PROPOSAL } from './copy';
import { arabicNumber } from './arabicCount';
import { compatRuleLabelAr } from './compatLabels';
import { partFacts, partNoteTag, partWhyTag } from './partFacts';

/** A product name is Latin text inside an Arabic sentence. Isolate it. */
const Ltr: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <bdi dir="ltr" style={{ unicodeBidi: 'isolate' }}>{children}</bdi>
);

/**
 * A real button, an `aria-expanded`, and a caret that is not the only signal.
 *
 * Every disclosure on this screen goes through here so none of them can end up
 * a clickable `<div>` — which is what the audit found on V1's spec rows.
 */
const Disclose: React.FC<{
  label: string;
  testId: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /**
   * A longer name for the accessibility tree, when the visible label is not
   * unique on the page.
   *
   * «تغيير القطعة» on eight cards is eight identically-named buttons to a
   * reader moving by control, and nothing tells them which category each one
   * belongs to. It must CONTAIN the visible label — otherwise voice control
   * loses the ability to reach the button by what is written on it.
   */
  ariaLabel?: string;
}> = ({ label, testId, children, defaultOpen = false, ariaLabel }) => {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <button
        type="button"
        data-testid={testId}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={ariaLabel}
        onClick={() => setOpen(o => !o)}
        style={{
          justifySelf: 'start', minHeight: 44, padding: '10px 2px',
          background: 'none', border: 'none', font: 'inherit', color: 'var(--accent-ink)',
          fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <span aria-hidden>{open ? '▾' : '▸'}</span>
        <span>{label}</span>
      </button>
      <div id={panelId} hidden={!open}>{children}</div>
    </div>
  );
};

/**
 * The badge says what kind of answer this is — in words, never in colour.
 *
 * A `Record` over the union, not a chain ending in `null`: the chain would
 * have given a new status no badge at all, and a card whose heading says
 * «الإطار» with nothing beside it reads as an ordinary recommendation. Silence
 * is a claim here. `choice-required` is the one deliberate empty — its whole
 * card is the badge.
 */
const STATUS_BADGE: Record<RecommendationStatus, string | null> = {
  recommended: PROPOSAL.recommendedBadge,
  'only-compatible': PROPOSAL.onlyCompatibleBadge,
  'user-locked': PROPOSAL.ownedBadge,
  'user-selected': PROPOSAL.selectedBadge,
  unavailable: PROPOSAL.unavailableBadge,
  'choice-required': null,
};

const StatusBadge: React.FC<{ decision: CategoryDecision }> = ({ decision }) => {
  const text = STATUS_BADGE[decision.status];
  if (!text) return null;
  return (
    <span className="admin-badge" data-testid={`v2-badge-${decision.category}`}
      style={{ fontSize: 10.5 }}>
      {text}
    </span>
  );
};

/**
 * WHY THIS PART — IN THE ENGINE'S WORDS.
 *
 * `decision.reasons` already carries a reader-facing Arabic sentence per
 * reason, tagged with what kind of claim it is. Nothing is composed here from
 * rule ids or enum names: turning `frame-motor-class` into prose by string
 * formatting is how a UI starts asserting compatibility it did not compute.
 *
 * A reason resting on the reader's own answer is labelled as such, because
 * «because you chose متوازن» is a different kind of statement from «because
 * the frame fits».
 */
const Reasons: React.FC<{ decision: CategoryDecision }> = ({ decision }) => {
  if (decision.reasons.length === 0) return null;
  return (
    <div style={{ display: 'grid', gap: 5 }}>
      <strong style={{ fontSize: 12.5 }}>
        {decision.status === 'choice-required' ? PROPOSAL.whyTieTitle : PROPOSAL.whyTitle}
      </strong>
      <ul data-testid={`v2-why-${decision.category}`}
        style={{ margin: 0, paddingInlineStart: 18, display: 'grid', gap: 4 }}>
        {decision.reasons.map((r, i) => (
          <li key={`${r.kind}-${i}`} style={{ fontSize: 12.5, lineHeight: 1.85 }}>
            {r.ar}
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * COMPATIBILITY: ONE LINE, THEN THE DETAIL IF YOU WANT IT.
 *
 * A beginner does not need four green ticks; they need to know the checks ran.
 * And only the rules the engine ACTUALLY evaluated for this decision appear —
 * a rule that never ran must never render as a pass, which is the failure mode
 * a «compatibility report» screen invites.
 */
const Compat: React.FC<{ decision: CategoryDecision }> = ({ decision }) => {
  const ev = decision.compatibility;
  if (ev.length === 0) {
    return (
      <p data-testid={`v2-compat-${decision.category}`}
        style={{ margin: 0, fontSize: 12, color: 'var(--text-dimmer)', lineHeight: 1.85 }}>
        {PROPOSAL.compat.none}
      </p>
    );
  }
  const headline = ev.some(e => e.status === 'violated') ? PROPOSAL.compat.someViolated
    : ev.some(e => e.status === 'unknown') ? PROPOSAL.compat.someUnknown
      : PROPOSAL.compat.allPass;
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <p data-testid={`v2-compat-${decision.category}`}
        style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.85 }}>
        {headline}
      </p>
      <Disclose label={PROPOSAL.compat.disclose} testId={`v2-compat-more-${decision.category}`}>
        {/*
          THE RULE'S NAME, NOT ITS KEY.

          This rendered `frame-size` — an English kebab-cased database
          identifier, inside a disclosure where it was easy to miss, in a
          product written for someone who has never built a drone. The label
          is an exhaustive map over `CompatRuleId`, so a new rule cannot reach
          this list without someone writing the sentence a reader will see.
        */}
        <ul style={{ margin: 0, paddingInlineStart: 18, display: 'grid', gap: 3 }}>
          {ev.map(e => (
            <li key={e.ruleId} data-rule={e.ruleId}
              style={{ fontSize: 12, lineHeight: 1.8 }}>
              {compatRuleLabelAr(e.ruleId)}
              {' — '}
              {PROPOSAL.compat.status[e.status]}
            </li>
          ))}
        </ul>
      </Disclose>
    </div>
  );
};

/** The part itself: name, the shop name, two or three facts, one why-line. */
const PartBody: React.FC<{ category: string; part: BasePart }> = ({ category, part }) => {
  const facts = partFacts(category, part);
  const why = partWhyTag(part);
  const note = partNoteTag(part);
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 15, fontWeight: 800 }} data-testid={`v2-part-name-${category}`}>
        {part.nameAr}
      </span>
      <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>
        <Ltr>{part.brand ? `${part.brand} · ${part.nameEn}` : part.nameEn}</Ltr>
      </span>
      {facts.length > 0 && (
        <dl data-testid={`v2-facts-${category}`}
          style={{ margin: 0, display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
          {facts.map(f => (
            <div key={f.labelAr} style={{ display: 'flex', gap: 5, fontSize: 12 }}>
              <dt style={{ color: 'var(--text-dimmer)' }}>{f.labelAr}</dt>
              <dd style={{ margin: 0, fontWeight: 700 }}><Ltr>{f.value}</Ltr></dd>
            </div>
          ))}
        </dl>
      )}
      {why && (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.85 }}>
          {why}
        </p>
      )}
      {note && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dimmer)', lineHeight: 1.8 }}>
          {note}
        </p>
      )}
    </div>
  );
};

/**
 * ONE CATEGORY.
 *
 * A settled category is a compact row that opens; an open one is a card that
 * shows its options straight away, because that is the decision the reader is
 * actually here to make.
 */
export const ProposalCategoryCard: React.FC<{
  decision: CategoryDecision;
  parts: Readonly<Record<string, BasePart>>;
  /**
   * Only THIS category's parts.
   *
   * The card used to receive the whole catalogue keyed by id, so a candidate
   * id belonging to another category resolved and rendered — a frame's name
   * under «المستقبل». Handing it one shelf makes that impossible to express.
   */
  categoryParts: Readonly<Record<string, BasePart>>;
  /**
   * The category's Arabic heading, ALREADY RESOLVED AND ALREADY PROVEN.
   *
   * The card used to call `partLabelAr(decision.category)`, whose contract is
   * `PART_VOCAB[c]?.ar ?? c` — so an unknown category printed its own raw key,
   * `probe-category`, as the heading of a card in a product written in Arabic.
   * The screen now looks the label up strictly and only reaches this component
   * for a category the integrity pass has already accepted, which is why this
   * is a plain `string` with no fallback: there is nothing left to fall back
   * from, and no way to express one from in here.
   */
  categoryLabelAr: string;
  /** Settled categories collapse; the ones needing the reader do not. */
  compact: boolean;
  /**
   * Whether this category's candidate list opens straight away.
   *
   * Decided by the SCREEN, not here, because it depends on how much else is
   * open — a short list is worth showing when it is the only decision left and
   * is noise when it is one of eight.
   */
  expandCandidates: boolean;
  /** The reader chose a candidate. The name rides along for the announcement. */
  onChoose: (category: string, partId: string, partAr: string) => void;
  /** The reader wants this category open again. */
  onClearChoice: (category: string, partAr: string) => void;
  /**
   * This is the card whose state the reader just changed, so the keyboard
   * belongs on it — the control they pressed no longer exists.
   */
  takeFocus: boolean;
}> = ({
  decision, parts, categoryParts, categoryLabelAr, compact, expandCandidates,
  onChoose, onClearChoice, takeFocus,
}) => {
  const part = decision.partId ? parts[decision.category] : undefined;

  /**
   * WHOSE PART IS THIS — asked of the ENGINE, never of a React flag.
   *
   * `selectionSource` and not `status`, deliberately. A selection that turned
   * out to make the build impossible comes back `unavailable` while still
   * being the reader's own choice, and keying the undo control on the status
   * would strand them on a screen with no way out of a decision they made.
   * Keyed on who chose, the control appears wherever their choice is in play
   * and — by the same token — can never appear on a `recommended`,
   * `only-compatible` or `user-locked` card, because on those this is
   * `system` or `user-owned`.
   */
  const readerChose = decision.selectionSource === 'user-selected';

  /*
   * Focus lands on the card, and only when the ENGINE'S ANSWER for it moved.
   *
   * The key is what the engine last said. Without it a card that is owed focus
   * would steal it back on every unrelated re-render — expanding a disclosure
   * elsewhere on the screen would yank the keyboard across the page.
   */
  const cardRef = useRef<HTMLLIElement>(null);
  const focusedOn = useRef<string | null>(null);
  useEffect(() => {
    const key = takeFocus ? `${decision.status}:${decision.partId ?? ''}` : null;
    if (key !== null && key !== focusedOn.current) cardRef.current?.focus();
    focusedOn.current = key;
  });

  const details = (
    <div style={{ display: 'grid', gap: 10, paddingTop: 4 }}>
      {part && <PartBody category={decision.category} part={part} />}
      {decision.status === 'only-compatible' && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dimmer)', lineHeight: 1.8 }}>
          {PROPOSAL.onlyCompatibleNote}
        </p>
      )}
      <Reasons decision={decision} />
      <Compat decision={decision} />
    </div>
  );

  return (
    <li ref={cardRef} tabIndex={-1} className="card-sm"
      data-testid={`v2-cat-${decision.category}`}
      data-status={decision.status} data-source={decision.selectionSource}
      style={{ padding: '13px 15px', display: 'grid', gap: 8, listStyle: 'none' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0, fontSize: 13, color: 'var(--text-dimmer)', fontWeight: 700 }}>
          {categoryLabelAr}
        </h4>
        <StatusBadge decision={decision} />
      </div>

      {compact ? (
        <>
          {part && (
            <span style={{ fontSize: 14.5, fontWeight: 800 }}
              data-testid={`v2-part-name-${decision.category}`}>
              {part.nameAr}
            </span>
          )}
          <Disclose label={PROPOSAL.whyTitle} testId={`v2-more-${decision.category}`}>
            {details}
          </Disclose>
        </>
      ) : details}

      {/*
        UNDO — and it is the reader's own choice it undoes, nothing else.

        It does not «deselect» in the UI: it removes this one category from
        what the engine is told and asks again. The category may reopen with a
        fresh candidate list, or the locks the reader still has may now leave
        exactly one compatible part — and the screen reports whichever answer
        comes back rather than the one it expected.
      */}
      {readerChose && part && (
        <button
          type="button"
          data-testid={`v2-change-choice-${decision.category}`}
          aria-label={`${PROPOSAL.candidates.change}: ${part.nameAr}`}
          onClick={() => onClearChoice(decision.category, part.nameAr)}
          className="btn-ghost"
          style={{
            justifySelf: 'start', minHeight: 44, padding: '10px 16px',
            fontSize: 13, fontWeight: 800, cursor: 'pointer',
          }}
        >
          {PROPOSAL.candidates.change}
        </button>
      )}

      {/*
        A SETTLED CATEGORY THE READER MAY STILL OVERRULE.

        Only `recommended`. The other settled statuses are not preferences the
        engine expressed, so there is nothing to overrule:

          only-compatible  exactly one viable option survived. A «change»
                           button with nothing behind it is a dead control,
                           and padding the list with parts the search already
                           rejected would offer a choice that cannot be taken.
                           The absence of alternatives IS the answer.
          user-locked      the reader said they OWN this. Quietly treating
                           owned hardware as a suggestion is the exact
                           conflation the domain keeps two fields apart to
                           prevent; changing it belongs to the owned-equipment
                           question, not to a card on the proposal.
          user-selected    already carries «تغيير الاختيار» from Phase 2E.
          unavailable      there is nothing to swap TO.
          choice-required  nothing was recommended, so the list is the whole
                           card — that is `Candidates`, above.
      */}
      {decision.status === 'recommended' && (
        <Alternatives
          decision={decision}
          categoryParts={categoryParts}
          categoryLabelAr={categoryLabelAr}
          onChoose={onChoose}
        />
      )}

      {/*
        THE OPEN DECISION. Every surviving candidate, in the catalogue's own
        order, with NONE marked. `candidateIds[0]` is not a winner and the
        `provenPath` member is not a pick — that path proves a complete build
        exists, and it broke each tie arbitrarily to do so. Presenting either
        as «the system's choice» would manufacture a recommendation the engine
        deliberately refused to make.

        Since Phase 2E each row carries a button, and the rule above survives
        the change: the reader arrives at a list where nothing is chosen, and
        the only way any of it becomes chosen is a press.
      */}
      {decision.status === 'choice-required' && (
        <Candidates
          decision={decision}
          categoryParts={categoryParts}
          defaultOpen={expandCandidates}
          onChoose={onChoose}
        />
      )}
    </li>
  );
};

/**
 * The surviving options, in the catalogue's order, with none preferred.
 *
 * Split out so the list can collapse without the disclosure state leaking into
 * the card, and so the «none is selected» rule lives in one readable place.
 *
 * WHY EVERY ROW HERE IS UNSELECTED, BY CONSTRUCTION
 * ------------------------------------------------
 * This component renders only under `choice-required`, and a category the
 * reader has closed is not `choice-required` — the engine returns it as
 * `user-selected` with its one part and no list to show. So there is no state
 * in which a row in this list could be the chosen one, and `data-selected` is
 * a constant rather than a flag that could disagree with the engine. The
 * instruction line below says which list this is and what pressing a row's
 * button costs, so «nothing is selected yet» is stated rather than implied by
 * an absence of highlighting.
 */
/**
 * ONE ROW, ONE BUTTON, ONE CONTRACT — wherever a part can be chosen.
 *
 * Phase 2E gave `choice-required` its list; Phase 2F gives a `recommended`
 * category its alternatives. The two answer different questions but they take
 * the SAME action — an id goes into `selectedParts` and the engine runs again
 * — so they render through the same component. A second row renderer would be
 * a second place for the accessible name, the 44px floor and the «never show
 * the id» rule to drift out of agreement.
 *
 * EXPORTED FOR ONE REASON: it holds no hooks, so a test can call it as a plain
 * function, walk the elements it returns and INVOKE the button's own handler.
 * That is the only way to prove «the id pressed is the id sent» without a
 * browser — a static render shows the markup but never fires anything, and a
 * source pattern is not a behaviour. `scripts/testReaderSelection.ts` does
 * exactly that, so a mutation that sends `ids[0]` regardless of the row fails
 * there rather than surviving to the end-to-end walk.
 */
export const PartOptionList: React.FC<{
  category: string;
  /** Exactly the ids to offer. The CALLER decides which; this draws them. */
  ids: readonly string[];
  categoryParts: Readonly<Record<string, BasePart>>;
  testId: string;
  /** One line under the list saying what pressing a row costs. */
  note: string;
  onChoose: (category: string, partId: string, partAr: string) => void;
}> = ({ category, ids, categoryParts, testId, note, onChoose }) => (
  <div style={{ display: 'grid', gap: 7 }}>
    <ul data-testid={testId}
      style={{ margin: 0, padding: 0, display: 'grid', gap: 6, listStyle: 'none' }}>
      {/*
        NO `?? id` FALLBACK. An id this CATEGORY cannot resolve — missing
        entirely, or real but belonging to another category — is an integrity
        defect that refuses the whole proposal upstream, so every id here is
        known to resolve on this shelf. The non-null assertion is that
        guarantee written down: if it ever breaks, the reader gets a refusal,
        not a database key wearing a product's clothes, and not a frame
        wearing a receiver's.
      */}
      {ids.map(id => {
        const c = categoryParts[id]!;
        return (
          <li key={id} data-testid={`v2-candidate-${id}`} data-selected="false"
            style={{
              padding: '9px 11px', border: '1px solid var(--border-soft)',
              borderRadius: 8, display: 'flex', gap: 10,
              alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap',
            }}>
            <span style={{ display: 'grid', gap: 3, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{c.nameAr}</span>
              <span style={{ fontSize: 11.5, color: 'var(--text-dimmer)' }}>
                <Ltr>{c.brand ? `${c.brand} · ${c.nameEn}` : c.nameEn}</Ltr>
              </span>
            </span>
            {/*
              A REAL BUTTON, AND ITS NAME CARRIES THE PART.

              «اختيار» alone is what a sighted reader needs — the product is
              the line it sits on. A screen-reader user moving by control
              hears only the accessible name, so eight rows would be eight
              buttons called «اختيار» and the list would be unusable. The
              visible word opens the accessible name rather than being
              replaced by it, so voice control still reaches it by what is
              written on it.

              The id is never spoken or shown: it is what gets SENT.
            */}
            <button
              type="button"
              data-testid={`v2-choose-${category}-${id}`}
              aria-label={`${PROPOSAL.candidates.choose} ${c.nameAr}`}
              onClick={() => onChoose(category, id, c.nameAr)}
              className="btn-ghost"
              style={{
                minHeight: 44, padding: '10px 18px', fontSize: 13,
                fontWeight: 800, cursor: 'pointer', flexShrink: 0,
              }}
            >
              {PROPOSAL.candidates.choose}
            </button>
          </li>
        );
      })}
    </ul>
    <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-dimmer)', lineHeight: 1.8 }}>
      {note}
    </p>
  </div>
);

const Candidates: React.FC<{
  decision: CategoryDecision;
  categoryParts: Readonly<Record<string, BasePart>>;
  defaultOpen: boolean;
  onChoose: (category: string, partId: string, partAr: string) => void;
}> = ({ decision, categoryParts, defaultOpen, onChoose }) => {
  const list = (
    <PartOptionList
      category={decision.category}
      ids={decision.candidateIds}
      categoryParts={categoryParts}
      testId={`v2-candidates-${decision.category}`}
      note={PROPOSAL.candidates.instruction}
      onChoose={onChoose}
    />
  );

  const label = `${PROPOSAL.candidates.show} (${arabicNumber(decision.candidateIds.length)})`;
  return (
    <div style={{ display: 'grid', gap: 7 }}>
      <strong style={{ fontSize: 12.5 }}>{PROPOSAL.candidates.title}</strong>
      {defaultOpen ? list : (
        <Disclose label={label} testId={`v2-show-candidates-${decision.category}`}>
          {list}
        </Disclose>
      )}
    </div>
  );
};

/**
 * THE OTHER PARTS THAT WOULD ALSO WORK — behind a closed door.
 *
 * A settled category is settled: the engine ranked what survived and one came
 * out ahead, and that is what the card says. This adds the second half of the
 * beginner's sentence — «دعني أغيّر قطعة إذا أردت» — without turning the
 * proposal back into the catalogue wall V2 exists to replace.
 *
 * CLOSED BY DEFAULT, AND THAT IS NOT A PREFERENCE
 * -----------------------------------------------
 * A system-shaped build can settle six categories. Six open alternative lists
 * is V1's step 10 rebuilt out of new parts, and the measurement that named
 * that failure — 31 rows, 5.12 phone viewports — is in `ProposalScreen`. So
 * the reader opens one category at a time, by asking.
 *
 * WHERE THE LIST COMES FROM
 * -------------------------
 * `decision.candidateIds`, minus the part already recommended. Nothing else.
 * Not `PART_CATEGORY_MAP[category]`, which is the whole shelf including
 * everything the engine filtered out — offering those would be presenting
 * parts the search has already proven cannot finish this build.
 */
const Alternatives: React.FC<{
  decision: CategoryDecision;
  categoryParts: Readonly<Record<string, BasePart>>;
  categoryLabelAr: string;
  onChoose: (category: string, partId: string, partAr: string) => void;
}> = ({ decision, categoryParts, categoryLabelAr, onChoose }) => {
  /*
   * THE CURRENT RECOMMENDATION IS NOT ONE OF ITS OWN ALTERNATIVES.
   *
   * Leaving it in the list would offer the reader a «choice» that changes the
   * part not at all — and would change its provenance from «اقترحناه لك» to
   * «اخترتها», which is a different claim about who decided.
   */
  const ids = decision.candidateIds.filter(id => id !== decision.partId);
  if (ids.length === 0) return null;

  const label = `${PROPOSAL.alternatives.show} (${arabicNumber(ids.length)})`;
  return (
    <Disclose
      label={label}
      ariaLabel={`${label} — ${categoryLabelAr}`}
      testId={`v2-show-alternatives-${decision.category}`}
    >
      <div style={{ display: 'grid', gap: 7 }}>
        <strong style={{ fontSize: 12.5 }}>{PROPOSAL.alternatives.title}</strong>
        <PartOptionList
          category={decision.category}
          ids={ids}
          categoryParts={categoryParts}
          testId={`v2-alternatives-${decision.category}`}
          note={PROPOSAL.alternatives.note}
          onChoose={onChoose}
        />
      </div>
    </Disclose>
  );
};
