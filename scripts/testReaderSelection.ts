/**
 * «I CHOSE THIS» IS NOT «I OWN THIS» — PHASE 2D
 * =============================================
 *
 * Before this phase the domain could say three things about a category: the
 * system chose it, the reader already owns it, or nobody has chosen yet. The
 * fourth — «the reader picked this for this build, and does not claim to have
 * it» — had nowhere to live, so Phase 2C rendered its candidate lists
 * read-only and reported the gap rather than routing a wizard click through
 * `owned.parts`.
 *
 * That workaround would have told someone they own hardware they have not
 * bought, and made the engine defend a part they never had. This suite is the
 * proof that the honest version behaves.
 *
 * WHAT IS ACTUALLY BEING TESTED
 * -----------------------------
 * Not «the field exists». Every assertion here injects a world and reads an
 * OUTCOME: a budget preference that must lose to a choice, an ecosystem that
 * must beat one, two selections that are fine apart and impossible together,
 * a wrong-shelf id that must not resolve, and — the one that protects
 * everybody who never touches this feature — that an input with no selections
 * returns exactly what it returned before the field existed, compared against
 * a snapshot taken from canonical BEFORE the engine was changed.
 *
 * Run: npx tsx scripts/testReaderSelection.ts
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { proposeBuild } from '../src/data/assembly/recommendation/proposeBuild';
import type {
  ProposedBuild, CategoryDecision, RecommendationInput,
} from '../src/data/assembly/recommendation/types';
import { PART_CATEGORY_MAP } from '../src/data/project/store';
import { REQUIRED_BUILD_CATEGORIES } from '../src/data/assembly/recommendation/eligibility';
import type { BasePart } from '../src/data/assembly/types';
import {
  proposalView, type ProposalContext,
} from '../web/components/build/v2/proposalModel';
import { PROPOSAL } from '../web/components/build/v2/copy';
import { PART_VOCAB } from '../web/lib/build/labels';
import { ProposalScreen } from '../web/components/build/v2/ProposalScreen';
import {
  ProposalCategoryCard, PartOptionList,
} from '../web/components/build/v2/ProposalCategoryCard';
import { readinessOf } from '../web/components/build/v2/readiness';
import {
  ECOSYSTEM_SELECTION_CATEGORY, NO_SELECTIONS, selectionsSurviving,
  withCategory, withoutCategory, type ReaderSelections, type SelectionContext,
} from '../web/components/build/v2/selectionState';

/** The real world, indexed the way the screen indexes it. */
const BY_CATEGORY: Record<string, Record<string, BasePart>> = {};
const ALL_IDS = new Set<string>();
for (const [category, list] of Object.entries(PART_CATEGORY_MAP)) {
  BY_CATEGORY[category] = {};
  for (const p of list) { BY_CATEGORY[category][p.id] = p; ALL_IDS.add(p.id); }
}
const VIEW_CTX: ProposalContext = {
  resolvePart: (category, id) => BY_CATEGORY[category]?.[id],
  existsInAnyCategory: id => ALL_IDS.has(id),
  hasCategory: category => category in PART_CATEGORY_MAP,
  categoryLabel: category => PART_VOCAB[category]?.ar,
  hasManualLabel: id => id in PROPOSAL.manual.labels,
};

let passed = 0;
const failures: string[] = [];
function ok(label: string, condition: boolean) {
  if (condition) { passed++; console.log(`  ok — ${label}`); }
  else { failures.push(label); console.log(`  FAIL — ${label}`); }
}
const section = (t: string) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 66 - t.length))}`);

const build = (i: Record<string, unknown>) => proposeBuild(i as unknown as RecommendationInput);
const dec = (b: ProposedBuild, c: string): CategoryDecision =>
  b.decisions.find(d => d.category === c)!;

/** The reader's answers everything below varies from. */
const BASE = { droneTypeId: 'freestyle', cellCount: 6, budgetTier: 'mid', owned: {} };

const baseline = build(BASE);

// ═══════════════════════════════════════════════════════════════════════════
section('0 — THE FIXTURES ARE REAL, MEASURED FROM THE CATALOGUE');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * Every case below rests on a property of the live catalogue — a genuine tie,
 * a genuine budget preference, a genuinely incompatible pair. If the catalogue
 * moves and one of those stops being true, the test that depends on it would
 * quietly stop testing anything. So each is asserted first, by name.
 */
const TIE = 'propellers';
const tieDecision = dec(baseline, TIE);
ok(`«${TIE}» really is an open tie in the baseline (${tieDecision.candidateIds.length} candidates)`,
  tieDecision.status === 'choice-required' && tieDecision.candidateIds.length >= 2
  && tieDecision.partId === undefined);

const TIE_A = tieDecision.candidateIds[1];
const TIE_B = tieDecision.candidateIds[2];
ok('…and two DIFFERENT members of it are available to pick, neither first',
  TIE_A !== undefined && TIE_B !== undefined && TIE_A !== TIE_B
  && TIE_A !== tieDecision.candidateIds[0] && TIE_B !== tieDecision.candidateIds[0]);

/* A category the BUDGET settled, so «choice outranks preference» has a subject. */
const RANKED = 'frames';
const rankedDecision = dec(baseline, RANKED);
/*
 * NOT the first candidate — deliberately, and this cost a probe to learn.
 *
 * The first version took `candidateIds.find(id => id !== partId)`, which is
 * the catalogue's first frame. A probe that removed the selection from the
 * search's locks then let the search walk that category freely, and the first
 * thing it walks to is… the catalogue's first frame. Every assertion still
 * passed, on a build where the reader's choice had been dropped and replaced
 * by a coincidence. Picking from the far end makes «the search honoured you»
 * distinguishable from «the search found the same thing anyway».
 */
const NOT_PREFERRED = [...rankedDecision.candidateIds].reverse()
  .find(id => id !== rankedDecision.partId)!;
ok(`«${RANKED}» really was settled by the budget ranking`,
  rankedDecision.status === 'recommended' && rankedDecision.selectionSource === 'system'
  && rankedDecision.reasons.some(r => r.kind === 'ranking' && r.inputKey === 'budgetTier'));
ok('…and a viable candidate exists that the ranking did NOT prefer',
  NOT_PREFERRED !== undefined && NOT_PREFERRED !== rankedDecision.partId);
ok('…which is also not what an UNLOCKED search would reach first',
  NOT_PREFERRED !== rankedDecision.candidateIds[0]
  && NOT_PREFERRED !== baseline.provenPath?.[RANKED]);

/*
 * A REAL jointly-impossible pair — a 5.0" frame and a 5.1" propeller, both
 * individually viable in this exact build. Not a synthetic: the clearance rule
 * is a physical claim and the catalogue really contains both parts.
 */
const J_FRAME = 'frame-impulserc-apexdc-evo5-premium';
const J_PROP = 'propeller-gemfan-hurricane-51466-v2-mck-premium';
ok('the jointly-impossible pair are both viable candidates on their own',
  dec(baseline, 'frames').candidateIds.includes(J_FRAME)
  && dec(baseline, 'propellers').candidateIds.includes(J_PROP));

const REAL_FRAME_ID = PART_CATEGORY_MAP.frames[0].id;
ok('the wrong-category fixture is a REAL id that simply lives elsewhere',
  PART_CATEGORY_MAP.frames.some(p => p.id === REAL_FRAME_ID)
  && !PART_CATEGORY_MAP.motors.some(p => p.id === REAL_FRAME_ID));

// ═══════════════════════════════════════════════════════════════════════════
section('1 — THE INPUT IS A CHOICE, AND IT IS NOT FILED UNDER OWNERSHIP');
// ═══════════════════════════════════════════════════════════════════════════
const TYPES_SRC = readFileSync('src/data/assembly/recommendation/types.ts', 'utf8');
const ENGINE_SRC = readFileSync('src/data/assembly/recommendation/proposeBuild.ts', 'utf8');

ok('`selectedParts` is a TOP-LEVEL input, not a member of `owned`',
  /^ {2}selectedParts\?: Readonly<Record<string, string>>;$/m.test(TYPES_SRC));
ok('…and it carries ids, never part objects a caller could invent',
  !/selectedParts\?: Readonly<Record<string, BasePart>>/.test(TYPES_SRC));
ok('the engine never reads a selection out of `owned`',
  !/owned\?\.selected|owned\.selected/.test(ENGINE_SRC));

/*
 * THE SENTENCE THAT MUST NEVER APPEAR ON A SELECTION. «قطعة تملكها بالفعل» is
 * the owned reason, and attaching it to a choice is the whole bug this phase
 * exists to prevent — said in the reader's own language, on their own screen.
 */
const OWNED_SENTENCE = 'قطعة تملكها بالفعل';
const selectedTie = build({ ...BASE, selectedParts: { [TIE]: TIE_A } });
ok('a selected part is never described as one the reader owns',
  dec(selectedTie, TIE).reasons.every(r => !r.ar.includes(OWNED_SENTENCE)));
ok('…and no decision anywhere in that build claims ownership',
  selectedTie.decisions.every(d => d.reasons.every(r => !r.ar.includes(OWNED_SENTENCE))));
ok('…while a genuinely owned part still says exactly that',
  build({
    ...BASE, owned: { parts: { frames: PART_CATEGORY_MAP.frames[0] } },
  }).decisions.some(d => d.reasons.some(r => r.ar.includes(OWNED_SENTENCE))));

// ═══════════════════════════════════════════════════════════════════════════
section('2 — PROVENANCE: FOUR SOURCES, AND NONE OF THEM OVERLOADED');
// ═══════════════════════════════════════════════════════════════════════════
const sourceBlock = TYPES_SRC.match(/export type SelectionSource =([\s\S]*?);/)![1];
const sources = [...sourceBlock.matchAll(/'([a-z-]+)'/g)].map(m => m[1]).sort();
ok(`the provenance union is exactly the four documented ones (${sources.join(', ')})`,
  sources.join() === ['none', 'system', 'user-owned', 'user-selected'].join());

const d2 = dec(selectedTie, TIE);
ok('a reader-selected category reports `user-selected`', d2.selectionSource === 'user-selected');
ok('…and NOT `user-owned` — no ownership was claimed', d2.selectionSource !== 'user-owned');
ok('…and NOT `system` — nothing was weighed against anything',
  (d2.selectionSource as string) !== 'system');
ok('…with an honest status of its own, not one of the four that would be lies',
  d2.status === 'user-selected');
ok('…and the id the reader named', d2.partId === TIE_A);

/*
 * THE REASON VOCABULARY. A reader's click is not a spec, not a curation tag
 * and not a refusal to judge — so it is not `documented`, which is what an
 * earlier draft would have reached for because the enum already existed.
 */
const selReason = d2.reasons.find(r => r.kind === 'selection');
ok('the reason is a `selection`, a kind that did not exist before',
  selReason !== undefined);
ok('…resting on `user-input`, never on `documented`',
  selReason?.evidence === 'user-input');
ok('…and pointing at the input that caused it',
  selReason?.inputKey === 'selectedParts');
ok('…and it says, in Arabic, that the reader chose it',
  selReason?.ar === 'اخترت هذه القطعة لهذا البناء.');
ok('…and no reason on a chosen category points at `ownedParts`',
  d2.reasons.every(r => r.inputKey !== 'ownedParts'));
ok('no selection reason is labelled `documented` anywhere in the engine',
  !/kind: 'selection', evidence: 'documented'/.test(ENGINE_SRC));

// ═══════════════════════════════════════════════════════════════════════════
section('A — A CHOSEN CANDIDATE IS HONOURED, AND CALLED WHAT IT IS');
// ═══════════════════════════════════════════════════════════════════════════
ok('A: the chosen part is the decision\'s part', dec(selectedTie, TIE).partId === TIE_A);
ok('A: the category leaves `unresolved`',
  baseline.unresolved.includes(TIE) && !selectedTie.unresolved.includes(TIE));
ok('A: the proven path keeps the reader\'s id — nothing was substituted',
  selectedTie.provenPath?.[TIE] === TIE_A);
ok('A: `parts` carries the chosen part', selectedTie.parts[TIE]?.id === TIE_A);
ok('A: the candidate list is now the choice, not the field',
  dec(selectedTie, TIE).candidateIds.join() === TIE_A);
ok('A: every other category is untouched by the choice',
  REQUIRED_BUILD_CATEGORIES.filter(c => c !== TIE).every(c =>
    dec(selectedTie, c).status === dec(baseline, c).status
    && dec(selectedTie, c).partId === dec(baseline, c).partId));

// ═══════════════════════════════════════════════════════════════════════════
section('B — THE OTHER MEMBER OF THE SAME TIE IS EQUALLY HONOURED');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * The failure this guards against is a silent `candidateIds[0]`: an engine
 * that «honours» a selection by re-running the search and taking whatever it
 * finds first would pass with one member of a tie and fail with the other.
 */
const selectedOther = build({ ...BASE, selectedParts: { [TIE]: TIE_B } });
ok('B: the second member is honoured too', dec(selectedOther, TIE).partId === TIE_B);
ok('B: …with the same provenance and status',
  dec(selectedOther, TIE).selectionSource === 'user-selected'
  && dec(selectedOther, TIE).status === 'user-selected');
ok('B: …and the proven path follows the reader, not the catalogue order',
  selectedOther.provenPath?.[TIE] === TIE_B
  && selectedTie.provenPath?.[TIE] === TIE_A);
ok('B: neither pick is the one the search would have reached first',
  baseline.provenPath?.[TIE] !== TIE_A && baseline.provenPath?.[TIE] !== TIE_B);

// ═══════════════════════════════════════════════════════════════════════════
section('C — CHOICE OUTRANKS PREFERENCE');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * `budgetTier` ranked this category and picked a different part. Budget is a
 * leaning; a selection is a decision. An engine that re-ranked after locking
 * would quietly overwrite the reader — and would look completely correct,
 * because the part it chose is the one it can justify.
 */
const overBudget = build({ ...BASE, selectedParts: { [RANKED]: NOT_PREFERRED } });
ok('C: the reader\'s part survives the budget ranking',
  dec(overBudget, RANKED).partId === NOT_PREFERRED);
ok('C: …and the budget\'s own pick was NOT reinstated',
  dec(overBudget, RANKED).partId !== rankedDecision.partId);
ok('C: it is no longer called a recommendation',
  dec(overBudget, RANKED).status === 'user-selected'
  && (dec(overBudget, RANKED).status as string) !== 'recommended');
ok('C: …and carries no ranking reason, because nothing was ranked',
  !dec(overBudget, RANKED).reasons.some(r => r.kind === 'ranking'));
ok('C: the build is still proven with the reader\'s part in it',
  overBudget.provenPath?.[RANKED] === NOT_PREFERRED);
ok('C: …which is a different part from the one the baseline proved',
  baseline.provenPath?.[RANKED] !== NOT_PREFERRED);
ok('C: `parts` shows the reader\'s frame, not the budget\'s',
  overBudget.parts[RANKED]?.id === NOT_PREFERRED);
ok('C: the budget still ranks every category the reader did NOT choose',
  dec(overBudget, 'motors').status === 'recommended'
  && dec(overBudget, 'motors').reasons.some(r => r.inputKey === 'budgetTier'));

// ═══════════════════════════════════════════════════════════════════════════
section('D — CLEARING A SELECTION RESTORES THE BASELINE EXACTLY');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * A sticky lock is invisible until someone changes their mind. Removing the
 * key must return the ORIGINAL result — not «a similar one».
 */
const cleared = build({ ...BASE, selectedParts: {} });
const clearedUndef = build({ ...BASE, selectedParts: undefined });
ok('D: an empty selection map returns the baseline, field for field',
  JSON.stringify(cleared) === JSON.stringify(baseline));
ok('D: …and so does an absent one', JSON.stringify(clearedUndef) === JSON.stringify(baseline));
ok('D: the tie is genuinely open again',
  dec(cleared, TIE).status === 'choice-required' && dec(cleared, TIE).partId === undefined);
ok('D: …and the budget-ranked category is back to `recommended`',
  JSON.stringify(build({ ...BASE, selectedParts: {} }).decisions)
  === JSON.stringify(baseline.decisions));

// ═══════════════════════════════════════════════════════════════════════════
section('E — RESOLVING EVERY OPEN TIE COMPLETES THE BUILD');
// ═══════════════════════════════════════════════════════════════════════════
const openCats = baseline.decisions.filter(d => d.partId === undefined).map(d => d.category);
ok(`E: the baseline really does leave ties open (${openCats.join(', ')})`, openCats.length > 0);
ok('E: …and is NOT complete', baseline.complete === false);

const allChosen = build({
  ...BASE,
  selectedParts: Object.fromEntries(openCats.map(c => [c, dec(baseline, c).candidateIds[1]])),
});
ok('E: choosing one part per open tie completes the build', allChosen.complete === true);
ok('E: …with nothing unresolved', allChosen.unresolved.length === 0);
ok('E: …and a proven path that keeps every chosen id',
  openCats.every(c => allChosen.provenPath?.[c] === dec(baseline, c).candidateIds[1]));
/*
 * `complete` is not «checked». The manual check is a relationship between a
 * motor, a prop, a voltage and an ESC, and no amount of choosing settles it.
 */
ok('E: …and manual checks are untouched by any of it',
  allChosen.manualChecks.join() === baseline.manualChecks.join()
  && allChosen.manualChecks.length > 0);
ok('E: every chosen category reports the reader as its source',
  openCats.every(c => dec(allChosen, c).selectionSource === 'user-selected'
    && dec(allChosen, c).status === 'user-selected'));

// ═══════════════════════════════════════════════════════════════════════════
section('F — AN OWNED RADIO STILL BEATS A CHOSEN RECEIVER');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * Ecosystem ownership FILTERS. Choosing a Crossfire receiver does not make an
 * ExpressLRS radio speak to it, and the danger is specific: a locked category
 * is never walked by the pool search, and `computeFindings` judges parts
 * against parts — it has no idea which radio is on the reader's desk. Without
 * an explicit gate the build comes back sound.
 */
const CROSSFIRE = PART_CATEGORY_MAP.receivers
  .find(r => (r as unknown as { specs: { protocol: string } }).specs.protocol === 'Crossfire')!;
const WALKSNAIL = PART_CATEGORY_MAP.videoUnits.find(v => v.protocolOrSystem === 'Walksnail')!;

const rcClash = build({
  ...BASE, owned: { rcSystem: 'ExpressLRS' }, selectedParts: { receivers: CROSSFIRE.id },
});
ok('F: the receiver decision is `unavailable`', dec(rcClash, 'receivers').status === 'unavailable');
ok('F: …and no path is proven', rcClash.provenPath === null);
ok('F: the selection is NOT silently replaced',
  dec(rcClash, 'receivers').partId === CROSSFIRE.id);
ok('F: …and stays attributed to the reader\'s CHOICE, not their shelf',
  dec(rcClash, 'receivers').selectionSource === 'user-selected');
ok('F: the reason names the two radio systems, in Arabic',
  dec(rcClash, 'receivers').reasons[0].ar.includes('ExpressLRS')
  && dec(rcClash, 'receivers').reasons[0].ar.includes('Crossfire'));
ok('F: …and rests on the reader\'s input rather than on a document',
  dec(rcClash, 'receivers').reasons[0].evidence === 'user-input');
ok('F: the chosen receiver is still named in `parts`, so the reader can see it',
  rcClash.parts.receivers?.id === CROSSFIRE.id);

// ═══════════════════════════════════════════════════════════════════════════
section('G — OWNED GOGGLES STILL BEAT A CHOSEN AIR UNIT');
// ═══════════════════════════════════════════════════════════════════════════
const videoClash = build({
  ...BASE, owned: { videoSystem: 'DJI' }, selectedParts: { videoUnits: WALKSNAIL.id },
});
ok('G: the video decision is `unavailable`', dec(videoClash, 'videoUnits').status === 'unavailable');
ok('G: …and no path is proven', videoClash.provenPath === null);
ok('G: the selection is not replaced by a DJI unit',
  dec(videoClash, 'videoUnits').partId === WALKSNAIL.id
  && dec(videoClash, 'videoUnits').selectionSource === 'user-selected');
ok('G: the reason names both ecosystems',
  dec(videoClash, 'videoUnits').reasons[0].ar.includes('Walksnail')
  && dec(videoClash, 'videoUnits').reasons[0].ar.includes('DJI'));
/* And the control: the same unit with no goggles owned is perfectly fine. */
ok('G: …while the same choice without owned goggles is honoured',
  dec(build({ ...BASE, selectedParts: { videoUnits: WALKSNAIL.id } }), 'videoUnits')
    .status === 'user-selected');

// ═══════════════════════════════════════════════════════════════════════════
section('H — A REAL ID ON THE WRONG SHELF FAILS CLOSED');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * The category is the truth, never the id string. A frame's id filed under
 * motors resolves against a flat catalogue and renders a frame under
 * «المحركات» with no spec rows — Phase 2C removed exactly that from the
 * presentation layer, and the domain must not reintroduce it from below.
 */
const wrongShelf = build({ ...BASE, selectedParts: { motors: REAL_FRAME_ID } });
ok('H: the input is refused', wrongShelf.selectionIssues.length === 1);
ok('H: …and diagnosed as «exists, wrong shelf», not as «missing»',
  wrongShelf.selectionIssues[0]?.kind === 'foreign-category');
ok('H: …naming the category and id the reader actually sent',
  wrongShelf.selectionIssues[0]?.category === 'motors'
  && wrongShelf.selectionIssues[0]?.partId === REAL_FRAME_ID);
ok('H: no path is proven and nothing is complete',
  wrongShelf.provenPath === null && wrongShelf.complete === false);
ok('H: the frame does NOT appear as the motors part',
  dec(wrongShelf, 'motors').partId === undefined
  && wrongShelf.parts.motors === undefined);
ok('H: the refusal is not smuggled into the verdict engine\'s blocker ids',
  wrongShelf.blockerFindingIds.length === 0);
ok('H: the issue carries a reader-facing Arabic sentence with no Latin id in it',
  /[؀-ۿ]/.test(wrongShelf.selectionIssues[0]?.ar ?? '')
  && !(wrongShelf.selectionIssues[0]?.ar ?? '').includes(REAL_FRAME_ID));

// ═══════════════════════════════════════════════════════════════════════════
section('I — AN ID THAT EXISTS NOWHERE FAILS CLOSED, DIFFERENTLY');
// ═══════════════════════════════════════════════════════════════════════════
const MISSING = 'probe-no-such-part';
const missing = build({ ...BASE, selectedParts: { motors: MISSING } });
ok('I: the input is refused', missing.selectionIssues.length === 1);
ok('I: …as «unknown», which is a different bug from «wrong shelf»',
  missing.selectionIssues[0]?.kind === 'unknown-part'
  && missing.selectionIssues[0]?.kind !== wrongShelf.selectionIssues[0]?.kind);
ok('I: the phantom id never becomes a decision\'s part',
  missing.decisions.every(d => d.partId !== MISSING));
ok('I: …and never reaches `parts`',
  Object.values(missing.parts).every(p => p.id !== MISSING));
ok('I: no path is proven', missing.provenPath === null);

/* The two remaining shapes of malformed input. */
const unknownCat = build({ ...BASE, selectedParts: { 'probe-category': REAL_FRAME_ID } });
ok('I: a category the catalogue does not stock is refused',
  unknownCat.selectionIssues[0]?.kind === 'unknown-category');
const notBuild = build({ ...BASE, selectedParts: { gps: PART_CATEGORY_MAP.gps[0].id } });
ok('I: a real shelf that is not a BUILD category is refused separately',
  notBuild.selectionIssues[0]?.kind === 'not-a-build-category');
ok('I: …and «gps» really is a real catalogue category, so that is the only fault',
  'gps' in PART_CATEGORY_MAP
  && !(REQUIRED_BUILD_CATEGORIES as readonly string[]).includes('gps'));
ok('I: a healthy build reports no issues at all', baseline.selectionIssues.length === 0);

// ═══════════════════════════════════════════════════════════════════════════
section('J — INDIVIDUALLY FINE, TOGETHER IMPOSSIBLE');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * Validating each selection alone is the plausible mistake, and it passes both
 * of these: a 5.0" frame is a fine frame, a 5.1" propeller is a fine
 * propeller, and they do not fit each other. The check has to be joint.
 */
const soloFrame = build({ ...BASE, selectedParts: { frames: J_FRAME } });
const soloProp = build({ ...BASE, selectedParts: { propellers: J_PROP } });
ok('J: the frame alone is fine', soloFrame.provenPath?.frames === J_FRAME);
ok('J: the propeller alone is fine', soloProp.provenPath?.propellers === J_PROP);

const together = build({ ...BASE, selectedParts: { frames: J_FRAME, propellers: J_PROP } });
ok('J: together they prove no path', together.provenPath === null);
ok('J: …and the build is not complete', together.complete === false);
ok('J: NEITHER identity is replaced',
  dec(together, 'frames').partId === J_FRAME
  && dec(together, 'propellers').partId === J_PROP);
ok('J: …and both stay attributed to the reader\'s choice',
  dec(together, 'frames').selectionSource === 'user-selected'
  && dec(together, 'propellers').selectionSource === 'user-selected');
ok('J: the reason says they are fine apart and impossible together',
  dec(together, 'frames').reasons[0].ar.includes('كلٌّ على حدة')
  && dec(together, 'frames').reasons[0].ar.includes('معًا'));
ok('J: …which is NOT the sentence used when one part is simply unusable',
  dec(together, 'frames').reasons[0].ar !== dec(rcClash, 'receivers').reasons[0].ar);
ok('J: both chosen parts are still named in `parts`',
  together.parts.frames?.id === J_FRAME && together.parts.propellers?.id === J_PROP);
ok('J: this is a build failure, not a malformed input',
  together.selectionIssues.length === 0);

// ═══════════════════════════════════════════════════════════════════════════
section('K — CHOOSING WHAT YOU ALREADY OWN NORMALISES TO OWNERSHIP');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * Both statements are true, and one of them is stronger: «I have it» is a fact
 * about the world, «I want it» is an intention about a proposal. Reporting the
 * weaker one would lose information the rest of the engine relies on.
 */
const OWNED_FRAME = PART_CATEGORY_MAP.frames.find(f => f.id === rankedDecision.partId)!;
const sameBoth = build({
  ...BASE,
  owned: { parts: { frames: OWNED_FRAME } },
  selectedParts: { frames: OWNED_FRAME.id },
});
const ownedOnly = build({ ...BASE, owned: { parts: { frames: OWNED_FRAME } } });
ok('K: the decision is the OWNED one', dec(sameBoth, 'frames').selectionSource === 'user-owned');
ok('K: …with the owned status, not the selected one',
  dec(sameBoth, 'frames').status === 'user-locked');
ok('K: …and the part is unchanged', dec(sameBoth, 'frames').partId === OWNED_FRAME.id);
ok('K: the result is identical to owning it without choosing it',
  JSON.stringify(sameBoth) === JSON.stringify(ownedOnly));
ok('K: no issue is raised — this is agreement, not a conflict',
  sameBoth.selectionIssues.length === 0);

// ═══════════════════════════════════════════════════════════════════════════
section('L — OWNING ONE AND CHOOSING ANOTHER IS A CONFLICT, NOT A MERGE');
// ═══════════════════════════════════════════════════════════════════════════
const OTHER_FRAME = PART_CATEGORY_MAP.frames.find(f => f.id === NOT_PREFERRED)!;
const clash = build({
  ...BASE,
  owned: { parts: { frames: OWNED_FRAME } },
  selectedParts: { frames: OTHER_FRAME.id },
});
const clashFrames = dec(clash, 'frames');
ok('L: the category is `unavailable` — the engine refuses to pick',
  clashFrames.status === 'unavailable');
ok('L: …with no part decided, because nobody has decided',
  clashFrames.partId === undefined && clashFrames.selectionSource === 'none');
ok('L: BOTH identities survive, machine-readably',
  clashFrames.candidateIds.length === 2
  && clashFrames.candidateIds.includes(OWNED_FRAME.id)
  && clashFrames.candidateIds.includes(OTHER_FRAME.id));
ok('L: the owned part is not silently kept',
  clashFrames.partId !== OWNED_FRAME.id);
ok('L: the chosen part is not silently discarded',
  clashFrames.candidateIds.includes(OTHER_FRAME.id));
ok('L: the reason names both parts, in Arabic, by their reader-facing names',
  clashFrames.reasons[0].ar.includes(OWNED_FRAME.nameAr)
  && clashFrames.reasons[0].ar.includes(OTHER_FRAME.nameAr));
ok('L: …and no Latin id appears in it',
  !clashFrames.reasons[0].ar.includes(OWNED_FRAME.id)
  && !clashFrames.reasons[0].ar.includes(OTHER_FRAME.id));
ok('L: nothing is proven while the contradiction stands', clash.provenPath === null);
ok('L: this is a contradiction between inputs, not a malformed one',
  clash.selectionIssues.length === 0);

// ═══════════════════════════════════════════════════════════════════════════
section('M — KEY ORDER CARRIES NO MEANING');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * `Object.entries` follows insertion order, so anything built by walking the
 * input would carry the reader's typing order into the engine's answer.
 */
const forward = build({ ...BASE, selectedParts: { frames: NOT_PREFERRED, propellers: TIE_A } });
const reversed = build({ ...BASE, selectedParts: { propellers: TIE_A, frames: NOT_PREFERRED } });
ok('M: reversing the keys changes nothing at all',
  JSON.stringify(forward) === JSON.stringify(reversed));

const issuesForward = build({
  ...BASE, selectedParts: { motors: MISSING, 'probe-category': MISSING },
});
const issuesReversed = build({
  ...BASE, selectedParts: { 'probe-category': MISSING, motors: MISSING },
});
ok('M: …including the ORDER of the issues reported back',
  JSON.stringify(issuesForward.selectionIssues) === JSON.stringify(issuesReversed.selectionIssues));
ok('M: …and both malformed entries are reported, not just the first',
  issuesForward.selectionIssues.length === 2);
ok('M: …in build order, with the unknown category last',
  issuesForward.selectionIssues.map(i => i.category).join() === 'motors,probe-category');

// ═══════════════════════════════════════════════════════════════════════════
section('N — THE SAME INPUT ALWAYS GIVES THE SAME ANSWER');
// ═══════════════════════════════════════════════════════════════════════════
for (const [label, inp] of [
  ['a plain selection', { ...BASE, selectedParts: { [TIE]: TIE_A } }],
  ['a completed build', { ...BASE, selectedParts: Object.fromEntries(openCats.map(c => [c, dec(baseline, c).candidateIds[1]])) }],
  ['a jointly-impossible pair', { ...BASE, selectedParts: { frames: J_FRAME, propellers: J_PROP } }],
  ['a malformed input', { ...BASE, selectedParts: { motors: MISSING } }],
  ['an owned/selected conflict', { ...BASE, owned: { parts: { frames: OWNED_FRAME } }, selectedParts: { frames: OTHER_FRAME.id } }],
] as const) {
  ok(`N: ${label} is deterministic`,
    JSON.stringify(build(inp as Record<string, unknown>))
    === JSON.stringify(build(inp as Record<string, unknown>)));
}

// ═══════════════════════════════════════════════════════════════════════════
section('P — READERS WHO CHOSE NOTHING GET EXACTLY WHAT THEY GOT BEFORE');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * The most important section here, and the one with the least to look at.
 *
 * Phase 2D changes an engine that every existing surface already depends on.
 * The snapshot below was written ONCE, from canonical, by
 * `scripts/snapshotRecommendation.ts`, BEFORE any of this existed — the commit
 * is recorded inside it. Regenerating it from the current engine would turn
 * every assertion in this section into a tautology, which is the one way to
 * hollow this out, so the fixture's own commit is checked against the history
 * of the file that changed.
 */
const SNAP = JSON.parse(
  readFileSync('scripts/fixtures/proposeBuild.pre2d.json', 'utf8'),
) as { commit: string; cases: Record<string, ProposedBuild> };

ok(`the snapshot names the commit it was taken from (${SNAP.commit.slice(0, 7)})`,
  /^[0-9a-f]{40}$/.test(SNAP.commit));
const caseNames = Object.keys(SNAP.cases);
ok(`it covers a real spread of readers (${caseNames.length} cases)`, caseNames.length >= 20);
for (const must of ['freestyle-6S-mid', 'freestyle-4S-mid', 'cinematic-6S-mid', 'longrange-mid',
  'freestyle-6S-nopref', 'freestyle-6S-budget', 'freestyle-6S-premium',
  'freestyle-6S-mid-elrs', 'freestyle-6S-mid-dji', 'freestyle-6S-mid-ownedFrame']) {
  ok(`…including «${must}»`, caseNames.includes(must));
}

/*
 * The snapshot predates `selectionIssues`, so the comparison drops it — and
 * asserts separately that it is always the empty array. That is the whole of
 * the compatibility claim: every field that existed is byte-identical, and the
 * one new field is inert.
 */
const INPUTS = JSON.parse(readFileSync('scripts/fixtures/proposeBuild.pre2d.inputs.json', 'utf8')) as
  Record<string, Record<string, unknown>>;
let drift = 0;
for (const name of caseNames) {
  const now = build(INPUTS[name]) as ProposedBuild & { selectionIssues: unknown[] };
  const { selectionIssues, ...rest } = now;
  const same = JSON.stringify(rest) === JSON.stringify(SNAP.cases[name]);
  if (!same) drift++;
  ok(`${name}: identical to canonical, field for field`, same);
  ok(`${name}: …and reports no selection issue`, selectionIssues.length === 0);
}
ok('no case drifted', drift === 0);

/*
 * NON-VACUITY. If the inputs file and the snapshot fell out of step — a case
 * renamed, an input quietly changed — every comparison above could pass while
 * comparing nothing. So at least one case must be a build with real content.
 */
ok('the comparison is against real builds, not empty ones',
  SNAP.cases['freestyle-6S-mid'].decisions.length === 8
  && SNAP.cases['freestyle-6S-mid'].provenPath !== null);
ok('…and the inputs file covers every snapshot case',
  caseNames.every(n => INPUTS[n] !== undefined));

// ═══════════════════════════════════════════════════════════════════════════
section('Q — THE NEW STATUS CANNOT MASQUERADE AS SOMETHING ELSE');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * `groupOf` was a chain ending in `: 'system-decided'` — «anything I have not
 * named was decided by the system». Adding a status would have filed a
 * reader's own choice under «حسمها النظام»: the system taking credit for the
 * one decision it explicitly refused to make.
 */
const MODEL_SRC = readFileSync('web/components/build/v2/proposalModel.ts', 'utf8');
ok('the status→group map is a Record over the union, not a chain',
  /Record<RecommendationStatus, DecisionGroup>/.test(MODEL_SRC));
ok('…with no catch-all default left in it',
  !/:\s*'system-decided';\s*$/m.test(MODEL_SRC));
ok('`user-selected` has a group of its own, not «yours» and not «system-decided»',
  /'user-selected':\s*'chosen'/.test(MODEL_SRC));
ok('the badge table is a Record too, so a new status cannot render unlabelled',
  /Record<RecommendationStatus, string \| null>/
    .test(readFileSync('web/components/build/v2/ProposalCategoryCard.tsx', 'utf8')));
ok('the counts keep a separate tally for reader choices',
  /userSelected: by\('user-selected'\)\.length/.test(MODEL_SRC));
ok('…and `systemDecided` still counts only what the SYSTEM decided',
  /systemDecided: by\('recommended'\)\.length \+ by\('only-compatible'\)\.length/.test(MODEL_SRC));

// ═══════════════════════════════════════════════════════════════════════════
section('R — AN EARLY DEAD END MAY REFUSE A CHOICE, NEVER ERASE IT');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * `deadEnd()` read `input.owned?.parts` and nothing else — complete until
 * Phase 2D gave the reader a second way to put a part in.
 *
 * Cinewhoop is the live fixture: the catalogue tags no frame for it, so
 * `getAvailableSizeOptions` returns nothing and the engine exits before the
 * category loop ever runs. A structurally valid selection — a real frame id,
 * on the frames shelf, raising no `selectionIssue` — was then simply gone:
 *
 *     status=unavailable  source=none  partId=—  candidateIds=[]
 *     parts.frames = (absent)
 *
 * while an OWNED frame in the same build came back intact. A selection may
 * become unusable. It may never be silently replaced OR erased.
 */
const DEAD_TYPE = 'cinewhoop';
const DEAD = { droneTypeId: DEAD_TYPE, cellCount: 4, budgetTier: 'mid', owned: {} };
const DEAD_FRAME = PART_CATEGORY_MAP.frames[0];
const DEAD_OTHER = PART_CATEGORY_MAP.frames[1];

ok(`«${DEAD_TYPE}» really is an early dead end — no frame is tagged for it`,
  PART_CATEGORY_MAP.frames.every(f => !f.compatibilityTags.droneTypes.includes(DEAD_TYPE)));
ok('…and it dies before any category is decided, so this is the `deadEnd()` path',
  build(DEAD).decisions.every(d => d.status === 'unavailable' && d.candidateIds.length === 0));

// R-A — a valid selection survives the refusal.
const deadSelected = build({ ...DEAD, selectedParts: { frames: DEAD_FRAME.id } });
const rA = dec(deadSelected, 'frames');
ok('R-A: the chosen frame keeps its identity', rA.partId === DEAD_FRAME.id);
ok('R-A: …reported as a CHOICE, not as nobody\'s', rA.selectionSource === 'user-selected');
ok('R-A: …with the status the build actually has', rA.status === 'unavailable');
ok('R-A: …and on `candidateIds`, machine-readably',
  rA.candidateIds.join() === DEAD_FRAME.id);
ok('R-A: the part is still identifiable in `parts`',
  deadSelected.parts.frames?.id === DEAD_FRAME.id);
ok('R-A: nothing is proven and nothing is complete',
  deadSelected.provenPath === null && deadSelected.complete === false);
ok('R-A: no other category invents a reader part',
  deadSelected.decisions.filter(d => d.category !== 'frames')
    .every(d => d.partId === undefined && d.selectionSource === 'none'));

// R-B — the owned behaviour that was already right stays right.
const deadOwned = build({ ...DEAD, owned: { parts: { frames: DEAD_FRAME } } });
ok('R-B: an OWNED part in the same dead end stays `user-owned`',
  dec(deadOwned, 'frames').selectionSource === 'user-owned'
  && dec(deadOwned, 'frames').partId === DEAD_FRAME.id
  && deadOwned.parts.frames?.id === DEAD_FRAME.id);

// R-C — the same part both ways: ownership is the stronger claim.
const deadBoth = build({
  ...DEAD, owned: { parts: { frames: DEAD_FRAME } }, selectedParts: { frames: DEAD_FRAME.id },
});
ok('R-C: owning AND choosing the same part still resolves to ownership',
  dec(deadBoth, 'frames').selectionSource === 'user-owned');
ok('R-C: …and is identical to owning it without choosing it',
  JSON.stringify(deadBoth) === JSON.stringify(deadOwned));

// R-D — two different parts: the contradiction survives the early exit too.
const deadClash = build({
  ...DEAD, owned: { parts: { frames: DEAD_FRAME } }, selectedParts: { frames: DEAD_OTHER.id },
});
const rD = dec(deadClash, 'frames');
ok('R-D: a collision is still an explicit conflict, not a winner',
  rD.partId === undefined && rD.selectionSource === 'none');
ok('R-D: …with BOTH identities preserved',
  rD.candidateIds.length === 2
  && rD.candidateIds.includes(DEAD_FRAME.id) && rD.candidateIds.includes(DEAD_OTHER.id));
ok('R-D: …and the reason names both, not one',
  rD.reasons[0].ar.includes(DEAD_FRAME.nameAr) && rD.reasons[0].ar.includes(DEAD_OTHER.nameAr));

// R-E / R-F — the two channels stay distinct at the dead end as well.
ok('R-E: a structurally valid selection raises no issue, even when refused',
  deadSelected.selectionIssues.length === 0 && deadBoth.selectionIssues.length === 0
  && deadClash.selectionIssues.length === 0);
const deadMalformed = build({ ...DEAD, selectedParts: { frames: 'probe-no-such-frame' } });
ok('R-F: a MALFORMED selection still goes to `selectionIssues`…',
  deadMalformed.selectionIssues.length === 1
  && deadMalformed.selectionIssues[0]?.kind === 'unknown-part');
ok('R-F: …and never onto the identity-preservation path',
  dec(deadMalformed, 'frames').partId === undefined
  && dec(deadMalformed, 'frames').selectionSource === 'none'
  && deadMalformed.parts.frames === undefined);

/*
 * And the fix is not a blind merge. A category may hold an owned part or a
 * chosen one, never both, because the collision is normalised BEFORE any dead
 * end can fire — which is why the two cases above can be told apart at all.
 */
ok('the engine normalises owned-vs-selected before the first early exit',
  ENGINE_SRC.indexOf('OWNED AND SELECTED IN THE SAME CATEGORY')
  < ENGINE_SRC.indexOf('لا يوجد إطار في الكتالوج موسوم لهذا النوع'));
ok('…and the dead end resolves owned FIRST, so the stronger claim survives',
  /const mine = owned \?\? chosen;/.test(ENGINE_SRC));

// ═══════════════════════════════════════════════════════════════════════════
section('S — «ALL OPEN» IS A LIE ONCE THE READER HAS CLOSED SOMETHING');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * The quality model had two states because only the SYSTEM could settle a
 * category. Now a third situation is real — no budget preference, one part
 * chosen, seven still open — and BOTH old headlines are false about it:
 * «الخيارات كلها أمامك» denies the reader's choice, and «هذا البناء المقترح
 * لك» claims a proposal nobody made.
 */
const noTier = { droneTypeId: 'freestyle', cellCount: 6, owned: {} };
const viewOf = (inp: Record<string, unknown>) => proposalView(build(inp), VIEW_CTX);

const sA = viewOf(noTier);
ok('S-A: nothing settled by anyone → `all-open`',
  sA.counts.systemDecided === 0 && sA.counts.userSelected === 0
  && sA.counts.choiceRequired > 0 && sA.quality === 'all-open');

const sB = viewOf({ ...noTier, selectedParts: { [TIE]: TIE_A } });
ok('S-B: one reader choice with categories still open → `reader-shaped`',
  sB.counts.systemDecided === 0 && sB.counts.userSelected === 1
  && sB.counts.choiceRequired > 0 && sB.quality === 'reader-shaped');

const everyCategory = Object.fromEntries(
  build(noTier).decisions.map(d => [d.category, d.candidateIds[0]]));
const sC = viewOf({ ...noTier, selectedParts: everyCategory });
ok('S-C: every category chosen by the reader, none open → still `reader-shaped`',
  sC.counts.systemDecided === 0 && sC.counts.userSelected > 0
  && sC.counts.choiceRequired === 0 && sC.quality === 'reader-shaped');
ok('S-C: …and that build really is complete, so this is not a broken case',
  sC.consistencyError === false);

const sD = viewOf({ ...BASE, selectedParts: { [TIE]: TIE_A } });
ok('S-D: a system decision anywhere still wins the headline → `proposed`',
  sD.counts.systemDecided > 0 && sD.counts.userSelected > 0
  && sD.quality === 'proposed');

/*
 * S-E — the count itself. Making the headline work by inflating
 * `systemDecided` would have fixed the sentence by breaking its meaning.
 */
/*
 * Two different categories, because a choice does two different things
 * depending on what the system had already done with it — and «does not
 * raise» has to hold in both.
 */
const sBase = viewOf(BASE);
ok('S-E: choosing an OPEN category leaves `systemDecided` untouched',
  sD.counts.systemDecided === sBase.counts.systemDecided
  && sD.counts.choiceRequired === sBase.counts.choiceRequired - 1
  && sD.counts.userSelected === 1);
const sOverride = viewOf({ ...BASE, selectedParts: { [RANKED]: NOT_PREFERRED } });
ok('S-E: choosing a category the SYSTEM had settled LOWERS it',
  sOverride.counts.systemDecided === sBase.counts.systemDecided - 1
  && sOverride.counts.userSelected === 1);
ok('S-E: …so a reader choice can never inflate the system\'s credit',
  sB.counts.systemDecided === 0 && sC.counts.systemDecided === 0);
ok('S-E: `systemDecided` is still exactly recommended + only-compatible',
  sD.counts.systemDecided === sD.counts.recommended + sD.counts.onlyCompatible);

/* S-F — the copy may claim neither of the things that are not true. */
const READER_COPY = `${PROPOSAL.titleReaderShaped} ${PROPOSAL.leadReaderShaped}`;
ok('S-F: reader-shaped copy does not claim the system proposed the build',
  !READER_COPY.includes('المقترح') && READER_COPY !== PROPOSAL.titleProposed);
ok('S-F: …nor that the system settled anything',
  !READER_COPY.includes('حسمها النظام'));
ok('S-F: …nor that everything is still open',
  !READER_COPY.includes(PROPOSAL.titleAllOpen));
ok('S-F: …and it does say the choices are the READER\'s',
  PROPOSAL.titleReaderShaped.includes('اختيارات')
  && PROPOSAL.leadReaderShaped.includes('اخترته أنت'));
ok('S-F: the three headlines are three different sentences',
  new Set([PROPOSAL.titleProposed, PROPOSAL.titleReaderShaped, PROPOSAL.titleAllOpen]).size === 3);
/*
 * The lead must not promise a decision that may already be made: S-C closes
 * every category, and «وما بقي يحتاج قرارك» would be a request for something
 * finished. What remains is reported by the burden line instead.
 */
ok('S-F: the lead makes no claim about what is left — the burden line owns that',
  !PROPOSAL.leadReaderShaped.includes('بقي'));

// ═══════════════════════════════════════════════════════════════════════════
section('T — THE HEADLINE, ACTUALLY RENDERED');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * S proves the MODEL picks the right quality. This proves the SCREEN prints
 * the matching sentence — by rendering it and reading the `<h2>`, not by
 * grepping for a map. A ternary replaced by a Record is exactly the kind of
 * change a source pattern can be made to approve while the rendered string
 * stays wrong.
 *
 * React comes from `web/`'s own copy: a component on one React instance and a
 * renderer on another share no hook dispatcher and the render throws, so the
 * indirection is the test working rather than the test cheating.
 */
const webRequire = createRequire(join(process.cwd(), 'web/package.json'));
const ReactRT = webRequire('react') as {
  createElement: (t: unknown, p: Record<string, unknown>) => unknown;
};
const renderToStaticMarkup = (webRequire('react-dom/server') as {
  renderToStaticMarkup: (el: unknown) => string;
}).renderToStaticMarkup;

/**
 * Render the screen with REAL handler props.
 *
 * They are required props, so there is no «read-only ProposalScreen» that can
 * exist by forgetting them — and the recorder is what sections V onward read
 * to check that a press sends a category and an id and nothing else.
 */
const rendered: { calls: [string, ...string[]][] } = { calls: [] };
const renderProposal = (b: ProposedBuild) => renderToStaticMarkup(
  ReactRT.createElement(ProposalScreen, {
    build: b,
    onChoose: (c: string, id: string) => rendered.calls.push(['choose', c, id]),
    onClearChoice: (c: string) => rendered.calls.push(['clear', c]),
  }),
);

const headlineOf = (inp: Record<string, unknown>) => {
  const html = renderProposal(build(inp));
  return {
    quality: /data-quality="([^"]*)"/.exec(html)?.[1] ?? '',
    title: (/<h2[^>]*data-testid="v2-proposal-title"[^>]*>([\s\S]*?)<\/h2>/.exec(html)?.[1] ?? '')
      .trim(),
    text: html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
  };
};

const hAllOpen = headlineOf(noTier);
const hReader = headlineOf({ ...noTier, selectedParts: { [TIE]: TIE_A } });
const hProposed = headlineOf(BASE);

ok('T: a build nobody has touched still renders «الخيارات كلها أمامك»',
  hAllOpen.quality === 'all-open' && hAllOpen.title === PROPOSAL.titleAllOpen);
ok('T: a build the SYSTEM shaped still renders «هذا البناء المقترح لك»',
  hProposed.quality === 'proposed' && hProposed.title === PROPOSAL.titleProposed);

/* The one that was wrong before this fix. */
ok('T: a build the READER shaped renders their own headline',
  hReader.quality === 'reader-shaped' && hReader.title === PROPOSAL.titleReaderShaped);
ok('T: …and NOT «الخيارات كلها أمامك», which is the claim it used to make',
  hReader.title !== PROPOSAL.titleAllOpen
  && !hReader.text.includes(PROPOSAL.titleAllOpen));
ok('T: …and NOT «هذا البناء المقترح لك» either',
  hReader.title !== PROPOSAL.titleProposed
  && !hReader.text.includes(PROPOSAL.titleProposed));
ok('T: the reader-shaped page carries its own lead, not the open one',
  hReader.text.includes(PROPOSAL.leadReaderShaped)
  && !hReader.text.includes(PROPOSAL.leadAllOpen));
ok('T: the three qualities really do render three different headings',
  new Set([hAllOpen.title, hReader.title, hProposed.title]).size === 3);
/*
 * And the burden line underneath is still the system's own tally: «لم نحسم أي
 * اختيار» stays true on a reader-shaped build, because we did not.
 */
ok('T: the burden line still reports that the SYSTEM settled nothing',
  hReader.text.includes(PROPOSAL.burden.nothingSettled));
/*
 * NO INTERNAL IDENTIFIER — said precisely, because a kebab-case sweep is the
 * wrong instrument on this page. It flags «T-Motor», «R-Line» and «4-in-1»,
 * which are the products' own names and belong on screen. What must never
 * appear is a key: a catalogue part id, a category key, a rule id or a
 * finding id. Those are enumerable, so they are checked by name.
 */
const KEYS = [
  ...ALL_IDS,
  ...Object.keys(PART_CATEGORY_MAP),
  ...Object.keys(PROPOSAL.manual.labels),
];
ok(`T: none of the three renders any internal key (${KEYS.length} checked)`,
  KEYS.length > 50
  && [hAllOpen, hReader, hProposed].every(h => KEYS.every(k => !h.text.includes(k))));
ok('T: …and the check is not vacuous — those keys ARE in the machine state',
  /data-testid="v2-cat-/.test(renderProposal(build(noTier))));

// ═══════════════════════════════════════════════════════════════════════════
section('U — A CONTRADICTION IS LOCAL TO THE CATEGORY THAT HAS IT');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * The collision return answered its own shelf correctly and erased every OTHER
 * thing the reader had chosen. `parts: { ...ownedParts }`, and a non-conflicted
 * category read `ownedParts[category]` alone — so:
 *
 *     owned.frames = X · selectedParts.frames = Y · selectedParts.propellers = P
 *
 * reported the frame conflict properly and then lost P, which is involved in
 * nothing, two categories away:
 *
 *     propellers  source=none  partId=—  candidateIds=[]   parts.propellers = (absent)
 *
 * Three of the four «the reader's part survives a refusal» returns were right
 * and one was wrong, which is what a shared invariant looks like when it is not
 * shared. `readerPartIn()` is now the single answer to «whose part is this»,
 * and all four ask it.
 */
const OWNED_X = PART_CATEGORY_MAP.frames[0];
const SELECTED_Y = PART_CATEGORY_MAP.frames[1];
const SELECTED_P = TIE_A;
const OWNED_BATTERY = PART_CATEGORY_MAP.batteries
  .find(b => b.compatibilityTags.batteryVoltages.includes(6))!;

ok('the fixture is a real collision between two different real frames',
  OWNED_X.id !== SELECTED_Y.id
  && PART_CATEGORY_MAP.frames.some(f => f.id === SELECTED_Y.id));
ok('…and the unrelated selection is a real propeller in another category',
  PART_CATEGORY_MAP.propellers.some(p => p.id === SELECTED_P));

// U-A — the conflict stands, and the bystander survives it.
const localA = build({
  ...BASE,
  owned: { parts: { frames: OWNED_X } },
  selectedParts: { frames: SELECTED_Y.id, propellers: SELECTED_P },
});
const uFrames = dec(localA, 'frames');
const uProps = dec(localA, 'propellers');

ok('U-A: the frame conflict is still explicit — nobody won',
  uFrames.status === 'unavailable' && uFrames.selectionSource === 'none'
  && uFrames.partId === undefined);
ok('U-A: …with both frame identities intact',
  uFrames.candidateIds.length === 2
  && uFrames.candidateIds.includes(OWNED_X.id)
  && uFrames.candidateIds.includes(SELECTED_Y.id));
ok('U-A: the unrelated propeller keeps its provenance',
  uProps.selectionSource === 'user-selected');
ok('U-A: …its identity', uProps.partId === SELECTED_P);
ok('U-A: …and its candidate list', uProps.candidateIds.join() === SELECTED_P);
ok('U-A: …and it is still in `parts`', localA.parts.propellers?.id === SELECTED_P);
ok('U-A: the conflicted shelf does NOT quietly become the selected one',
  localA.parts.frames?.id === OWNED_X.id && localA.parts.frames?.id !== SELECTED_Y.id);
ok('U-A: the whole build is still refused',
  localA.provenPath === null && localA.complete === false
  && localA.decisions.every(d => d.status === 'unavailable'));
ok('U-A: and this is a contradiction between inputs, not a malformed one',
  localA.selectionIssues.length === 0);

// U-B — an unrelated OWNED part is equally a bystander.
const localB = build({
  ...BASE,
  owned: { parts: { frames: OWNED_X, batteries: OWNED_BATTERY } },
  selectedParts: { frames: SELECTED_Y.id, propellers: SELECTED_P },
});
ok('U-B: an unrelated owned battery stays `user-owned`',
  dec(localB, 'batteries').selectionSource === 'user-owned'
  && dec(localB, 'batteries').partId === OWNED_BATTERY.id
  && localB.parts.batteries?.id === OWNED_BATTERY.id);
ok('U-B: …while the unrelated selection stays `user-selected`',
  dec(localB, 'propellers').selectionSource === 'user-selected'
  && dec(localB, 'propellers').partId === SELECTED_P);
ok('U-B: …and the frame conflict is unchanged by either of them',
  JSON.stringify(dec(localB, 'frames')) === JSON.stringify(uFrames));

// U-C — with no bystanders, nothing moved.
const localC = build({
  ...BASE, owned: { parts: { frames: OWNED_X } }, selectedParts: { frames: SELECTED_Y.id },
});
ok('U-C: a bare collision still reports exactly what it used to',
  JSON.stringify(dec(localC, 'frames')) === JSON.stringify(uFrames));
ok('U-C: …with only the owned part in `parts`',
  Object.keys(localC.parts).join() === 'frames'
  && localC.parts.frames?.id === OWNED_X.id);
ok('U-C: …and every other category empty-handed, because the reader gave nothing',
  localC.decisions.filter(d => d.category !== 'frames')
    .every(d => d.selectionSource === 'none' && d.partId === undefined
      && d.candidateIds.length === 0));

// U-D — agreement is still not a collision.
const localD = build({
  ...BASE, owned: { parts: { frames: OWNED_X } }, selectedParts: { frames: OWNED_X.id },
});
ok('U-D: owning and choosing the SAME frame still resolves to ownership',
  dec(localD, 'frames').selectionSource === 'user-owned'
  && dec(localD, 'frames').status === 'user-locked');
ok('U-D: …and does not trip the conflict branch at all',
  localD.provenPath !== null);

// U-E — the bystander is never re-attributed on its way through.
for (const wrong of ['user-owned', 'system', 'none'] as const) {
  ok(`U-E: the unrelated selection is NOT «${wrong}»`,
    uProps.selectionSource !== wrong);
}

/*
 * And the invariant has one home now. Four returns refuse a build while naming
 * what the reader put in; asking the same helper is what stops three of them
 * being right and the fourth quietly wrong again.
 */
const readerPartUses = ENGINE_SRC.match(/readerPartIn\(category\)/g) ?? [];
ok(`every refusal path asks the same question (${readerPartUses.length} call sites)`,
  readerPartUses.length === 4);
ok('…and that question resolves OWNED first, so the stronger claim survives',
  /const mine = owned \?\? chosen;/.test(ENGINE_SRC)
  && !/const mine = chosen \?\? owned;/.test(ENGINE_SRC));


// ═══════════════════════════════════════════════════════════════════════════
section('V — WHAT A READER CHOICE SURVIVES, AS A FUNCTION');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * Phase 2E's invalidation rule, asked directly rather than inferred from a
 * screen. «A budget change keeps the reader's frame» should be a sentence a
 * test can evaluate, and it is only that if the rule is a function over plain
 * data — which is why `selectionState.ts` contains no React.
 */
const CTX: SelectionContext = {
  droneTypeId: 'freestyle', sizeInch: 5, cellCount: 6,
  rcSystem: 'ExpressLRS', videoSystem: 'DJI',
};
const THREE: ReaderSelections = {
  frames: 'f1', receivers: 'r1', videoUnits: 'v1',
};
const keysOf = (s: ReaderSelections) => Object.keys(s).sort().join(',');

ok('V: nothing chosen survives trivially — and as the SAME object',
  selectionsSurviving(CTX, { ...CTX, droneTypeId: 'racing' }, NO_SELECTIONS) === NO_SELECTIONS);

/* A different build. Not a narrower one — a different one. */
for (const [what, next] of [
  ['the drone type', { ...CTX, droneTypeId: 'long-range' }],
  ['the size', { ...CTX, sizeInch: 7 }],
  ['the voltage', { ...CTX, cellCount: 4 }],
] as [string, SelectionContext][]) {
  ok(`V: changing ${what} discards every choice`,
    keysOf(selectionsSurviving(CTX, next, THREE)) === '');
}

/* An ecosystem answer clears ONE shelf. That is the whole of its authority. */
const afterRc = selectionsSurviving(CTX, { ...CTX, rcSystem: 'Crossfire' }, THREE);
ok('V: changing the radio clears the RECEIVER choice',
  afterRc.receivers === undefined);
ok('V: …and leaves the frame and the video unit exactly as they were',
  afterRc.frames === 'f1' && afterRc.videoUnits === 'v1'
  && keysOf(afterRc) === 'frames,videoUnits');

const afterVideo = selectionsSurviving(CTX, { ...CTX, videoSystem: 'Walksnail' }, THREE);
ok('V: changing the goggles clears the VIDEO choice',
  afterVideo.videoUnits === undefined);
ok('V: …and leaves the frame and the receiver alone',
  afterVideo.frames === 'f1' && afterVideo.receivers === 'r1'
  && keysOf(afterVideo) === 'frames,receivers');

const afterBoth = selectionsSurviving(
  CTX, { ...CTX, rcSystem: undefined, videoSystem: undefined }, THREE);
ok('V: dropping BOTH ecosystems clears both shelves and nothing else',
  keysOf(afterBoth) === 'frames');

/*
 * IDENTITY, NOT EQUALITY. An answer that invalidates nothing must hand back
 * the very same object: a fresh copy would give `answers` a new identity every
 * keystroke and re-run the viability search for nothing.
 */
ok('V: an answer that changes nothing returns the SAME map',
  selectionsSurviving(CTX, { ...CTX }, THREE) === THREE);
/*
 * THE «لست متأكدًا» CASE, which is the one a literal reading gets wrong.
 *
 * A reader who had not answered the radio question and now says «I don't
 * know» HAS changed their answer and has changed NOTHING about what can be
 * proposed — the engine sees absence either way. Clearing their receiver here
 * would be erasing a valid selection, which is the eager failure Phase 2D
 * spent a correction round removing.
 */
const noRc: SelectionContext = { ...CTX, rcSystem: undefined };
ok('V: an answer the ENGINE cannot tell apart clears nothing',
  selectionsSurviving(noRc, { ...noRc }, THREE) === THREE);

/*
 * BUDGET CANNOT REACH THIS FUNCTION AT ALL.
 *
 * Expressed as a field that does not exist rather than as an `if` that does
 * nothing, so a later edit cannot make budget invalidating by accident: there
 * is no budget here to compare.
 */
ok('V: the context carries no budget — there is nothing for it to change',
  !('budget' in CTX) && !('budgetTier' in CTX)
  && Object.keys(CTX).sort().join(',') === 'cellCount,droneTypeId,rcSystem,sizeInch,videoSystem');

/* The two accumulators, and both are immutable and local. */
const added = withCategory(THREE, 'motors', 'm1');
ok('V: adding a choice does not mutate the map it came from',
  added.motors === 'm1' && (THREE as Record<string, string>).motors === undefined);
const replaced = withCategory(THREE, 'frames', 'f2');
ok('V: choosing again in one category replaces only that category',
  replaced.frames === 'f2' && replaced.receivers === 'r1'
  && keysOf(replaced) === keysOf(THREE));
const dropped = withoutCategory(THREE, 'frames');
ok('V: clearing one category removes that key and no other',
  dropped.frames === undefined && keysOf(dropped) === 'receivers,videoUnits'
  && keysOf(THREE) === 'frames,receivers,videoUnits');
ok('V: clearing a category that was never chosen is a no-op, identically',
  withoutCategory(THREE, 'escs') === THREE);

// ═══════════════════════════════════════════════════════════════════════════
section('W — THE ECOSYSTEM MAP IS THE ENGINE’S, NOT THE UI’S');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * `ECOSYSTEM_SELECTION_CATEGORY` says the radio answer gates `receivers` and
 * the goggle answer gates `videoUnits`. That is a claim about the DOMAIN made
 * inside the UI, so it is only as good as its proof — and a grep for the
 * category names in `proposeBuild.ts` would prove nothing about behaviour.
 *
 * So the map is DERIVED from what the engine actually returns: a category
 * whose decision rests on an ecosystem answer says so itself, on the reason's
 * `inputKey`. If a third category ever starts depending on one, this goes red
 * rather than the constant going quietly stale.
 */
const ECO_SPREAD: Record<string, unknown>[] = [];
for (const droneTypeId of ['freestyle', 'cinematic', 'long-range', 'racing', 'cinewhoop']) {
  for (const cellCount of [undefined, 4, 6]) {
    for (const rcSystem of [undefined, 'ExpressLRS', 'Crossfire']) {
      for (const videoSystem of [undefined, 'DJI', 'Walksnail']) {
        ECO_SPREAD.push({ droneTypeId, cellCount, budgetTier: 'mid', owned: { rcSystem, videoSystem } });
      }
    }
  }
}
const restsOn = (key: string) => {
  const cats = new Set<string>();
  for (const inp of ECO_SPREAD) {
    for (const d of build(inp).decisions) {
      if (d.reasons.some(r => r.inputKey === key)) cats.add(d.category);
    }
  }
  return cats;
};
const rcCats = restsOn('ownedRcSystem');
const videoCats = restsOn('ownedVideoSystem');
ok(`W: the spread really does exercise both ecosystems (${ECO_SPREAD.length} builds)`,
  rcCats.size > 0 && videoCats.size > 0);
ok('W: the RADIO answer gates exactly one category, and it is the one the UI clears',
  rcCats.size === 1 && rcCats.has(ECOSYSTEM_SELECTION_CATEGORY.rc));
ok('W: the GOGGLE answer gates exactly one category, and it is the one the UI clears',
  videoCats.size === 1 && videoCats.has(ECOSYSTEM_SELECTION_CATEGORY.video));
ok('W: …and they are not the same shelf', rcCats.has('receivers') && videoCats.has('videoUnits'));

// ═══════════════════════════════════════════════════════════════════════════
section('X — A PRESS CAN NEVER TRAP THE READER');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * The screen offers a candidate BECAUSE the engine proved a complete
 * blocker-free build exists with it. So choosing one should always leave a
 * build that still exists — and if that ever stops being true, a reader ends
 * up on a page that says «تعذّر» because of a button this phase added, with
 * the headline still claiming every compatible part is fine.
 *
 * That is worth proving rather than reasoning about, so it is walked twice:
 * exhaustively for the first two presses across every reader, and randomly to
 * full depth — all eight categories closed by hand.
 */
const WALK_SPREAD: Record<string, unknown>[] = [];
for (const droneTypeId of ['freestyle', 'cinematic', 'long-range', 'racing', 'cinewhoop']) {
  for (const budgetTier of [undefined, 'budget', 'mid', 'premium']) {
    for (const cellCount of [undefined, 4, 6]) {
      WALK_SPREAD.push({ droneTypeId, cellCount, budgetTier, owned: {} });
    }
  }
}
let exhaustiveClicks = 0;
let exhaustiveTraps = 0;
const walk = (base: Record<string, unknown>, sel: Record<string, string>, depth: number) => {
  const b = build({ ...base, selectedParts: sel });
  if (b.requiredInputs.length > 0) return;
  if (b.provenPath === null) { if (depth > 0) exhaustiveTraps++; return; }
  if (depth >= 2) return;
  for (const d of b.decisions.filter(x => x.status === 'choice-required')) {
    for (const id of d.candidateIds) {
      exhaustiveClicks++;
      walk(base, { ...sel, [d.category]: id }, depth + 1);
    }
  }
};
for (const base of WALK_SPREAD) walk(base, {}, 0);
ok(`X: the exhaustive walk really pressed things (${exhaustiveClicks} presses)`,
  exhaustiveClicks > 1000);
ok('X: …and not one of them left a build that cannot exist', exhaustiveTraps === 0);

let seed = 20260911;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pickOne = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
let deepClicks = 0;
let deepTraps = 0;
let closedByHand = 0;
let deepest = 0;
for (let i = 0; i < 4000; i++) {
  const base = {
    droneTypeId: pickOne(['freestyle', 'cinematic', 'long-range', 'racing', 'cinewhoop']),
    cellCount: pickOne([undefined, 4, 6]),
    budgetTier: pickOne([undefined, 'budget', 'mid', 'premium']),
    owned: {
      rcSystem: pickOne([undefined, 'ExpressLRS', 'Crossfire']),
      videoSystem: pickOne([undefined, 'DJI', 'Walksnail']),
    },
  };
  const sel: Record<string, string> = {};
  let depth = 0;
  for (;;) {
    const b = build({ ...base, selectedParts: sel });
    if (b.requiredInputs.length > 0) break;
    if (b.provenPath === null) { if (depth > 0) deepTraps++; break; }
    const open = b.decisions.filter(d => d.status === 'choice-required');
    if (open.length === 0) { closedByHand++; break; }
    const d = pickOne(open);
    sel[d.category] = pickOne(d.candidateIds);
    deepClicks++; depth++; deepest = Math.max(deepest, depth);
  }
}
ok(`X: the deep walk reached the bottom (${deepClicks} presses, deepest ${deepest})`,
  deepClicks > 500 && deepest >= 5 && closedByHand > 100);
ok('X: …and a fully hand-built drone is still a drone that exists', deepTraps === 0);

// ═══════════════════════════════════════════════════════════════════════════
section('Y — THE CONTROLS, ACTUALLY RENDERED');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * Rendered and read back, never grepped. «Every candidate has a button whose
 * name carries the part» is a claim about output, and the only honest way to
 * check output is to produce it.
 */
const OPEN_BUILD = build(noTier);
const openHtml = renderProposal(OPEN_BUILD);
const openTie = dec(OPEN_BUILD, TIE);
ok(`Y: the fixture really leaves «${TIE}» open with options`,
  openTie.status === 'choice-required' && openTie.candidateIds.length >= 2);

const chooseIds = [...openHtml.matchAll(/data-testid="v2-choose-([^"]+)"/g)].map(m => m[1]);
ok('Y: every candidate in the open category is offered a control',
  openTie.candidateIds.every(id => chooseIds.includes(`${TIE}-${id}`)));
const buttonFor = (cat: string, id: string) =>
  new RegExp(`<button[^>]*data-testid="v2-choose-${cat}-${id}"[^>]*>`).exec(openHtml)?.[0] ?? '';
ok('Y: each one is a real <button type="button">',
  openTie.candidateIds.every(id => {
    const b = buttonFor(TIE, id);
    return b.startsWith('<button') && b.includes('type="button"');
  }));
ok('Y: each one names the PART in its accessible name',
  openTie.candidateIds.every(id =>
    buttonFor(TIE, id).includes(
      `aria-label="${PROPOSAL.candidates.choose} ${BY_CATEGORY[TIE][id].nameAr}"`)));
ok('Y: …and the visible word is the start of that name, so voice control reaches it',
  openTie.candidateIds.every(id => {
    const label = /aria-label="([^"]*)"/.exec(buttonFor(TIE, id))?.[1] ?? '';
    return label.startsWith(PROPOSAL.candidates.choose);
  }));
ok('Y: each one clears the 44px touch floor',
  openTie.candidateIds.every(id => /min-height:44px/.test(buttonFor(TIE, id))));
/*
 * NO ID ANYWHERE A HUMAN OR A SCREEN READER MEETS IT. `data-testid` is machine
 * state and carries one by design; an `aria-label` is READ ALOUD, so a leak
 * there is the same failure as printing the key on screen — and the visible
 * text sweep in section T cannot see it, because it strips attributes.
 */
const ariaLabels = [...openHtml.matchAll(/aria-label="([^"]*)"/g)].map(m => m[1]);
ok(`Y: no spoken label carries a catalogue id (${ariaLabels.length} labels checked)`,
  ariaLabels.length >= 4
  && ariaLabels.every(l => ![...ALL_IDS].some(id => l.includes(id))));
ok('Y: nothing is pre-chosen in a list the reader has not touched',
  !/data-selected="true"/.test(openHtml)
  && !/data-testid="v2-change-choice-/.test(openHtml)
  && !/data-source="user-selected"/.test(openHtml));
ok('Y: the live region exists, is polite, and says nothing yet',
  /<p role="status" aria-live="polite" class="sr-only" data-testid="v2-selection-announcement"[^>]*>\s*<span><\/span>\s*<\/p>/
    .test(openHtml));

/*
 * Now a screen where BOTH kinds of answer are present.
 *
 * `BASE` names a budget, so the engine settles some categories on its own —
 * which is what makes «the undo control appears on exactly the reader's
 * categories» a statement with two sides. On the tier-less build every
 * category is open and the comparison would have nothing to exclude.
 */
const CHOSEN_BUILD = build({ ...BASE, selectedParts: { [TIE]: TIE_A } });
const chosenHtml = renderProposal(CHOSEN_BUILD);
ok('Y: the chosen category comes back as the reader’s, from the engine',
  dec(CHOSEN_BUILD, TIE).selectionSource === 'user-selected');
ok('Y: …so the card offers the way out',
  chosenHtml.includes(`data-testid="v2-change-choice-${TIE}"`));
ok('Y: …and the undo button names the part it would release',
  new RegExp(`<button[^>]*data-testid="v2-change-choice-${TIE}"[^>]*aria-label="`
    + `${PROPOSAL.candidates.change}: ${BY_CATEGORY[TIE][TIE_A].nameAr}"`).test(chosenHtml));
ok('Y: …and there is no candidate list left to disagree with it',
  !chosenHtml.includes(`data-testid="v2-candidates-${TIE}"`)
  && !chosenHtml.includes(`data-testid="v2-choose-${TIE}-`));

/*
 * NO CONTROL ON A DECISION THAT IS NOT THE READER'S. A «تغيير الاختيار» on a
 * recommendation would invite them to un-choose something they never chose.
 */
const controlledCats = new Set(
  [...chosenHtml.matchAll(/data-testid="v2-change-choice-([^"]+)"/g)].map(m => m[1]));
const readerCats = new Set(CHOSEN_BUILD.decisions
  .filter(d => d.selectionSource === 'user-selected').map(d => d.category));
ok('Y: the undo control appears on exactly the reader’s own categories',
  controlledCats.size === readerCats.size
  && [...readerCats].every(c => controlledCats.has(c)));
const notReaders = CHOSEN_BUILD.decisions
  .filter(d => d.selectionSource === 'system' || d.selectionSource === 'user-owned');
ok(`Y: …and on none of the ${notReaders.length} the system or ownership settled`,
  notReaders.length > 0 && notReaders.every(d => !controlledCats.has(d.category)));

// ═══════════════════════════════════════════════════════════════════════════
section('Z — THE AFFORDANCE FOLLOWS `selectionSource`, AND NOTHING ELSE');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * The strongest version of «no parallel truth»: hand the screen a build whose
 * decisions have been REWRITTEN, and watch the controls follow the rewrite. A
 * component with a selection of its own would keep drawing what it remembered;
 * a component reading `selectionSource` cannot.
 */
const rewrite = (b: ProposedBuild, cat: string, patch: Partial<CategoryDecision>) => ({
  ...b,
  decisions: b.decisions.map(d => (d.category === cat ? { ...d, ...patch } : d)),
}) as ProposedBuild;

/* Take the reader's own decision and call it the system's. The undo must go. */
const asSystem = renderProposal(rewrite(CHOSEN_BUILD, TIE, { selectionSource: 'system' }));
ok('Z: relabelling the reader’s choice as the system’s removes the undo control',
  !asSystem.includes(`data-testid="v2-change-choice-${TIE}"`));
ok('Z: …and the card is still on screen, so this is not «it vanished»',
  asSystem.includes(`data-testid="v2-cat-${TIE}"`));

/* And the other direction, on a category the reader never touched. */
const systemCat = notReaders[0].category;
const asReaders = renderProposal(
  rewrite(CHOSEN_BUILD, systemCat, { selectionSource: 'user-selected' }));
ok(`Z: relabelling «${systemCat}» as the reader’s makes the undo control appear`,
  asReaders.includes(`data-testid="v2-change-choice-${systemCat}"`));
ok('Z: …proving the control is drawn from the engine’s field, not from a memory',
  !chosenHtml.includes(`data-testid="v2-change-choice-${systemCat}"`));

/*
 * AND THE ESCAPE HATCH SURVIVES A REFUSAL.
 *
 * A choice that makes the build impossible comes back `unavailable` while
 * still being the reader's. Keying the undo on the STATUS would strand them on
 * a page with no way back out of their own decision; keying it on WHO CHOSE
 * cannot. The fixture is a real engine refusal rather than a hand-edited
 * decision — a proven build with an unavailable required category is a
 * contradiction the screen correctly refuses to render at all, so rewriting
 * one would have tested the refusal screen instead of the escape hatch.
 */
const CROSSFIRE_RX = (PART_CATEGORY_MAP.receivers ?? []).find(
  r => (r as unknown as { specs: { protocol: string } }).specs.protocol === 'Crossfire')!;
const REFUSED_BUILD = build({
  ...BASE, owned: { rcSystem: 'ExpressLRS' }, selectedParts: { receivers: CROSSFIRE_RX.id },
});
const rxDecision = dec(REFUSED_BUILD, 'receivers');
ok('Z: the fixture really is a choice the engine refused',
  REFUSED_BUILD.provenPath === null && rxDecision.status === 'unavailable'
  && rxDecision.selectionSource === 'user-selected'
  && rxDecision.partId === CROSSFIRE_RX.id);
/*
 * THE CARD ON ITS OWN FIRST, then the same thing through the whole screen.
 *
 * The rule under test belongs to the CARD, so the card is rendered directly —
 * that keeps the claim about the control, not about the page around it. The
 * page is then asserted separately, because for a while it was the page that
 * made this control unreachable: `proposalDefects` reported
 * `unavailable-required` for EVERY unavailable decision, so an honest «no
 * build exists» was classified as internal corruption and replaced by the
 * refusal screen — with the reasons, and the way out, behind it.
 */
const cardHtml = (d: CategoryDecision, b: ProposedBuild) => renderToStaticMarkup(
  ReactRT.createElement(ProposalCategoryCard, {
    decision: d,
    parts: b.parts,
    categoryParts: BY_CATEGORY[d.category] ?? {},
    categoryLabelAr: PART_VOCAB[d.category]!.ar,
    compact: false,
    expandCandidates: true,
    onChoose: () => {},
    onClearChoice: () => {},
    takeFocus: false,
  }),
);
const refusedCard = cardHtml(rxDecision, REFUSED_BUILD);
ok('Z: a refused choice is still the reader’s, and still has a way out',
  refusedCard.includes('data-testid="v2-change-choice-receivers"')
  && /data-status="unavailable"/.test(refusedCard)
  && /data-source="user-selected"/.test(refusedCard));
ok('Z: …and the reader is told, in the engine’s own words, why it failed',
  rxDecision.reasons.some(r => r.ar.length > 0 && refusedCard.includes(r.ar)));
/*
 * And a category the refusal is not ABOUT gets no undo control: it is
 * `unavailable` too, but nobody chose it, so there is nothing to un-choose.
 */
const bystander = REFUSED_BUILD.decisions.find(
  d => d.category !== 'receivers' && d.selectionSource === 'none')!;
ok(`Z: …while «${bystander.category}», which nobody chose, offers nothing to un-choose`,
  !cardHtml(bystander, REFUSED_BUILD).includes('v2-change-choice-'));
/*
 * AND NOW THE WHOLE SCREEN, which is where this used to be lost.
 *
 * «تعذّر» is an ANSWER. The build does not exist, the engine has said why per
 * category, and one of those categories is the reader's own choice. Refusing
 * the page here reported a consistency problem the code did not have and hid a
 * recoverable one it did.
 */
const refusedPage = renderProposal(REFUSED_BUILD);
ok('Z: the screen RENDERS an impossible build rather than calling it corruption',
  !/data-quality="inconsistent"/.test(refusedPage)
  && !refusedPage.includes('v2-proposal-inconsistent')
  && refusedPage.includes('data-testid="v2-cat-receivers"'));
ok('Z: …the reader’s failed choice is on it, named as theirs',
  /data-testid="v2-cat-receivers" data-status="unavailable" data-source="user-selected"/
    .test(refusedPage));
ok('Z: …with the way out reachable on the page, not just on the card',
  refusedPage.includes('data-testid="v2-change-choice-receivers"'));
ok('Z: …and the engine’s reason printed where the reader can read it',
  rxDecision.reasons.some(r => r.ar.length > 0 && refusedPage.includes(r.ar)));
ok('Z: …under «تعذّر», which is the group an unavailable decision belongs to',
  refusedPage.includes('data-testid="v2-group-problem"'));
/*
 * Still no keys on screen. A page that now renders MORE has more chances to
 * leak one, so the sweep is repeated on exactly this page.
 */
const refusedText = refusedPage.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
ok('Z: …and no catalogue id, category key or check id reaches the reader',
  KEYS.every(k => !refusedText.includes(k)));
/*
 * THE READER STILL CANNOT GET HERE BY PRESSING ANYTHING — section X walked
 * every first and second press across every reader, then to full depth, and no
 * press ever produced a build that cannot exist. The recovery contract is a
 * guarantee about states the DOMAIN can produce, held correct so the screen
 * can never hide one; it is not a state the journey hands out.
 */

// ═══════════════════════════════════════════════════════════════════════════
section('AA — THE COPY SAYS WHAT THE LIST IS NOW FOR');
// ═══════════════════════════════════════════════════════════════════════════
ok('AA: the list tells the reader to choose ONE part for the category',
  PROPOSAL.candidates.instruction.includes('اختر')
  && PROPOSAL.candidates.instruction.includes('واحدة'));
ok('AA: …and tells them the press is not final',
  PROPOSAL.candidates.instruction.includes('تغيير'));
ok('AA: the sentence that called this list display-only is gone from the copy',
  !JSON.stringify(PROPOSAL).includes('للعرض في هذه المرحلة')
  && !('readOnly' in PROPOSAL.candidates));
ok('AA: …and gone from the screen it used to be printed on',
  !openHtml.includes('للعرض في هذه المرحلة')
  && openHtml.includes(PROPOSAL.candidates.instruction));
ok('AA: the announcements are past-tense reports, built from the part’s own name',
  PROPOSAL.candidates.chosenAnnouncement('س') === 'تم اختيار س'
  && PROPOSAL.candidates.clearedAnnouncement('س') === 'تم إلغاء اختيار س');
ok('AA: …and they are different sentences, so one cannot be read as the other',
  PROPOSAL.candidates.chosenAnnouncement('س')
    !== PROPOSAL.candidates.clearedAnnouncement('س'));
/* «اخترتها» stays the badge; «اقترحناه لك» must never reach a reader choice. */
ok('AA: the reader’s card says «اخترتها» and never «اقترحناه لك»',
  chosenHtml.includes(PROPOSAL.selectedBadge)
  && !new RegExp(`v2-badge-${TIE}"[^>]*>${PROPOSAL.recommendedBadge}`).test(chosenHtml));

// ═══════════════════════════════════════════════════════════════════════════
section('AB — THE UI LAYER STILL CANNOT INVENT A SELECTION');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * READ AS CODE, NOT AS PROSE.
 *
 * These files explain at length what they refuse to do — «no localStorage key,
 * no Firebase write», «a `BasePart` object held in React state would…». A
 * sweep over the raw text finds those sentences and reports the file as
 * guilty of exactly what it is promising not to do. Stripping comments first
 * is what makes the check about behaviour; the doc comments stay, and stay
 * readable, which is the point of writing them.
 */
const codeOnly = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const STATE_SRC = codeOnly(readFileSync('web/components/build/v2/selectionState.ts', 'utf8'));
const PREVIEW_SRC = codeOnly(readFileSync('web/components/build/v2/BuildV2Preview.tsx', 'utf8'));
const SCREEN_SRC = codeOnly(readFileSync('web/components/build/v2/ProposalScreen.tsx', 'utf8'));
const CARD_SRC = codeOnly(readFileSync('web/components/build/v2/ProposalCategoryCard.tsx', 'utf8'));
ok('AB: …and the stripper is not vacuous — it removes prose these files really carry',
  /No localStorage key/.test(readFileSync('web/components/build/v2/BuildV2Preview.tsx', 'utf8'))
  && !/No localStorage key/.test(PREVIEW_SRC));
ok('AB: the choice is ids, never parts — no BasePart is held in UI state',
  !/BasePart/.test(STATE_SRC) && !/BasePart/.test(PREVIEW_SRC));
ok('AB: the selection map lives in exactly one component',
  /selectedParts: ReaderSelections/.test(PREVIEW_SRC)
  && !/selectedParts/.test(SCREEN_SRC) && !/selectedParts/.test(CARD_SRC));
ok('AB: it reaches the engine at the top level, not under `owned`',
  /^\s{4}selectedParts: a\.selectedParts,$/m.test(PREVIEW_SRC)
  && !/owned:\s*\{[^}]*selectedParts/s.test(PREVIEW_SRC));
/*
 * ONE DOOR FOR ANSWERS.
 *
 * `answer()` applies the invalidation rule to the before/after pair, so a
 * setter that wrote `answers` directly would bypass it — and the bug would be
 * invisible until a reader lost a choice they had made, or kept one they
 * should not have. Three writers exist by design: the rule, the choice, and
 * the undo. Every QUESTION on the journey goes through the first.
 */
ok('AB: `answers` is written from exactly three places',
  (PREVIEW_SRC.match(/setAnswers\(/g) ?? []).length === 3);
ok('AB: …and no question setter writes it directly, going round the rule',
  (PREVIEW_SRC.match(/onChange=\{[^}]*answer\(a =>/g) ?? []).length >= 3
  && !/onChange=\{[^}]*setAnswers\(/.test(PREVIEW_SRC));
ok('AB: the goal setter goes through the rule too — it is the biggest invalidation',
  /answer\(a => \(\{ \.\.\.a, droneTypeId, sizeInch: undefined, cellCount: undefined \}\)\)/
    .test(PREVIEW_SRC));
ok('AB: no component keeps a second idea of what is chosen',
  ![PREVIEW_SRC, SCREEN_SRC, CARD_SRC].some(
    f => /selectedCandidate|selectedRow|chosenPart|activeCandidate/.test(f)));
ok('AB: nothing in the V2 layer persists anything',
  ![PREVIEW_SRC, SCREEN_SRC, CARD_SRC, STATE_SRC].some(
    f => /localStorage|sessionStorage|indexedDB|firestore|mirrorToProject/i.test(f)));
/*
 * THE DOMAIN IS FROZEN. Phase 2E is a UI phase, and the one way to be sure of
 * that is that the engine's answers did not move — which section P already
 * proves case by case against a baseline written before Phase 2D existed.
 * This is the narrower statement: the UI does not reach into the domain to
 * make its own life easier.
 */
ok('AB: the UI never imports from inside the recommendation engine’s internals',
  ![PREVIEW_SRC, SCREEN_SRC, CARD_SRC, STATE_SRC].some(
    f => /from '[^']*recommendation\/(?!types|proposeBuild)/.test(f)));



// ═══════════════════════════════════════════════════════════════════════════
section('AC — THE ANNOUNCEMENT REPORTS AN ACTION, NOT A STATE');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * The sharpest way to say «this is feedback, not truth»: render a build that
 * HAS a reader choice in it and check the live region is still silent. If the
 * sentence were derived from the build, a page the reader merely reloaded into
 * would announce a choice they made minutes ago — or, worse, the region would
 * become a second place the selection is stated, and the two could disagree.
 */
const silent = /data-testid="v2-selection-announcement"[^>]*>\s*<span><\/span>\s*<\/p>/;
ok('AC: a page with nothing pressed says nothing', silent.test(openHtml));
ok('AC: …and a page that ALREADY carries a reader’s choice still says nothing',
  dec(CHOSEN_BUILD, TIE).selectionSource === 'user-selected' && silent.test(chosenHtml));
ok('AC: the region is polite and out of the visual flow, not a banner',
  /role="status" aria-live="polite" class="sr-only"/.test(chosenHtml));
/*
 * And the badge — which IS selection truth — is present on the same page,
 * so «the region is empty» is not «nothing about the choice is rendered».
 */
ok('AC: …while the card itself does state the choice, in words',
  new RegExp(`data-testid="v2-badge-${TIE}"[^>]*>${PROPOSAL.selectedBadge}`).test(chosenHtml));

// ═══════════════════════════════════════════════════════════════════════════
section('AD — WHAT PHASE 2E DID NOT TOUCH');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * V2 is a preview behind `?buildV2=1`. Everything Phase 2E added has to stay
 * inside it: the V1 build journey is the one readers are actually using, and a
 * phase that quietly edits it is not a preview.
 */
/*
 * The list is DERIVED, not typed. A hardcoded set of V1 filenames goes stale
 * the moment one is added, and goes stale silently — which is the same failure
 * as not checking at all.
 */
const v1Files = [
  ...readdirSync('web/components/build').filter(f => /\.tsx?$/.test(f))
    .map(f => `web/components/build/${f}`),
  ...readdirSync('web/lib/build').filter(f => /\.tsx?$/.test(f))
    .map(f => `web/lib/build/${f}`),
];
ok(`AD: the V1 build surface really is several files (${v1Files.length})`, v1Files.length >= 8);
ok('AD: no V1 file knows anything about reader selections',
  v1Files.every(f => !/selectedParts|user-selected/.test(readFileSync(f, 'utf8'))));
ok('AD: …nor about the copy Phase 2E added',
  v1Files.every(f => !/chosenAnnouncement|clearedAnnouncement/.test(readFileSync(f, 'utf8'))));
ok('AD: …and the sweep is not vacuous — those strings ARE in the V2 layer',
  /selectedParts/.test(PREVIEW_SRC)
  && /chosenAnnouncement/.test(readFileSync('web/components/build/v2/copy.ts', 'utf8')));

/*
 * AND THE ENGINE STILL ANSWERS AN UNSELECTED QUESTION EXACTLY AS IT DID.
 *
 * Section P proves that field for field against a baseline written before
 * Phase 2D existed. This is the narrower statement Phase 2E needs: an EMPTY
 * selection map is not an input — sending `{}` must be indistinguishable from
 * sending nothing, or every reader who has chosen nothing yet is on a
 * different code path from the one the baseline covers.
 */
let emptyDiffs = 0;
for (const [, inp] of Object.entries(INPUTS)) {
  const without = JSON.stringify(build(inp as Record<string, unknown>));
  const withEmpty = JSON.stringify(build({ ...(inp as Record<string, unknown>), selectedParts: {} }));
  if (without !== withEmpty) emptyDiffs++;
}
ok(`AD: an empty selection map changes nothing, on all ${Object.keys(INPUTS).length} baseline readers`,
  Object.keys(INPUTS).length >= 20 && emptyDiffs === 0);



// ═══════════════════════════════════════════════════════════════════════════
section('AE — THE RECOVERY CONTRACT: `unavailable` IS NOT ALWAYS A DEFECT');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * `unavailable-required` exists to catch ONE contradiction: the engine hands
 * back a receipt — «a complete blocker-free assignment exists» — while a
 * required category says it has nothing. Both cannot be true, and a screen
 * that drew either would be asserting something the data does not support.
 *
 * The check was written without the receipt: every `unavailable` decision
 * became a defect. So the ordinary, honest outcome «this build cannot be
 * made» was reported as internal corruption, the engine's per-category reasons
 * were replaced by a message about consistency, and — once Phase 2E let the
 * reader choose — the «تغيير الاختيار» that would have undone the choice
 * responsible was rendered behind a page nobody ever saw.
 *
 * The two halves are asserted here on builds constructed by hand, so that each
 * carries EXACTLY the property under test and nothing else: the real engine
 * cannot be asked for a proven build that also has an unavailable category,
 * because that is the contradiction itself.
 */
const REAL_PART = BY_CATEGORY[TIE][TIE_A];
const RECOVER_CAT = TIE;

/** A skeleton every case below varies from — valid in every other respect. */
const syntheticBuild = (over: Partial<ProposedBuild>): ProposedBuild => ({
  droneTypeId: 'freestyle',
  sizeInch: 5,
  cellCount: 6,
  requiredInputs: [],
  decisions: [],
  parts: {},
  unresolved: [],
  manualChecks: [],
  complete: false,
  provenPath: null,
  blockerFindingIds: [],
  selectionIssues: [],
  ...over,
});

const unavailableChosen: CategoryDecision = {
  category: RECOVER_CAT,
  status: 'unavailable',
  selectionSource: 'user-selected',
  partId: REAL_PART.id,
  candidateIds: [REAL_PART.id],
  compatibility: [],
  reasons: [{
    kind: 'no-candidate', evidence: 'user-input', inputKey: 'selectedParts',
    ar: 'القطعة التي اخترتها لا تسمح بإتمام بناء خالٍ من الموانع — لم تُستبدل، والقرار لك.',
  }],
};

// ── AE-1 · A RECOVERABLE FAILURE IS NOT CORRUPTION ─────────────────────────
const RECOVERABLE = syntheticBuild({
  decisions: [unavailableChosen],
  parts: { [RECOVER_CAT]: REAL_PART },
  unresolved: [RECOVER_CAT],
  provenPath: null,
});
const recoverView = proposalView(RECOVERABLE, VIEW_CTX);
ok('AE-1: the fixture is clean apart from the property under test',
  PART_VOCAB[RECOVER_CAT]?.ar !== undefined
  && BY_CATEGORY[RECOVER_CAT][REAL_PART.id] !== undefined
  && RECOVERABLE.parts[RECOVER_CAT].id === unavailableChosen.partId);
ok('AE-1: an unavailable category on an UNPROVEN build raises no defect at all',
  recoverView.defects.length === 0);
ok('AE-1: …so the screen is not withheld',
  recoverView.consistencyError === false);
ok('AE-1: …and the category is grouped under «تعذّر»',
  recoverView.groups.problem.length === 1
  && recoverView.groups.problem[0].category === RECOVER_CAT);

const recoverHtml = renderProposal(RECOVERABLE);
ok('AE-1: the screen renders the ordinary proposal, not the consistency page',
  !recoverHtml.includes('v2-proposal-inconsistent')
  && !/data-quality="inconsistent"/.test(recoverHtml)
  && recoverHtml.includes(`data-testid="v2-cat-${RECOVER_CAT}"`));
ok('AE-1: …the card carries the «غير متاح» badge',
  new RegExp(`data-testid="v2-badge-${RECOVER_CAT}"[^>]*>${PROPOSAL.unavailableBadge}`)
    .test(recoverHtml));
ok('AE-1: …it shows the part the reader chose, by name',
  recoverHtml.includes(REAL_PART.nameAr));
ok('AE-1: …it prints the engine’s reason verbatim',
  recoverHtml.includes(unavailableChosen.reasons[0].ar));
ok('AE-1: …and it offers «تغيير الاختيار»',
  recoverHtml.includes(`data-testid="v2-change-choice-${RECOVER_CAT}"`)
  && recoverHtml.includes(PROPOSAL.candidates.change));
/*
 * The control is wired to the handler the screen was given — the same code
 * path the browser walk presses at 390×844 and 1280×900 on a real build. Here
 * the button's identity and its accessible name are what can be read back from
 * a static render; that it clears the selection when pressed is proven by the
 * e2e, not asserted twice in different words.
 */
ok('AE-1: …named for the part it would release, so it is not a bare «تغيير»',
  new RegExp(`data-testid="v2-change-choice-${RECOVER_CAT}"[^>]*aria-label="`
    + `${PROPOSAL.candidates.change}: ${REAL_PART.nameAr}"`).test(recoverHtml));
const recoverText = recoverHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
ok('AE-1: …and nothing on it is a raw id',
  KEYS.every(k => !recoverText.includes(k)));

// ── AE-2 · THE REAL CONTRADICTION STILL REFUSES THE PAGE ───────────────────
/*
 * Same decision, same part, same everything — plus a receipt. Now the two
 * statements cannot both hold, and the screen must not choose between them.
 */
const CONTRADICTORY = syntheticBuild({
  decisions: [unavailableChosen],
  parts: { [RECOVER_CAT]: REAL_PART },
  provenPath: { [RECOVER_CAT]: REAL_PART.id },
  complete: true,
});
const contraView = proposalView(CONTRADICTORY, VIEW_CTX);
ok('AE-2: a PROVEN build with an unavailable required category is a defect',
  contraView.defects.length === 1
  && contraView.defects[0].kind === 'unavailable-required'
  && contraView.defects[0].category === RECOVER_CAT);
ok('AE-2: …and the proposal is withheld', contraView.consistencyError === true);
const contraHtml = renderProposal(CONTRADICTORY);
ok('AE-2: …the screen shows the refusal instead of the cards',
  /data-quality="inconsistent"/.test(contraHtml)
  && contraHtml.includes('v2-proposal-inconsistent')
  && !contraHtml.includes(`data-testid="v2-cat-${RECOVER_CAT}"`));
ok('AE-2: …naming the defect in words, never by kind-key',
  contraHtml.includes(PROPOSAL.consistency.kinds['unavailable-required'])
  && !contraHtml.replace(/<[^>]*>/g, ' ').includes('unavailable-required'));
/*
 * THE PAIR IS THE POINT. The two builds differ in `provenPath` and in nothing
 * else — so the rule really is «only against a receipt», not «unavailable is
 * fine now».
 */
ok('AE-2: the two fixtures differ ONLY in the receipt',
  JSON.stringify({ ...RECOVERABLE, provenPath: null, complete: false, unresolved: [] })
  === JSON.stringify({ ...CONTRADICTORY, provenPath: null, complete: false, unresolved: [] }));

// ── AE-3 · EVERY OTHER INTEGRITY GUARD IS UNTOUCHED ────────────────────────
/*
 * This correction is about ONE defect kind. An unprovable build is still
 * refused the moment anything in it cannot be drawn honestly — and each of
 * those is checked on a build that ALSO has `provenPath: null`, which is
 * exactly the case the loosened rule now lets through.
 */
const stillDefective: [string, ProposedBuild, string][] = [
  ['a category the catalogue has no shelf for',
    syntheticBuild({ decisions: [{ ...unavailableChosen, category: 'probe-category' }] }),
    'unknown-category'],
  ['a part id that resolves nowhere',
    syntheticBuild({
      decisions: [{ ...unavailableChosen, partId: 'probe-missing', candidateIds: [] }],
      parts: {},
    }), 'unresolved-part'],
  ['a candidate that belongs to another shelf',
    syntheticBuild({
      decisions: [{
        ...unavailableChosen, partId: undefined,
        candidateIds: [PART_CATEGORY_MAP.frames[0].id],
      }],
      parts: {},
    }), 'foreign-category'],
  ['a card about to show a different part from the one decided',
    syntheticBuild({
      decisions: [unavailableChosen],
      parts: { [RECOVER_CAT]: BY_CATEGORY[RECOVER_CAT][TIE_B] },
    }), 'part-mismatch'],
  ['a manual check with no reader-facing wording',
    syntheticBuild({
      decisions: [unavailableChosen], parts: { [RECOVER_CAT]: REAL_PART },
      manualChecks: ['probe-unknown-check'],
    }), 'unlabelled-manual-check'],
];
for (const [what, b, kind] of stillDefective) {
  const v = proposalView(b, VIEW_CTX);
  ok(`AE-3: ${what} still refuses the page («${kind}»)`,
    v.consistencyError === true && v.defects.some(d => d.kind === kind));
}
ok('AE-3: …and an unlabelled category is still caught too',
  proposalView(syntheticBuild({
    decisions: [{ ...unavailableChosen, category: 'gps' }],
  }), {
    ...VIEW_CTX, categoryLabel: c => (c === 'gps' ? undefined : PART_VOCAB[c]?.ar),
  }).defects.some(d => d.kind === 'unlabelled-category'));

// ── AE-4 · THE DOOR IN IS STILL SHUT ───────────────────────────────────────
/*
 * The correction must NOT turn an impossible initial build into a proposal the
 * reader can walk into. That rule lives in `readinessOf`, it was not touched,
 * and it is asserted here rather than assumed — including on the very build
 * the screen will now happily render if it is somehow already open.
 */
ok('AE-4: an unprovable build is still «no-viable-build» on the summary',
  readinessOf(RECOVERABLE, {}).state === 'no-viable-build');
ok('AE-4: …including the real engine refusal from section Z',
  REFUSED_BUILD.provenPath === null
  && readinessOf(REFUSED_BUILD, {}).state === 'no-viable-build');
ok('AE-4: …and it hands the reader the engine’s own reasons, not a UI sentence',
  (readinessOf(REFUSED_BUILD, {}) as { reasonsAr: readonly string[] }).reasonsAr.length > 0);
ok('AE-4: a provable build is still «ready», so the gate did not seize shut',
  readinessOf(build(BASE), {}).state === 'ready');
/*
 * And the door itself: the proposal button is rendered on the readiness state
 * and on nothing else, so this change cannot have opened a second way in.
 */
ok('AE-4: the proposal opens on `readiness.state === ready` alone',
  /readiness\.state === 'ready' && \(/.test(PREVIEW_SRC)
  && (PREVIEW_SRC.match(/setScreen\('proposal'\)/g) ?? []).length === 1);
ok('AE-4: …and the screen does not re-implement readiness for itself',
  !/provenPath/.test(SCREEN_SRC) && !/provenPath/.test(CARD_SRC));



// ═══════════════════════════════════════════════════════════════════════════
section('AF — OVERRULING A SYSTEM RECOMMENDATION');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * Phase 2E gave the reader the open decisions. Phase 2F gives them the settled
 * ones — a `recommended` category can be swapped for another candidate the
 * engine already admitted, through the SAME `selectedParts` contract.
 *
 * Nothing new enters the domain. The whole feature is: show the ids the engine
 * already returned, minus the one it picked, and send a press down the Phase 2E
 * path. So what is proved here is that the UI reaches semantics Phase 2D built
 * and that the engine's answer — not the UI's memory — is what comes back.
 */
const recDecision = dec(baseline, RANKED);
const ALTERNATIVES = recDecision.candidateIds.filter(id => id !== recDecision.partId);

ok(`AF-0: «${RANKED}» is system-settled with real alternatives (${ALTERNATIVES.length})`,
  recDecision.status === 'recommended'
  && recDecision.selectionSource === 'system'
  && recDecision.partId !== undefined
  && ALTERNATIVES.length > 0);
/* E — the current recommendation is not offered as an alternative to itself. */
ok('AF-E: the alternatives exclude the part already recommended',
  !ALTERNATIVES.includes(recDecision.partId!)
  && ALTERNATIVES.length === recDecision.candidateIds.length - 1);
/* F + G — the list is the engine's, and nothing from the wider shelf leaks in. */
const shelf = (PART_CATEGORY_MAP[RANKED] ?? []).map(p => p.id);
ok('AF-F: every alternative is one the engine returned on this decision',
  ALTERNATIVES.every(id => recDecision.candidateIds.includes(id)));
ok(`AF-G: …and the shelf is strictly bigger (${shelf.length} stocked, `
  + `${recDecision.candidateIds.length} admitted), so that is not vacuous`,
  shelf.length > recDecision.candidateIds.length
  && ALTERNATIVES.every(id => shelf.includes(id)));

/*
 * H — THE NON-FIRST ALTERNATIVE, so a `candidateIds[0]` default cannot hide.
 *
 * `NOT_PREFERRED` is chosen from the far end of the list and is already proved
 * in section 0 to be neither the recommendation nor what an unlocked search
 * reaches first.
 */
const ALT_A = NOT_PREFERRED;
ok('AF-H: the alternative under test is not the first one offered',
  ALT_A !== ALTERNATIVES[0] && ALT_A !== recDecision.partId);

const overridden = build({ ...BASE, selectedParts: { [RANKED]: ALT_A } });
const overDecision = dec(overridden, RANKED);
ok('AF-H: the exact id pressed is the exact id the engine locks',
  overDecision.partId === ALT_A);
ok('AF-H: …reported as the READER’s, never as a recommendation',
  overDecision.selectionSource === 'user-selected'
  && overDecision.status === 'user-selected');
ok('AF-H: …and the part in the build is that part',
  overridden.parts[RANKED]?.id === ALT_A);

/* I — budget is untouched, and does not win. */
ok('AF-I: the budget answer is still in the input and still «mid»',
  (BASE as { budgetTier: string }).budgetTier === 'mid');
ok('AF-I: …and the engine did NOT put its preferred tier back',
  overDecision.partId !== recDecision.partId);
ok('AF-I: …every OTHER category is still ranked by that same budget answer',
  overridden.decisions.some(d => d.category !== RANKED
    && d.reasons.some(r => r.kind === 'ranking' && r.inputKey === 'budgetTier')));

/* J + K — authorship moves by exactly one, and only for this category. */
const beforeView = proposalView(baseline, VIEW_CTX);
const afterView = proposalView(overridden, VIEW_CTX);
ok('AF-J: the system is credited with one decision fewer',
  afterView.counts.systemDecided === beforeView.counts.systemDecided - 1);
ok('AF-K: …and the reader with one more',
  afterView.counts.userSelected === beforeView.counts.userSelected + 1);
ok('AF-K: the overridden category is no longer counted as system-decided',
  !afterView.groups['system-decided'].some(d => d.category === RANKED)
  && afterView.groups.chosen.some(d => d.category === RANKED));
/*
 * …and the HEADLINE is not forced. Other recommendations remain, so the build
 * is still `proposed`. Claiming `reader-shaped` here would say the system
 * settled nothing, which is false.
 */
ok('AF-J: the quality stays «proposed» while the system still decided things',
  afterView.counts.systemDecided > 0 && afterView.quality === 'proposed');

/* L + M — the reason is replaced, not accumulated. */
const rankingReason = recDecision.reasons.find(
  r => r.kind === 'ranking' && r.inputKey === 'budgetTier');
ok('AF-L: the original decision really did rest on the budget ranking',
  rankingReason !== undefined);
ok('AF-L: after the override that ranking sentence is gone',
  !overDecision.reasons.some(r => r.ar === rankingReason!.ar)
  && !overDecision.reasons.some(r => r.kind === 'ranking'));
ok('AF-M: and the engine’s own selection reason is what replaced it',
  overDecision.reasons.some(r => r.kind === 'selection'
    && r.evidence === 'user-input' && r.inputKey === 'selectedParts'));
/*
 * The UI authors NO sentence of its own about the swap. «اخترت بديلًا عن
 * اقتراحنا» would be a claim the domain never made, and it would be the only
 * reason on the card the engine could not stand behind.
 */
ok('AF-M: no component invents a sentence about overriding a recommendation',
  !/بديلًا عن|بدلًا من اقتراح/.test(CARD_SRC + SCREEN_SRC));

/* N — clearing restores the ENGINE’s answer, not a cached one. */
const restored = build({ ...BASE, selectedParts: {} });
ok('AF-N: clearing the choice returns the ordinary recommendation',
  JSON.stringify(dec(restored, RANKED)) === JSON.stringify(recDecision));
ok('AF-N: …and the whole build is identical to never having chosen',
  JSON.stringify(restored) === JSON.stringify(baseline));
/*
 * The restoration is the ENGINE running again on one fewer lock. Nothing in
 * the UI remembers the previous `partId` — a cached id would go stale the
 * moment any other answer changed what the ranking prefers.
 */
ok('AF-N: no component caches a recommendation to put back later',
  !/previousPart|lastRecommend|cachedPart|restorePart/.test(
    PREVIEW_SRC + SCREEN_SRC + CARD_SRC));

/* O — alternative A, back to the system, then a DIFFERENT alternative B. */
const ALT_B = ALTERNATIVES.find(id => id !== ALT_A);
ok('AF-O: a second, different alternative exists to switch to', ALT_B !== undefined);
if (ALT_B !== undefined) {
  const second = build({ ...BASE, selectedParts: { [RANKED]: ALT_B } });
  ok('AF-O: A → clear → B lands on B, with nothing of A left',
    dec(second, RANKED).partId === ALT_B
    && dec(second, RANKED).selectionSource === 'user-selected');
  ok('AF-O: …and B is genuinely a different part from A',
    ALT_B !== ALT_A);
}

/*
 * 11 — DOWNSTREAM RECOMPUTATION IS REAL, AND THE SCREEN SHOWS THE NEW ANSWER.
 *
 * A swap re-runs the whole search, so another category's recommendation,
 * candidate list or availability MAY move. The test does not demand that it
 * does — that would be a claim about this catalogue on this day. It demands
 * that whatever the engine now says is what the screen prints.
 */
const overHtml = renderProposal(overridden);
let comparedCategories = 0;
for (const d of overridden.decisions) {
  if (d.category === RANKED) continue;
  const shown = overridden.parts[d.category];
  if (shown === undefined) continue;
  comparedCategories++;
  ok(`AF-11: «${d.category}» on screen is the RECOMPUTED engine answer`,
    overHtml.includes(shown.nameAr));
}
ok(`AF-11: …and that was checked on real categories (${comparedCategories})`,
  comparedCategories >= 4);
/*
 * Non-vacuity of the comparison itself: at least one category's rendered name
 * is read from the NEW build, so a screen that kept the old decisions would
 * have to agree with the new ones by coincidence on every one of them.
 */
/*
 * Reported EXCLUDING the swapped category — including it made the comparison
 * trivially true and the line always read «other categories moved too», which
 * is an observation about the swap itself rather than about its consequences.
 */
const partIds = (b: ProposedBuild) => Object.fromEntries(
  Object.entries(b.parts).filter(([c]) => c !== RANKED).map(([c, pt]) => [c, pt.id]));
const elsewhereMoved = JSON.stringify(partIds(baseline)) !== JSON.stringify(partIds(overridden));
console.log(`      other categories after the «${RANKED}» override: `
  + `${elsewhereMoved ? 'some moved' : 'none moved — the screen is still checked against the new build'}`);
ok('AF-11: the override itself is visible in the parts map',
  baseline.parts[RANKED].id !== overridden.parts[RANKED].id
  && overridden.parts[RANKED].id === ALT_A);

/*
 * THE PRESS ITSELF — the one thing a static render cannot show.
 *
 * `renderToStaticMarkup` produces the markup and fires nothing, so every
 * assertion above is about what the button LOOKS like. «The id pressed is the
 * id sent» is about what it DOES, and a UI that quietly sent `ids[0]` for every
 * row would satisfy all of them: the markup would be correct and the behaviour
 * wrong.
 *
 * `PartOptionList` holds no hooks, so it can be called as a plain function and
 * the element tree it returns walked until the button for a given id turns up.
 * Then its own `onClick` is invoked. That is a real press, without a browser.
 */
type El = { props?: Record<string, unknown>; [k: string]: unknown };
const findEl = (node: unknown, hit: (el: El) => boolean): El | null => {
  if (Array.isArray(node)) {
    for (const n of node) { const f = findEl(n, hit); if (f) return f; }
    return null;
  }
  if (node === null || typeof node !== 'object') return null;
  const el = node as El;
  if (hit(el)) return el;
  return findEl((el.props ?? {}).children, hit);
};

const pressed: [string, string, string][] = [];
const optionTree = (PartOptionList as unknown as (p: Record<string, unknown>) => unknown)({
  category: RANKED,
  ids: ALTERNATIVES,
  categoryParts: BY_CATEGORY[RANKED],
  testId: 'probe-list',
  note: PROPOSAL.alternatives.note,
  onChoose: (c: string, id: string, ar: string) => pressed.push([c, id, ar]),
});
const altButtonFor = (id: string) => findEl(optionTree,
  el => (el.props ?? {})['data-testid'] === `v2-choose-${RANKED}-${id}`);

ok('AF-H: every alternative has a findable button in the tree',
  ALTERNATIVES.every(id => altButtonFor(id) !== null));
/* Press the LAST one — a `ids[0]` default is only visible from a later row. */
const lastAlt = ALTERNATIVES[ALTERNATIVES.length - 1];
ok('AF-H: the row pressed is not the first offered',
  ALTERNATIVES.length > 1 && lastAlt !== ALTERNATIVES[0]);
(altButtonFor(lastAlt)!.props!.onClick as () => void)();
/*
 * Optional chaining, deliberately: a mutation that SWALLOWS the press leaves
 * `pressed` empty, and reading `pressed[0][0]` would throw and take the rest
 * of the suite with it — hiding every other thing that probe broke. A probe
 * must report, not crash.
 */
ok('AF-H: pressing a row sends THAT row’s id, not the list’s first',
  pressed.length === 1 && pressed[0]?.[1] === lastAlt);
ok('AF-H: …with its own category and its own Arabic name alongside',
  pressed[0]?.[0] === RANKED
  && pressed[0]?.[2] === BY_CATEGORY[RANKED][lastAlt].nameAr);
/* And every row is wired to the same handler — none is inert or private. */
pressed.length = 0;
for (const id of ALTERNATIVES) (altButtonFor(id)!.props!.onClick as () => void)();
ok('AF-H: every row reaches the handler, each with its own id, in order',
  pressed.length === ALTERNATIVES.length
  && pressed.every(([, id], i) => id === ALTERNATIVES[i]));

/*
 * …AND A SWAP THAT GENUINELY MOVES SOMETHING ELSE.
 *
 * Measured across the catalogue: of the 136 single swaps a reader can make,
 * only 6 change another category at all. The `frames` swap above is not one of
 * them, so on its own this suite would only ever prove «the screen agrees with
 * the engine when the engine did not change its mind» — which is the easy
 * half.
 *
 * This is the hard half. On a BUDGET Freestyle, taking the premium frame
 * withdraws the propeller recommendation entirely: that category stops being
 * settled and becomes a question. A screen holding on to its previous
 * decisions would still be printing a propeller the engine no longer
 * recommends, under a heading that says the system decided it.
 */
const MOVER = { droneTypeId: 'freestyle', cellCount: 6, budgetTier: 'budget', owned: {} };
const moverBase = build(MOVER);
const moverFrames = dec(moverBase, 'frames');
const PREMIUM_FRAME = moverFrames.candidateIds.find(
  id => id !== moverFrames.partId
    && JSON.stringify(dec(build({ ...MOVER, selectedParts: { frames: id } }), 'propellers'))
      !== JSON.stringify(dec(moverBase, 'propellers')));
ok('AF-11: a swap that really does move another category exists in this catalogue',
  PREMIUM_FRAME !== undefined);

if (PREMIUM_FRAME !== undefined) {
  const moverAfter = build({ ...MOVER, selectedParts: { frames: PREMIUM_FRAME } });
  const propsBefore = dec(moverBase, 'propellers');
  const propsAfter = dec(moverAfter, 'propellers');
  const droppedName = moverBase.parts.propellers?.nameAr;

  ok('AF-11: before the swap the propellers were settled by the system',
    propsBefore.status === 'recommended' && propsBefore.selectionSource === 'system'
    && droppedName !== undefined);
  ok('AF-11: after it they are an open question again',
    propsAfter.status === 'choice-required' && propsAfter.partId === undefined
    && moverAfter.parts.propellers === undefined);

  const moverBeforeHtml = renderProposal(moverBase);
  const moverAfterHtml = renderProposal(moverAfter);
  ok('AF-11: the withdrawn recommendation WAS on the page before the swap',
    moverBeforeHtml.includes(droppedName!)
    && moverBeforeHtml.includes('data-testid="v2-group-system-decided"'));
  ok('AF-11: …and the page after the swap no longer presents it as settled',
    !new RegExp(`data-testid="v2-cat-propellers" data-status="recommended"`)
      .test(moverAfterHtml));
  ok('AF-11: …the category has moved into «نحتاج اختيارك» with its candidates',
    moverAfterHtml.includes('data-testid="v2-group-needs-you"')
    && moverAfterHtml.includes('data-testid="v2-candidates-propellers"'));
  ok('AF-11: …and it offers the reader every candidate the engine now returns',
    propsAfter.candidateIds.every(id =>
      moverAfterHtml.includes(`data-testid="v2-choose-propellers-${id}"`)));
  /*
   * The burden line is recomputed too — the reader is told the system now
   * needs one more answer from them than it did a moment ago.
   */
  const burdenBefore = proposalView(moverBase, VIEW_CTX).counts;
  const burdenAfter = proposalView(moverAfter, VIEW_CTX).counts;
  ok('AF-11: the decision burden reported to the reader goes UP by one',
    burdenAfter.choiceRequired === burdenBefore.choiceRequired + 1);
  ok('AF-11: …and the copy warned that exactly this could happen',
    PROPOSAL.alternatives.note.includes('قد يغيّر'));
}

// ── The rendered control ───────────────────────────────────────────────────
const recHtml = renderProposal(baseline);
ok('AF-T: the alternatives are behind a closed disclosure, not on the page',
  new RegExp(`data-testid="v2-show-alternatives-${RANKED}"[^>]*aria-expanded="false"`)
    .test(recHtml));
ok('AF-T: …and the label carries the count in Arabic digits',
  new RegExp(`data-testid="v2-show-alternatives-${RANKED}"[\\s\\S]{0,300}?[٠-٩]`).test(recHtml));
ok('AF-T: the disclosure names its category, so eight of them are distinguishable',
  new RegExp(`data-testid="v2-show-alternatives-${RANKED}"[^>]*aria-label="[^"]*`
    + `${PART_VOCAB[RANKED]!.ar}"`).test(recHtml));
const altButtons = [...recHtml.matchAll(
  new RegExp(`data-testid="v2-choose-${RANKED}-([^"]+)"`, 'g'))].map(m => m[1]);
ok('AF-F: the rendered alternatives are exactly the engine’s, minus the recommendation',
  altButtons.length === ALTERNATIVES.length
  && ALTERNATIVES.every(id => altButtons.includes(id)));
ok('AF-E: …and the recommendation itself has no «choose me» button',
  !altButtons.includes(recDecision.partId!));
ok('AF-Y: no id reaches anything spoken or shown on that page',
  [...recHtml.matchAll(/aria-label="([^"]*)"/g)].map(m => m[1])
    .every(l => ![...ALL_IDS].some(id => l.includes(id)))
  && KEYS.every(k => !recHtml.replace(/<[^>]*>/g, ' ').includes(k)));
/* The consequence is stated where the reader will act on it. */
ok('AF: the panel says these are viable alternatives, not better ones',
  recHtml.includes(PROPOSAL.alternatives.title)
  && !/أفضل|موصى/.test(PROPOSAL.alternatives.title));
ok('AF: …and warns that a swap can move other cards',
  recHtml.includes(PROPOSAL.alternatives.note)
  && PROPOSAL.alternatives.note.includes('قطع أخرى'));

/*
 * AND THE SWAPPED CARD BECOMES AN ORDINARY PHASE 2E CHOICE — same badge, same
 * undo, no second mechanism. The swap is a way IN to `selectedParts`, not a
 * parallel feature with its own state.
 */
ok('AF: after the override the card is an ordinary reader choice',
  overHtml.includes(`data-testid="v2-change-choice-${RANKED}"`)
  && new RegExp(`data-testid="v2-badge-${RANKED}"[^>]*>${PROPOSAL.selectedBadge}`)
    .test(overHtml));
ok('AF: …and offers no alternatives control of its own any more',
  !overHtml.includes(`data-testid="v2-show-alternatives-${RANKED}"`));


console.log(`\n[reader selection] ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(f => console.log(`  FAILED: ${f}`));
  process.exit(1);
}
