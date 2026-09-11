/**
 * BUILD V2 PHASE 2C — THE PROPOSAL, AND WHAT IT IS ALLOWED TO CLAIM
 * =================================================================
 *
 * The first screen in V2 that shows a part. Everything on it is a claim about
 * what the system decided and why, so this suite is mostly about restraint:
 *
 *   · «اقترحناه لك», never «الأفضل» — nothing in the data ranks products
 *   · «الخيار الوحيد المتوافق في الكتالوج», never «أفضل خيار» — and never a
 *     statement about the market
 *   · a `choice-required` category shows EVERY surviving candidate with NONE
 *     preferred: not `candidateIds[0]`, and not the `provenPath` member, which
 *     proves a build exists and broke each tie arbitrarily to do it
 *   · no reader selection at all, because the domain cannot represent
 *     «chose but does not own»
 *   · no «متوافق بالكامل» while a manual check is open
 *
 * It also PRINTS the decision burden for every representative build, because
 * the question Phase 2C exists to answer — did V2 reduce the decisions or just
 * move them? — is a measurement, not an opinion.
 *
 * Run: npx tsx --tsconfig web/tsconfig.json scripts/testBuildV2Proposal.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { proposeBuild } from '../src/data/assembly/recommendation/proposeBuild';
import type { ProposedBuild } from '../src/data/assembly/recommendation/types';
import { PART_CATEGORY_MAP } from '../src/data/project/store';
import { SHARED_COMPAT_RULES } from '../src/data/assembly/compatibility/rules';
import {
  proposalView, proposalBurdenAr, groupOf, proposalDefects, candidatesOf,
  type ProposalContext, type ProposalDefectKind,
} from '../web/components/build/v2/proposalModel';
import { COMPAT_RULE_LABEL_AR, compatRuleLabelAr } from '../web/components/build/v2/compatLabels';
import { arabicCount, CHOICE_NOUN, arabicNumber } from '../web/components/build/v2/arabicCount';
import { partFacts } from '../web/components/build/v2/partFacts';
import { PROPOSAL, SUMMARY } from '../web/components/build/v2/copy';
import { PART_VOCAB, partLabelAr } from '../web/lib/build/labels';
import { ProposalCategoryCard } from '../web/components/build/v2/ProposalCategoryCard';
import { readinessOf } from '../web/components/build/v2/readiness';

let passed = 0;
const failures: string[] = [];
function ok(label: string, condition: boolean) {
  if (condition) { passed++; console.log(`  ok — ${label}`); }
  else { failures.push(label); console.log(`  FAIL — ${label}`); }
}
const section = (t: string) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 62 - t.length))}`);

const V2 = 'web/components/build/v2';
const read = (p: string) => readFileSync(p, 'utf8');
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const src = Object.fromEntries(readdirSync(V2).filter(f => /\.tsx?$/.test(f))
  .map(f => [f, code(read(join(V2, f)))]));
const allCode = Object.values(src).join('\n');

const CATALOGUE: Record<string, ReturnType<typeof Object.values> extends never ? never
  : (typeof PART_CATEGORY_MAP)[string][number]> = {};
for (const list of Object.values(PART_CATEGORY_MAP)) for (const p of list) CATALOGUE[p.id] = p;

/**
 * The real world, indexed the way the screen indexes it: one shelf per
 * category, plus a flat set used ONLY to tell «missing» from «foreign».
 */
const BY_CATEGORY: Record<string, Record<string, typeof CATALOGUE[string]>> = {};
for (const [category, list] of Object.entries(PART_CATEGORY_MAP)) {
  BY_CATEGORY[category] = {};
  for (const p of list) BY_CATEGORY[category][p.id] = p;
}
const CTX: ProposalContext = {
  resolvePart: (category, id) => BY_CATEGORY[category]?.[id],
  existsInAnyCategory: id => id in CATALOGUE,
  hasCategory: category => category in PART_CATEGORY_MAP,
  /* STRICT — `partLabelAr` would answer this with the key itself. */
  categoryLabel: category => PART_VOCAB[category]?.ar,
  hasManualLabel: id => id in PROPOSAL.manual.labels,
};

const b = (input: Record<string, unknown>) => proposeBuild(input as never);
const view = (input: Record<string, unknown>) => proposalView(b(input), CTX);
const FREESTYLE_MID = { droneTypeId: 'freestyle', cellCount: 6, budgetTier: 'mid', owned: {} };
const FREESTYLE_NONE = { droneTypeId: 'freestyle', cellCount: 6, owned: {} };
const FREESTYLE_DJI = {
  droneTypeId: 'freestyle', cellCount: 6, budgetTier: 'mid', owned: { videoSystem: 'DJI' },
};
const CINEMATIC_MID = { droneTypeId: 'cinematic', cellCount: 6, budgetTier: 'mid', owned: {} };
const LONGRANGE_MID = { droneTypeId: 'long-range', budgetTier: 'mid', owned: {} };
const CROSSFIRE = {
  droneTypeId: 'freestyle', cellCount: 6, budgetTier: 'mid', owned: { rcSystem: 'Crossfire' },
};

// ═══════════════════════════════════════════════════════════════════════════
section('THE DECISION BURDEN — MEASURED, NOT CLAIMED');
// ═══════════════════════════════════════════════════════════════════════════
const BURDEN_CASES: Array<[string, Record<string, unknown>]> = [
  ['Freestyle · 6S · متوازن', FREESTYLE_MID],
  ['Freestyle · 6S · لا تفضيل', FREESTYLE_NONE],
  ['Freestyle · 6S · متوازن · DJI', FREESTYLE_DJI],
  ['Freestyle · 4S · متوازن', { droneTypeId: 'freestyle', cellCount: 4, budgetTier: 'mid', owned: {} }],
  ['Cinematic · 6S · متوازن', CINEMATIC_MID],
  ['Cinematic · 6S · لا تفضيل', { droneTypeId: 'cinematic', cellCount: 6, owned: {} }],
  ['Long-range · متوازن', LONGRANGE_MID],
  ['Long-range · لا تفضيل', { droneTypeId: 'long-range', owned: {} }],
];
const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length));
console.log(`  ${pad('build', 32)}req rec only choice lock unav manual  quality`);
for (const [label, input] of BURDEN_CASES) {
  const v = proposalView(b(input), CTX);
  const c = v.counts;
  console.log(`  ${pad(label, 32)}${pad(String(c.required), 4)}${pad(String(c.recommended), 4)}`
    + `${pad(String(c.onlyCompatible), 5)}${pad(String(c.choiceRequired), 7)}`
    + `${pad(String(c.userLocked), 5)}${pad(String(c.unavailable), 5)}`
    + `${pad(String(c.manualChecks), 8)}${v.quality}`);
  console.log(`  ${' '.repeat(32)}→ ${proposalBurdenAr(c, PROPOSAL.burden, n => arabicCount(n, CHOICE_NOUN))}`);
}

// ═══════════════════════════════════════════════════════════════════════════
section('1 — ONLY A READY BUILD MAY OPEN THE PROPOSAL');
// ═══════════════════════════════════════════════════════════════════════════
const preview = src['BuildV2Preview.tsx'];
ok('the door is the readiness state itself', /readiness\.state === 'ready' && \(/.test(preview));
ok('there is exactly one way in', (preview.match(/setScreen\('proposal'\)/g) ?? []).length === 1);
ok('the proposal screen renders only on that screen name',
  /screen === 'proposal' && build && \(\s*\n?\s*<ProposalScreen/.test(preview));

/*
 * The three readiness states, checked at the source rather than trusted: an
 * unsure ecosystem and a dead build are BOTH non-ready, so neither can reach
 * the one condition that opens the door.
 */
const viable = b(FREESTYLE_MID);
ok('an explicitly unsure radio is not ready — so it cannot open the proposal',
  readinessOf(viable, { answer: 'radio', rc: { kind: 'unsure' } }).state
    === 'needs-equipment-identification');
ok('an explicitly unsure goggle system likewise',
  readinessOf(viable, { answer: 'goggles', video: { kind: 'unsure' } }).state
    === 'needs-equipment-identification');
ok('a build with no proven path is not ready either',
  readinessOf(b(CROSSFIRE), { answer: 'none' }).state === 'no-viable-build');
ok('and the ordinary case is', readinessOf(viable, { answer: 'none' }).state === 'ready');

// ═══════════════════════════════════════════════════════════════════════════
section('2 — THE COUNTS ARE DERIVED FROM THE DECISIONS');
// ═══════════════════════════════════════════════════════════════════════════
for (const [label, input] of BURDEN_CASES) {
  const build = b(input);
  const c = proposalView(build, CTX).counts;
  const real = (s: string) => build.decisions.filter(d => d.status === s).length;
  ok(`${label}: every count matches the engine`,
    c.recommended === real('recommended') && c.onlyCompatible === real('only-compatible')
    && c.choiceRequired === real('choice-required') && c.userLocked === real('user-locked')
    && c.unavailable === real('unavailable') && c.required === build.decisions.length
    && c.systemDecided === real('recommended') + real('only-compatible')
    && c.manualChecks === build.manualChecks.length);
}
/*
 * The grouping is a PARTITION: every decision lands in exactly one group, and
 * the mapping is by status, not by category. A category quietly dropped from
 * all four groups would vanish from the screen without failing anything else.
 */
for (const [label, input] of BURDEN_CASES) {
  const build = b(input);
  const v = proposalView(build, CTX);
  const placed = Object.values(v.groups).flat();
  ok(`${label}: every decision is placed exactly once`,
    placed.length === build.decisions.length
    && new Set(placed.map(d => d.category)).size === build.decisions.length
    && placed.every(d => v.groups[groupOf(d.status)].includes(d)));
}
ok('the four statuses map to the groups a reader can act on',
  groupOf('choice-required') === 'needs-you' && groupOf('recommended') === 'system-decided'
  && groupOf('only-compatible') === 'system-decided' && groupOf('user-locked') === 'yours'
  && groupOf('unavailable') === 'problem');

ok('no count is written into the copy',
  !/[0-9٠-٩]/.test(JSON.stringify(PROPOSAL.burden) + JSON.stringify(PROPOSAL.groups)));

/*
 * ARABIC COUNTS ARE NOT ENGLISH COUNTS. The engine returns 0-8 on either side
 * of the burden sentence, so the singular, the dual, the 3-10 plural and the
 * 11+ accusative are all reachable — and «٦ اختيار» or «٢ اختيارات» is the
 * tell that nobody who reads Arabic read the screen.
 */
ok('1 uses the singular', arabicCount(1, CHOICE_NOUN) === 'اختيار واحد');
ok('2 uses the DUAL, which English does not have', arabicCount(2, CHOICE_NOUN) === 'اختيارين');
ok('3-10 use the plural', arabicCount(6, CHOICE_NOUN) === '٦ اختيارات'
  && arabicCount(10, CHOICE_NOUN) === '١٠ اختيارات');
ok('11+ uses the accusative singular', arabicCount(11, CHOICE_NOUN) === '١١ اختيارًا');
ok('digits are Arabic-Indic, like the rest of the product', arabicNumber(2026) === '٢٠٢٦');

// ═══════════════════════════════════════════════════════════════════════════
section('3 — WHAT EACH STATUS IS ALLOWED TO SAY');
// ═══════════════════════════════════════════════════════════════════════════
ok('«recommended» is «اقترحناه لك»', PROPOSAL.recommendedBadge === 'اقترحناه لك');
ok('nothing in the proposal copy claims a best product',
  !/الأفضل|أفضل خيار|الأمثل/.test(JSON.stringify(PROPOSAL)));
ok('«only-compatible» says it is about the CATALOGUE',
  PROPOSAL.onlyCompatibleBadge.includes('الكتالوج'));
ok('…and explicitly disclaims the market',
  /لا يعني أنه الوحيد في السوق/.test(PROPOSAL.onlyCompatibleNote));
ok('an owned part is «قطعة لديك», never «اقترحناها»',
  PROPOSAL.ownedBadge === 'قطعة لديك' && !PROPOSAL.ownedBadge.includes('اقترح'));
/*
 * A tied category has no «هذه القطعة». Asking «لماذا هذه القطعة؟» over an
 * empty selection points the reader at a part that is not on the card.
 */
ok('a tie explains why nothing was chosen, not why something was',
  PROPOSAL.whyTieTitle === 'لماذا لم نرجّح واحدة؟'
  && /decision\.status === 'choice-required' \? PROPOSAL\.whyTieTitle/
    .test(src['ProposalCategoryCard.tsx']));

ok('a choice-required category admits it needs the reader',
  PROPOSAL.groups['needs-you'].title === 'نحتاج اختيارك');
ok('…and says the options are tied, not that one is better',
  /لا نملك ما يرجّح بينها/.test(PROPOSAL.groups['needs-you'].note));

const recommended = b(FREESTYLE_MID).decisions.find(d => d.status === 'recommended')!;
ok('a recommended decision really carries the part it selected',
  recommended.partId !== undefined && recommended.selectionSource === 'system');
ok('the card renders the selected part from `build.parts`',
  /parts\[decision\.category\]/.test(src['ProposalCategoryCard.tsx']));

// ═══════════════════════════════════════════════════════════════════════════
section('4 — A TIE IS SHOWN AS A TIE');
// ═══════════════════════════════════════════════════════════════════════════
const tied = b(FREESTYLE_MID).decisions.find(d => d.status === 'choice-required')!;
ok('the tied category has more than one survivor', tied.candidateIds.length > 1);
/*
 * NOTHING IS FILTERED ON THE WAY TO THE SCREEN.
 *
 * This read `/decision\.candidateIds\.map/` — a grep for one expression in one
 * component — and it broke the moment Phase 2F extracted the row renderer so
 * that a `recommended` card's alternatives and a tie's candidates could share
 * one button, one accessible name and one 44px floor. Nothing about what a
 * reader sees had changed.
 *
 * The claim is about the LIST, so it is asked of the list: the model hands the
 * screen every surviving id, in order. The RENDERED half — every one of those
 * ids reaches a real button — is asserted in section 12, where the card is
 * actually rendered.
 */
ok('EVERY candidate reaches the screen, none filtered',
  candidatesOf(tied).length === tied.candidateIds.length
  && candidatesOf(tied).every((id, i) => id === tied.candidateIds[i]));
ok('every candidate carries data-selected="false"',
  /data-selected="false"/.test(src['ProposalCategoryCard.tsx']));
ok('no candidate is ever marked selected',
  !/data-selected=\{/.test(src['ProposalCategoryCard.tsx'])
  && !/data-selected="true"/.test(src['ProposalCategoryCard.tsx']));

/*
 * THE TWO FAKE WINNERS.
 *
 * `candidateIds[0]` is the catalogue's order, which is not a ranking. And the
 * `provenPath` member is the arbitrary tie-break the existence search happened
 * to make — presenting either as «the system's pick» manufactures a
 * recommendation the engine explicitly refused to give.
 */
ok('no component indexes into candidateIds', !/candidateIds\s*\[\s*0\s*\]/.test(allCode));
/*
 * Scoped to COMPONENTS. `readiness.ts` reads `provenPath` and must — it is the
 * existence receipt the whole readiness model rests on. What must never happen
 * is a component treating that proof as a pick, so the check is on the files
 * that render.
 */
const componentCode = Object.entries(src)
  .filter(([f]) => f.endsWith('.tsx')).map(([, c]) => c).join('\n');
ok('no COMPONENT reads provenPath', !/provenPath/.test(componentCode));
ok('…and the readiness module still does, which is the point',
  /provenPath/.test(src['readiness.ts']));
const withPath = b(FREESTYLE_MID);
ok('the proven path really does pick a member of the tie (so this matters)',
  withPath.provenPath !== null && tied.candidateIds.includes(withPath.provenPath![tied.category]));
ok('…and the decision still reports NO selection for that category',
  tied.partId === undefined && tied.selectionSource === 'none');

// ═══════════════════════════════════════════════════════════════════════════
section('5 — A READER CHOICE IS AN ENGINE INPUT, NEVER A REACT FLAG');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * Phase 2C found no way to say «chose but does not own»: `owned.parts` means
 * «already in hand» and produces `user-locked` / `selectionSource:
 * 'user-owned'`, so routing a wizard click through it would have told someone
 * they own hardware they had not bought. It showed candidates read-only and
 * reported the gap instead.
 *
 * PHASE 2D BUILT THE CHANNEL — `selectedParts` / `user-selected` — and PHASE
 * 2E wired the click to it. So the assertion that used to read «nothing here
 * is clickable» has to invert, and what replaces it must be stronger rather
 * than merely different: the click exists, and the ONLY thing it may do is
 * become an input to `proposeBuild`.
 *
 * The two that do NOT change are the two that mattered most. A selection must
 * never travel through `owned`, in this phase or any later one.
 */
ok('nothing in the V2 layer writes owned.parts', !/owned\s*:\s*\{[^}]*parts/.test(allCode));
ok('nothing in the V2 layer even mentions owned.parts', !/owned\.parts/.test(allCode));
/*
 * NO PARALLEL TRUTH. A component that remembers which candidate was pressed is
 * a second answer to «what is chosen here», and it disagrees with the engine
 * the first time the engine refuses the choice. The names below are the ones
 * such a state would plausibly be given; the behavioural proof that the engine
 * is the only source lives in `scripts/testReaderSelection.ts`.
 */
ok('no component keeps its own idea of what is selected',
  !/selectedCandidate|selectedRow|chosenPart|activeCandidate/.test(componentCode));
ok('the card asks the ENGINE whose part this is',
  /decision\.selectionSource === 'user-selected'/.test(src['ProposalCategoryCard.tsx']));
ok('the selection map never reaches the presentation layer',
  !/selectedParts/.test(src['ProposalScreen.tsx'])
  && !/selectedParts/.test(src['ProposalCategoryCard.tsx']));
ok('…and it does reach the engine, from the one component that owns it',
  /selectedParts: a\.selectedParts/.test(preview));
ok('a candidate row is chosen by a real button, not a clickable box',
  /<button[\s\S]{0,400}PROPOSAL\.candidates\.choose/.test(src['ProposalCategoryCard.tsx']));
ok('the button names the part it would choose',
  /aria-label=\{`\$\{PROPOSAL\.candidates\.choose\} \$\{c\.nameAr\}`\}/
    .test(src['ProposalCategoryCard.tsx']));
ok('no candidate id is ever shown to a reader',
  !/>\{id\}<|\{`\$\{id\}`\}/.test(src['ProposalCategoryCard.tsx']));
ok('the screen tells the reader what to do with the list',
  PROPOSAL.candidates.instruction.includes('اختر')
  && PROPOSAL.candidates.instruction.includes('واحدة'));
ok('…and no longer claims the list is display-only',
  !/للعرض في هذه المرحلة/.test(JSON.stringify(PROPOSAL))
  && !('readOnly' in PROPOSAL.candidates));
/* Flattened to ONE space: a doc comment's indentation is not its meaning. */
const modelProse = read(`${V2}/proposalModel.ts`).replace(/\n\s*\*/g, ' ')
  .replace(/\s+/g, ' ');
ok('the model documents that the domain expresses selection',
  modelProse.includes('The DOMAIN says «the reader chose this but does not own it»'));
ok('…and that a chosen category leaves the candidate list entirely',
  modelProse.includes('a chosen category is not `choice-required` any more'));

// ═══════════════════════════════════════════════════════════════════════════
section('6 — EXPLANATIONS AND EVIDENCE ARE THE ENGINE\'S');
// ═══════════════════════════════════════════════════════════════════════════
ok('reasons are rendered straight from decision.reasons',
  /decision\.reasons\.map/.test(src['ProposalCategoryCard.tsx']));
ok('no component composes an explanation from a rule id',
  !/ruleId.*(replace|split|toUpperCase|charAt)/.test(allCode));
/*
 * ARABIC PROSE IN A COMPONENT, DETECTED PROPERLY.
 *
 * The first version of this test looked for twelve consecutive Arabic
 * characters — and no Arabic word is twelve letters long, so it matched
 * nothing and passed against a probe that hard-coded a full sentence into the
 * card. A test that cannot fail is worse than no test.
 *
 * What it should find is a STRING LITERAL holding more than one Arabic word.
 * Separators like ' · ' and ' — ' carry no Arabic letters and are fine; every
 * real sentence belongs in `copy.ts` or comes from the engine.
 */
const arabicProseLiterals = (file: string): string[] =>
  (file.match(/'[^'\n]*'|"[^"\n]*"/g) ?? [])
    .filter(lit => (lit.match(/[\u0621-\u064A]+/g) ?? []).length >= 2);
ok('the card writes no Arabic sentence of its own',
  arabicProseLiterals(src['ProposalCategoryCard.tsx']).length === 0);
ok('nor does the proposal screen',
  arabicProseLiterals(src['ProposalScreen.tsx']).length === 0);
ok('…and the detector is not vacuous — it finds prose in copy.ts',
  arabicProseLiterals(src['copy.ts']).length > 20);
ok('the recommended decision really has an Arabic reason to show',
  recommended.reasons.length > 0 && recommended.reasons.every(r => r.ar.trim().length > 0));

ok('compatibility is rendered only from decision.compatibility',
  /decision\.compatibility/.test(src['ProposalCategoryCard.tsx'])
  && !/SHARED_COMPAT_RULES/.test(allCode));
ok('a rule that was not evaluated cannot render as a pass',
  /ev\.map\(e =>/.test(src['ProposalCategoryCard.tsx'])
  && !/status:\s*'pass'/.test(src['ProposalCategoryCard.tsx']));
ok('the headline downgrades when any rule is violated or unknown',
  /someViolated/.test(src['ProposalCategoryCard.tsx'])
  && /someUnknown/.test(src['ProposalCategoryCard.tsx']));
ok('a decision with no shared rule says so rather than claiming a pass',
  /PROPOSAL\.compat\.none/.test(src['ProposalCategoryCard.tsx']));
ok('the evidence really is per-decision and small',
  recommended.compatibility.length >= 1 && recommended.compatibility.length <= 4);

// ═══════════════════════════════════════════════════════════════════════════
section('7 — MANUAL CHECKS BLOCK THE «FULLY COMPATIBLE» CLAIM');
// ═══════════════════════════════════════════════════════════════════════════
const manual = b(FREESTYLE_MID);
ok('this build really does carry a manual check', manual.manualChecks.length > 0);
ok('the proposal copy never claims full compatibility',
  !/متوافق بالكامل|متوافق تمامًا|توافق كامل/.test(JSON.stringify(PROPOSAL)));
ok('the manual check is announced as a check before the build is trusted',
  /هناك فحص يدوي قبل اعتماد البناء/.test(PROPOSAL.manual.title));
ok('current-headroom has honest wording and NO invented amp number',
  PROPOSAL.manual.labels['current-headroom'] !== undefined
  && !/[0-9٠-٩]+\s*(A|أمبير)/.test(PROPOSAL.manual.labels['current-headroom']));
ok('the manual section renders from build.manualChecks, not a hard-coded list',
  /view\.manualChecks\.map/.test(src['ProposalScreen.tsx']));

// ═══════════════════════════════════════════════════════════════════════════
section('8 — AN INCONSISTENT PROPOSAL IS REFUSED, NOT DRAWN');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * A PROVEN build cannot contain an unavailable REQUIRED category — the engine
 * found a complete blocker-free assignment, so every category had something to
 * offer. If both are ever true, the screen must not render a plausible-looking
 * proposal over the contradiction.
 *
 * THE RECEIPT IS THE CONDITION, and for a while the code did not say so: the
 * defect fired on any unavailable decision, so an honest «no build exists» was
 * reported as internal corruption and its per-category reasons were replaced
 * by the refusal page. Both directions are asserted on the SAME decision, so
 * `provenPath` is visibly what separates them.
 */
const withUnavailable = (over: Partial<ProposedBuild>) => ({
  ...b(FREESTYLE_MID),
  decisions: b(FREESTYLE_MID).decisions.map((d, i) =>
    (i === 0 ? { ...d, status: 'unavailable' as const } : d)),
  ...over,
}) as ProposedBuild;
const fakeInconsistent = withUnavailable({});
ok('the fixture really does carry a receipt', fakeInconsistent.provenPath !== null);
ok('an unavailable category on a PROVEN build sets the consistency flag',
  proposalView(fakeInconsistent, CTX).consistencyError);
ok('…the same decision on an UNPROVEN build does not — it is an honest answer',
  !proposalView(withUnavailable({ provenPath: null }), CTX).consistencyError);
ok('…and that category is then shown under «تعذّر» rather than hidden',
  proposalView(withUnavailable({ provenPath: null }), CTX).groups.problem.length === 1);
ok('a healthy build does not', !proposalView(b(FREESTYLE_MID), CTX).consistencyError);
ok('the screen refuses to render a proposal in that state',
  /if \(view\.consistencyError\)/.test(src['ProposalScreen.tsx']));
ok('…and says so out loud, with role="alert"',
  /role="alert"/.test(src['ProposalScreen.tsx']));
ok('no real representative build is inconsistent',
  BURDEN_CASES.every(([, i]) => !proposalView(b(i), CTX).consistencyError));

// ═══════════════════════════════════════════════════════════════════════════
section('9 — «PROPOSED» IS NOT CLAIMED WHEN NOTHING WAS PROPOSED');
// ═══════════════════════════════════════════════════════════════════════════
ok('Freestyle with a budget tier IS a proposal',
  proposalView(b(FREESTYLE_MID), CTX).quality === 'proposed');
ok('Freestyle with «لا تفضيل» recommends nothing at all',
  proposalView(b(FREESTYLE_NONE), CTX).counts.systemDecided === 0);
ok('…so the headline weakens instead of lying',
  proposalView(b(FREESTYLE_NONE), CTX).quality === 'all-open');
ok('…and it still has a proven path — it is open, not broken',
  b(FREESTYLE_NONE).provenPath !== null);
ok('the weaker headline does not say «المقترح لك»',
  !PROPOSAL.titleAllOpen.includes('المقترح'));
ok('…and it explains what would let the system rank',
  /فئة ميزانية/.test(PROPOSAL.leadAllOpen));

// ═══════════════════════════════════════════════════════════════════════════
section('10 — PART DATA A BEGINNER CAN READ');
// ═══════════════════════════════════════════════════════════════════════════
const byId: Record<string, unknown> = {};
for (const list of Object.values(PART_CATEGORY_MAP)) for (const p of list) byId[p.id] = p;

let factRows = 0;
for (const [, input] of BURDEN_CASES) {
  const build = b(input);
  for (const d of build.decisions) {
    const part = d.partId ? build.parts[d.category] : undefined;
    if (!part) continue;
    const facts = partFacts(d.category, part);
    factRows += facts.length;
    ok(`${d.category}: at most three facts, none empty`,
      facts.length <= 3 && facts.every(f => f.value.trim() !== '' && f.labelAr.trim() !== ''));
    ok(`${d.category}: no fact leaks a raw id or an undefined`,
      facts.every(f => !/undefined|null|^\s*-\s*$/.test(f.value) && !f.value.includes(part.id)));
  }
}
ok(`the fact rows are not vacuously empty (${factRows} rendered across the cases)`, factRows > 10);
/*
 * THE OLD ASSERTION COULD NOT SEE THE LEAK IT WAS FOR.
 *
 * It grepped for `part.id`. The actual leak was `c?.nameAr ?? id` — a fallback
 * whose variable happens to be called `id`, so the regex sailed past a line
 * that rendered a database key as a product name. Two more of the same shape
 * were live at the same time: `PROPOSAL.manual.labels[id] ?? id`, and the rule
 * identifier printed straight into the compatibility detail.
 *
 * Structural greps cannot be trusted for this. The replacements below inject a
 * broken world and assert on the OUTCOME.
 */
ok('no component uses an id as a display fallback',
  !/\?\?\s*id\b/.test(allCode) && !/\|\|\s*id\b/.test(allCode));
/*
 * As TEXT. `data-rule={e.ruleId}` is a machine hook and is fine — the id may
 * live in attributes, logs and tests. What it may not be is a sentence, so the
 * check rejects `{e.ruleId}` only where it is a JSX child rather than an
 * attribute value.
 */
ok('the raw rule id is never a text node',
  !/(^|[^=])\{e\.ruleId\}/m.test(allCode));
ok('…and the label is what gets rendered instead',
  /\{compatRuleLabelAr\(e\.ruleId\)\}/.test(src['ProposalCategoryCard.tsx']));
ok('no component renders the tier back at the reader', !/part\.tier|\.tier\}/.test(allCode));
ok('no component dumps the whole spec bag',
  !/Object\.(keys|entries)\(\s*(part|p)\.specs/.test(allCode));
ok('the English product name is bidi-isolated',
  /<bdi dir="ltr"/.test(src['ProposalCategoryCard.tsx']));

// ═══════════════════════════════════════════════════════════════════════════
section('11 — ACCESSIBILITY AT THE SOURCE');
// ═══════════════════════════════════════════════════════════════════════════
const cardCode = src['ProposalCategoryCard.tsx'];
ok('every disclosure is a real button with aria-expanded',
  /<button\s+type="button"/.test(cardCode) && /aria-expanded=\{open\}/.test(cardCode));
ok('…and points at the panel it controls', /aria-controls=\{panelId\}/.test(cardCode));
ok('no clickable div anywhere in the proposal',
  !/<div[^>]*onClick/.test(cardCode) && !/<div[^>]*onClick/.test(src['ProposalScreen.tsx']));
ok('disclosure targets clear 44px', /minHeight: 44/.test(cardCode));
ok('the heading hierarchy descends h2 → h3 → h4',
  /<h2 /.test(src['ProposalScreen.tsx']) && /<h3 /.test(src['ProposalScreen.tsx'])
  && /<h4 /.test(cardCode));
ok('status is carried by words, not colour alone',
  /StatusBadge/.test(cardCode) && /PROPOSAL\.recommendedBadge/.test(cardCode));
ok('every design token the proposal names exists', (() => {
  const globals = read('web/app/globals.css');
  const used = [...new Set(allCode.match(/var\(--[a-zA-Z0-9-]+/g) ?? [])].map(t => t.slice(4));
  return used.every(t => globals.includes(`${t}:`));
})());

// ═══════════════════════════════════════════════════════════════════════════
section('11b — A COMPAT RULE HAS A NAME, NOT A KEY');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * The disclosure printed `frame-size` — an English, kebab-cased database
 * identifier, to a reader who has never built a drone. The map is exhaustive
 * over `CompatRuleId`, so a fifth rule cannot reach this list without someone
 * writing the sentence that will be shown.
 */
ok('every CompatRuleId in the shared registry has a reader-facing label',
  SHARED_COMPAT_RULES.every(r => typeof COMPAT_RULE_LABEL_AR[r.id] === 'string'
    && COMPAT_RULE_LABEL_AR[r.id].trim() !== ''));
ok('…and no label is just the id in disguise',
  Object.entries(COMPAT_RULE_LABEL_AR).every(([id, label]) =>
    !label.includes(id) && !/[a-zA-Z-]{6,}/.test(label)));
ok('…and the label matches the registry\'s own Arabic, so the two cannot drift',
  SHARED_COMPAT_RULES.every(r => COMPAT_RULE_LABEL_AR[r.id] === r.whatAr));
ok('the map covers exactly the registry, no more and no less',
  Object.keys(COMPAT_RULE_LABEL_AR).length === SHARED_COMPAT_RULES.length);
ok('every label is Arabic prose', Object.values(COMPAT_RULE_LABEL_AR)
  .every(l => (l.match(/[\u0621-\u064A]+/g) ?? []).length >= 3));

/*
 * CASE A — a real recommended decision's evidence renders the LABEL, and the
 * identifier appears nowhere in the text a reader can read.
 */
const evidenceIds = recommended.compatibility.map(e => e.ruleId);
ok('the recommended decision really carries evidence to render', evidenceIds.length > 0);
ok('…every one of its rule ids has a label',
  evidenceIds.every(id => compatRuleLabelAr(id).trim() !== ''));
ok('…and «frame-size» is rendered as «الإطار مقابل حجم البناء المعلن»',
  compatRuleLabelAr('frame-size') === 'الإطار مقابل حجم البناء المعلن');

// ═══════════════════════════════════════════════════════════════════════════
section('11c — A BROKEN WORLD IS REFUSED, NOT PRINTED');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * Every id that used to have a display fallback now has an integrity check.
 * These inject the exact breakage each fallback existed to survive and assert
 * the proposal is withheld — the ids stay in machine state and never become a
 * product name, a safety instruction, or a rule description.
 */
const healthy = b(FREESTYLE_MID);
const kindsOf = (ds: readonly { kind: ProposalDefectKind }[]) => ds.map(d => d.kind);

ok('the healthy build has no defects at all',
  proposalDefects(healthy, CTX).length === 0);

// CASE C — a candidate id the catalogue cannot resolve.
const MISSING = 'probe-missing-part';
const withMissingCandidate = {
  ...healthy,
  decisions: healthy.decisions.map((d, i) => (i === 0
    ? { ...d, candidateIds: [...d.candidateIds, MISSING] } : d)),
} as ProposedBuild;
ok('an unresolvable candidate is a defect',
  kindsOf(proposalDefects(withMissingCandidate, CTX)).includes('unresolved-candidate'));
ok('…so the proposal is refused',
  proposalView(withMissingCandidate, CTX).consistencyError);
ok('…and the missing id is not in any copy the screen can print',
  !JSON.stringify(PROPOSAL).includes(MISSING));

// CASE D — the card's part and the decision's part disagree.
const decided = healthy.decisions.find(d => d.partId !== undefined)!;
const swapped = {
  ...healthy,
  parts: { ...healthy.parts, [decided.category]: CATALOGUE[
    Object.keys(CATALOGUE).find(id => id !== decided.partId)!] },
} as ProposedBuild;
ok('a card about to show a different part than the decision selected is a defect',
  kindsOf(proposalDefects(swapped, CTX)).includes('part-mismatch'));
ok('…so the proposal is refused', proposalView(swapped, CTX).consistencyError);

const droppedPart = { ...healthy, parts: {} } as ProposedBuild;
ok('a selected part missing from build.parts is caught too',
  kindsOf(proposalDefects(droppedPart, CTX)).includes('part-mismatch'));

const unknownPartId = {
  ...healthy,
  decisions: healthy.decisions.map(d => (d.partId ? { ...d, partId: MISSING } : d)),
  parts: Object.fromEntries(Object.entries(healthy.parts)
    .map(([c, p]) => [c, { ...p, id: MISSING }])),
} as ProposedBuild;
ok('a selected part the catalogue does not have is caught',
  kindsOf(proposalDefects(unknownPartId, CTX)).includes('unresolved-part'));

// CASE B — a manual check with no reader-facing description.
const UNLABELLED = 'probe-unknown-check';
const withUnknownCheck = { ...healthy, manualChecks: [UNLABELLED] } as ProposedBuild;
ok('a manual check with no label is a defect',
  kindsOf(proposalDefects(withUnknownCheck, CTX)).includes('unlabelled-manual-check'));
ok('…so the proposal is refused rather than printing the finding id',
  proposalView(withUnknownCheck, CTX).consistencyError);
ok('…and the refusal names the KIND, in Arabic, with no id in it',
  PROPOSAL.consistency.kinds['unlabelled-manual-check'].includes('فحص يدوي')
  && !PROPOSAL.consistency.kinds['unlabelled-manual-check'].includes(UNLABELLED));
ok('the screen has no `?? id` fallback left for manual checks',
  !/manual\.labels\[id\]\s*\?\?/.test(src['ProposalScreen.tsx']));

/*
 * MANUAL LABEL COMPLETENESS, NON-VACUOUSLY. At least one real manual check
 * from a real build must have been checked against the map — otherwise this
 * whole section could pass on a catalogue that emits none.
 */
const realChecks = [...new Set(BURDEN_CASES.flatMap(([, i]) => [...b(i).manualChecks]))];
ok(`every manual check real builds emit has a label (${realChecks.join(', ')})`,
  realChecks.length > 0 && realChecks.every(id => id in PROPOSAL.manual.labels));
ok('…and «current-headroom» is one of them, with its honest wording kept',
  realChecks.includes('current-headroom')
  && PROPOSAL.manual.labels['current-headroom'].includes('هامش التيار'));

/*
 * And the refusal itself must not leak. Every defect kind has Arabic wording,
 * and the ids ride on `data-*` hooks only.
 */
const DEFECT_KINDS: readonly ProposalDefectKind[] = [
  'unavailable-required', 'unknown-category', 'unlabelled-category',
  'unresolved-part', 'part-mismatch',
  'unresolved-candidate', 'foreign-category', 'unlabelled-manual-check',
];
ok('every defect kind has reader-facing Arabic',
  DEFECT_KINDS.every(k => (PROPOSAL.consistency.kinds[k] ?? '').trim() !== ''));
ok('no defect wording contains a Latin identifier',
  DEFECT_KINDS.every(k => !/[a-zA-Z]{4,}/.test(PROPOSAL.consistency.kinds[k])));
ok('the screen prints kinds, never the defect ids',
  /CONSISTENCY_KINDS\[k\]/.test(src['ProposalScreen.tsx'])
  && !/defects\.map\(d => d\.id/.test(src['ProposalScreen.tsx']));
/*
 * And the wording table is typed against the defect union, so a new kind
 * cannot ship without a sentence — the same guarantee `COMPAT_RULE_LABEL_AR`
 * gives for rules, one layer up.
 */
ok('the kind→Arabic table is typed by the defect union',
  /Record<ProposalDefectKind, string> = PROPOSAL\.consistency\.kinds/
    .test(src['ProposalScreen.tsx']));

// ═══════════════════════════════════════════════════════════════════════════
section('11d — A PART BELONGS TO A CATEGORY, NOT JUST TO THE CATALOGUE');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * The integrity check asked «does this id exist» and stopped there. That is a
 * weaker guarantee than it reads as, and both halves of it were exploitable:
 *
 *   · a frame's id in the receivers' candidate list resolved and rendered;
 *   · a `motors` decision selecting a frame passed every check and drew
 *     «إطار 5.1 إنش» under «المحركات» — with NO spec rows, because
 *     `partFacts('motors', frame)` finds no motor keys in a frame.
 *
 * Nothing failed. It showed the wrong product under the right heading, with
 * the right decision's reasons attached to it. Resolution is per-category now,
 * and a foreign part is its own diagnosis: «exists, wrong shelf» is not the
 * same bug as «does not exist».
 */
const FRAME_ID = PART_CATEGORY_MAP.frames[0].id;
const motorsDecision = healthy.decisions.find(d => d.category === 'motors')!;

ok('the fixture really is a frame from another category',
  BY_CATEGORY.frames[FRAME_ID] !== undefined
  && BY_CATEGORY.motors[FRAME_ID] === undefined
  && FRAME_ID in CATALOGUE);

// A foreign CANDIDATE.
const foreignCandidate = {
  ...healthy,
  decisions: healthy.decisions.map(d => (d.category === 'receivers'
    ? { ...d, candidateIds: [...d.candidateIds, FRAME_ID] } : d)),
} as ProposedBuild;
ok('a frame offered as a receiver candidate is a defect',
  kindsOf(proposalDefects(foreignCandidate, CTX)).includes('foreign-category'));
ok('…so the proposal is refused', proposalView(foreignCandidate, CTX).consistencyError);
ok('…and it is NOT reported as «missing» — it exists, on the wrong shelf',
  !kindsOf(proposalDefects(foreignCandidate, CTX)).includes('unresolved-candidate'));

// A foreign SELECTION.
const foreignSelection = {
  ...healthy,
  decisions: healthy.decisions.map(d => (d.category === 'motors'
    ? { ...d, partId: FRAME_ID } : d)),
  parts: { ...healthy.parts, motors: CATALOGUE[FRAME_ID] },
} as ProposedBuild;
ok('a frame selected as the motors decision is a defect',
  kindsOf(proposalDefects(foreignSelection, CTX)).includes('foreign-category'));
ok('…so the proposal is refused', proposalView(foreignSelection, CTX).consistencyError);
ok('…and the part/decision pair is otherwise self-consistent, so ONLY the '
  + 'category check could have caught it',
  !kindsOf(proposalDefects(foreignSelection, CTX)).includes('part-mismatch'));

/*
 * The silent half: a foreign part renders no facts at all, because the spec
 * keys of one category mean nothing in another. That is what «looked
 * plausible» meant — a card with a name and nothing under it.
 */
ok('a frame under «motors» would have produced an empty, plausible-looking card',
  partFacts('motors', CATALOGUE[FRAME_ID]).length === 0
  && partFacts('frames', CATALOGUE[FRAME_ID]).length > 0);

// And a genuinely absent id is still «missing», not «foreign».
const absent = {
  ...healthy,
  decisions: healthy.decisions.map((d, i) => (i === 0
    ? { ...d, candidateIds: [...d.candidateIds, 'probe-nowhere-at-all'] } : d)),
} as ProposedBuild;
ok('an id in no category at all is still reported as missing',
  kindsOf(proposalDefects(absent, CTX)).includes('unresolved-candidate')
  && !kindsOf(proposalDefects(absent, CTX)).includes('foreign-category'));

// Every real build still resolves cleanly, per category.
for (const [label, input] of BURDEN_CASES) {
  const build = b(input);
  ok(`${label}: every id resolves inside its own category`,
    build.decisions.every(d =>
      (d.partId === undefined || BY_CATEGORY[d.category]?.[d.partId] !== undefined)
      && d.candidateIds.every(id => BY_CATEGORY[d.category]?.[id] !== undefined)));
}

// The wiring: neither component may hold a flat, category-blind index again.
ok('the screen indexes the catalogue BY CATEGORY',
  /byCategory\[category\]\[p\.id\] = p/.test(src['ProposalScreen.tsx']));

/*
 * READ THE WHOLE EXPRESSION, NOT ITS FIRST CLAUSE.
 *
 * The first version of this assertion matched the category lookup as a prefix
 * — and a probe that appended `?? flatMap[id]` to the very same line sailed
 * through it, because the prefix was still there. A resolver with a fallback
 * is a category-blind resolver wearing a category-aware opening.
 */
const resolveLine = (src['ProposalScreen.tsx'].split('\n')
  .find(l => l.includes('resolvePart:')) ?? '');
ok('the resolver goes through the category',
  /catalogue\.byCategory\[category\]\?\.\[id\]/.test(resolveLine));
ok('…with NO fallback of any kind on that line', resolveLine !== '' && !resolveLine.includes('??'));

/*
 * And there is no flat part map to fall back TO. The catalogue's only
 * cross-category member is a Set of ids, used solely to tell «missing» from
 * «foreign» — a Set cannot hand anyone a part.
 */
ok('the catalogue exposes ids across categories, never parts',
  /allIds: ReadonlySet<string>/.test(src['ProposalScreen.tsx'])
  && !/Record<string, BasePart>;\n\s*allIds/.test(src['ProposalScreen.tsx']));
ok('no component builds a flat id→part index',
  !/byId\[p\.id\] = p/.test(allCode) && !/__flat/.test(allCode));

ok('the card receives exactly one shelf',
  /categoryParts=\{catalogue\.byCategory\[d\.category\] \?\? \{\}\}/
    .test(src['ProposalScreen.tsx']));
ok('…and the card resolves only within it',
  /categoryParts\[id\]/.test(src['ProposalCategoryCard.tsx'])
  && !/partsById/.test(src['ProposalCategoryCard.tsx']));
ok('«foreign-category» has reader-facing Arabic with no id in it',
  /فئة أخرى/.test(PROPOSAL.consistency.kinds['foreign-category'])
  && !/[a-zA-Z]{4,}/.test(PROPOSAL.consistency.kinds['foreign-category']));

// ═══════════════════════════════════════════════════════════════════════════
section('11e — THE SHELF ITSELF: AN UNKNOWN CATEGORY IS A DEFECT');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * 11d made every id question category-aware. It never asked whether the
 * CATEGORY was real.
 *
 * A decision naming `probe-category` with no part and no candidates trips
 * nothing: there is no partId to resolve, no candidate to place, no manual
 * check to label. The integrity pass returned `[]`, the proposal rendered as
 * healthy, and the card asked `partLabelAr('probe-category')` — whose contract
 * is `PART_VOCAB[c]?.ar ?? c`. So the heading of a card, in a product written
 * in Arabic for beginners, read «probe-category».
 *
 * Two questions now precede every id question: does the catalogue have this
 * shelf, and does this surface have an Arabic name for it. Either «no» refuses
 * the proposal, and the card is no longer capable of expressing the fallback.
 */
const UNKNOWN_CATEGORY = 'probe-category';

/* Exactly the decision the brief describes: nothing in it but the category. */
const unknownCategoryDecision = {
  category: UNKNOWN_CATEGORY,
  status: 'choice-required' as const,
  selectionSource: 'engine' as const,
  partId: undefined,
  candidateIds: [] as string[],
  compatibility: [],
  reasons: [],
};
const withUnknownCategory = {
  ...healthy,
  decisions: [...healthy.decisions, unknownCategoryDecision],
} as unknown as ProposedBuild;

ok('the fixture category really is absent from the catalogue AND the vocabulary',
  !(UNKNOWN_CATEGORY in PART_CATEGORY_MAP) && PART_VOCAB[UNKNOWN_CATEGORY] === undefined);
ok('an unknown category is a defect',
  kindsOf(proposalDefects(withUnknownCategory, CTX)).includes('unknown-category'));
ok('…so the proposal is refused', proposalView(withUnknownCategory, CTX).consistencyError);

/*
 * WHY ONLY THIS CHECK COULD HAVE CAUGHT IT — asserted, not asserted-about.
 *
 * Run the SAME build through a context whose only difference is that it
 * believes every category exists and is named. Every id check still runs.
 * Zero defects. That is the bug, preserved: this decision is invisible to
 * everything except a check on the category itself.
 */
const CATEGORY_BLIND: ProposalContext = { ...CTX, hasCategory: () => true, categoryLabel: () => 'س' };
ok('a context that does not question the category finds NOTHING wrong with it',
  proposalDefects(withUnknownCategory, CATEGORY_BLIND).length === 0);

/* And the diagnosis is the category, not a slandered id. */
ok('…and the real check reports the CATEGORY, not a missing or foreign part',
  kindsOf(proposalDefects(withUnknownCategory, CTX))
    .every(k => k === 'unknown-category'));
ok('the defect carries no id, because no id was at fault',
  proposalDefects(withUnknownCategory, CTX)
    .filter(d => d.kind === 'unknown-category')
    .every(d => d.id === null && d.category === UNKNOWN_CATEGORY));

/*
 * A SHELF THAT EXISTS BUT HAS NO ARABIC NAME is the second half, and a
 * likelier one: someone adds a category to the catalogue and the vocabulary
 * lags a commit behind. The catalogue answers yes, the label answers nothing.
 */
const NAMELESS = 'frames';
const NAMELESS_CTX: ProposalContext = {
  ...CTX,
  categoryLabel: category => (category === NAMELESS ? undefined : PART_VOCAB[category]?.ar),
};
ok('a real category with no Arabic name is a defect too',
  kindsOf(proposalDefects(healthy, NAMELESS_CTX)).includes('unlabelled-category'));
ok('…and it is NOT reported as unknown — the catalogue does have it',
  !kindsOf(proposalDefects(healthy, NAMELESS_CTX)).includes('unknown-category'));
ok('…so the proposal is refused', proposalView(healthy, NAMELESS_CTX).consistencyError);

/*
 * THE REFUSAL MUST NOT PRINT WHAT IT REFUSED. The screen renders the title,
 * the lead, and one sentence per KIND — the category string reaches `data-*`
 * and the console, never a sentence.
 */
const refusalText = [
  PROPOSAL.consistency.title,
  PROPOSAL.consistency.lead,
  ...[...new Set(kindsOf(proposalDefects(withUnknownCategory, CTX)))]
    .map(k => PROPOSAL.consistency.kinds[k]),
].join(' ');
ok('the visible refusal text does not contain «probe-category»',
  !refusalText.includes(UNKNOWN_CATEGORY));
ok('…nor any kebab-cased Latin identifier at all',
  !/[a-z]+-[a-z]+/i.test(refusalText));
ok('…and it does say, in Arabic, that a part CATEGORY is the problem',
  /فئة قطع/.test(PROPOSAL.consistency.kinds['unknown-category'])
  && /فئة قطع/.test(PROPOSAL.consistency.kinds['unlabelled-category']));
ok('the two new kinds are distinguishable to a reader',
  PROPOSAL.consistency.kinds['unknown-category']
    !== PROPOSAL.consistency.kinds['unlabelled-category']);

// ── The raw key must be unable to render ──────────────────────────────────
/*
 * `partLabelAr` still ends in `?? c` — deliberately, for the older surfaces
 * built on it. What changed is that the V2 card can no longer call it: the
 * heading arrives as a required `string` prop, resolved by the screen through
 * the strict map, for a category the pass above has already accepted.
 */
ok('the loose helper really would have printed the raw key',
  partLabelAr(UNKNOWN_CATEGORY) === UNKNOWN_CATEGORY);
ok('…while the strict lookup the screen uses answers «no name»',
  PART_VOCAB[UNKNOWN_CATEGORY]?.ar === undefined);
ok('the helper is left intact for the surfaces that still use it',
  partLabelAr('frames') === 'الإطار' && partLabelAr('motors') === 'المحركات');

ok('the CARD cannot reach the fallback helper at all',
  !/partLabelAr/.test(src['ProposalCategoryCard.tsx']));
ok('…it takes the heading as a required, non-optional prop',
  /categoryLabelAr: string;/.test(src['ProposalCategoryCard.tsx'])
  && !/categoryLabelAr\?:/.test(src['ProposalCategoryCard.tsx']));
ok('…and renders that prop as the heading',
  /<h4[^>]*>\s*\{categoryLabelAr\}\s*<\/h4>/.test(src['ProposalCategoryCard.tsx']));
ok('the SCREEN resolves the heading strictly, from the vocabulary',
  /categoryLabelAr=\{PART_VOCAB\[d\.category\]!\.ar\}/.test(src['ProposalScreen.tsx']));

/*
 * READ THE WHOLE EXPRESSION — the lesson 11d cost. A prefix match on the
 * strict lookup passes just as happily with `?? category` appended to it.
 */
const labelLine = (src['ProposalScreen.tsx'].split('\n')
  .find(l => l.includes('categoryLabel:')) ?? '');
ok('the integrity context asks the strict map',
  /PART_VOCAB\[category\]\?\.ar/.test(labelLine));
ok('…with NO fallback of any kind on that line',
  labelLine !== '' && !labelLine.includes('??') && !labelLine.includes('partLabelAr'));

// ── Positive controls: the real shelves still pass ────────────────────────
/*
 * A check that refuses everything is not integrity, it is an outage. Both of
 * the categories the reader meets first must pass BOTH halves and keep their
 * real Arabic names.
 */
for (const category of ['frames', 'motors'] as const) {
  const d = healthy.decisions.find(x => x.category === category);
  ok(`${category}: the real build has this decision`, d !== undefined);
  ok(`${category}: the catalogue has the shelf`, category in PART_CATEGORY_MAP);
  ok(`${category}: the vocabulary names it in Arabic`,
    (PART_VOCAB[category]?.ar ?? '').trim() !== ''
    && !/[a-zA-Z]/.test(PART_VOCAB[category].ar));
  ok(`${category}: it produces no defect of any kind`,
    proposalDefects(
      { ...healthy, decisions: [d!], manualChecks: [] } as ProposedBuild, CTX,
    ).length === 0);
  ok(`${category}: the heading the screen would pass is the Arabic name`,
    PART_VOCAB[category]!.ar === (category === 'frames' ? 'الإطار' : 'المحركات'));
}

/* And no real build, on any burden case, trips either new check. */
for (const [label, input] of BURDEN_CASES) {
  const ds = proposalDefects(b(input), CTX);
  ok(`${label}: every category is real and named`,
    !kindsOf(ds).includes('unknown-category') && !kindsOf(ds).includes('unlabelled-category'));
}

/*
 * COMPLETENESS, BOTH WAYS. Every shelf the catalogue has must be nameable, and
 * the vocabulary must not name shelves that do not exist — a stale entry is
 * how a category check starts passing for something the catalogue dropped.
 */
ok('every catalogue category has an Arabic name',
  Object.keys(PART_CATEGORY_MAP).every(c => (PART_VOCAB[c]?.ar ?? '').trim() !== ''));
ok('and the vocabulary names nothing the catalogue does not have',
  Object.keys(PART_VOCAB).every(c => c in PART_CATEGORY_MAP));

// ═══════════════════════════════════════════════════════════════════════════
section('11f — THE CARD, ACTUALLY RENDERED');
// ═══════════════════════════════════════════════════════════════════════════
/*
 * Everything above proves the MODEL refuses a bad category. This proves the
 * COMPONENT cannot print one even if it were handed one — by rendering it and
 * reading the heading, not by grepping for a function name.
 *
 * The grep («no `partLabelAr` in the card») catches the obvious restoration.
 * It does not catch a heading rebuilt from `decision.category` some other way,
 * and a source pattern is not a rendered string. So: render it.
 *
 * React comes from `web/`'s own copy, resolved the way `web/` resolves it. A
 * component using one React instance and a renderer using another share no
 * hook dispatcher, and the render throws — so this indirection is the test
 * working, not the test cheating.
 */
const webRequire = createRequire(join(process.cwd(), 'web/package.json'));
type Renderer = (el: unknown) => string;
const ReactRT = webRequire('react') as {
  createElement: (t: unknown, p: Record<string, unknown>) => unknown;
};
const renderToStaticMarkup = (webRequire('react-dom/server') as {
  renderToStaticMarkup: Renderer;
}).renderToStaticMarkup;

const renderCard = (
  category: string,
  categoryLabelAr: string,
  over: Record<string, unknown> = {},
  props: Record<string, unknown> = {},
) => {
  const html = renderToStaticMarkup(ReactRT.createElement(ProposalCategoryCard, {
    decision: {
      category,
      status: 'choice-required',
      selectionSource: 'engine',
      partId: undefined,
      candidateIds: [],
      compatibility: [],
      reasons: [],
      ...over,
    },
    parts: {},
    categoryParts: BY_CATEGORY[category] ?? {},
    categoryLabelAr,
    compact: false,
    expandCandidates: false,
    onChoose: () => {},
    onClearChoice: () => {},
    takeFocus: false,
    ...props,
  }));
  return {
    heading: (/<h4[^>]*>([\s\S]*?)<\/h4>/.exec(html)?.[1] ?? '').trim(),
    /* Visible text only — ids are allowed to live in `data-*`, and do. */
    text: html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    html,
  };
};

/*
 * THE RENDERED HALF OF «NOTHING IS FILTERED» — see section 4.
 *
 * The model hands the screen every surviving id; this proves every one of them
 * reaches a real button the reader can press. Together the two cover the claim
 * without either standing in for the other.
 */
const tieCard = renderCard(tied.category, PART_VOCAB[tied.category]!.ar,
  { status: tied.status, candidateIds: tied.candidateIds }, { expandCandidates: true });
ok(`every one of the ${tied.candidateIds.length} candidates renders a button`,
  tied.candidateIds.every(id =>
    tieCard.html.includes(`data-testid="v2-choose-${tied.category}-${id}"`)));
ok('…and the card offers no extra option beyond what the engine returned',
  (tieCard.html.match(/data-testid="v2-choose-/g) ?? []).length
    === tied.candidateIds.length);

/*
 * PHASE 2F — WHICH SETTLED CARDS OFFER A SWAP, AND WHICH MUST NOT.
 *
 * Rendered rather than grepped, because «no control on an owned part» is a
 * statement about what reaches the screen. Each case is the SAME decision
 * shape with one field changed, so the status is visibly what decides.
 */
const swapFixture = {
  partId: tied.candidateIds[0],
  candidateIds: tied.candidateIds,
  selectionSource: 'system',
};
const swapOf = (status: string, extra: Record<string, unknown> = {}) =>
  renderCard(tied.category, PART_VOCAB[tied.category]!.ar,
    { ...swapFixture, status, ...extra }).html;
ok('a recommended card with alternatives offers the swap control',
  swapOf('recommended').includes(`data-testid="v2-show-alternatives-${tied.category}"`));
for (const [status, why] of [
  ['only-compatible', 'exactly one viable option survived'],
  ['user-locked', 'the reader says they own it'],
  ['unavailable', 'there is nothing to swap to'],
] as const) {
  ok(`a ${status} card offers none — ${why}`,
    !swapOf(status, status === 'user-locked' ? { selectionSource: 'user-owned' } : {})
      .includes('v2-show-alternatives-'));
}
ok('a choice-required card still uses the candidate list, not the swap control',
  swapOf('choice-required', { partId: undefined, selectionSource: 'none' })
    .includes(`data-testid="v2-show-candidates-${tied.category}"`)
  && !swapOf('choice-required', { partId: undefined, selectionSource: 'none' })
    .includes('v2-show-alternatives-'));
/*
 * A RECOMMENDATION WITH NOTHING ELSE BEHIND IT SHOWS NO DEAD BUTTON.
 *
 * Not reachable from the live catalogue — every one of the 266 recommended
 * decisions across every reader carries at least one alternative — so it is
 * constructed. A control that opens an empty list is the failure this guards.
 */
ok('a recommended card whose only candidate is the recommendation offers no swap',
  !renderCard(tied.category, PART_VOCAB[tied.category]!.ar, {
    status: 'recommended', selectionSource: 'system',
    partId: tied.candidateIds[0], candidateIds: [tied.candidateIds[0]],
  }).html.includes('v2-show-alternatives-'));

const realCard = renderCard('frames', PART_VOCAB.frames.ar);
ok('a real category renders its Arabic name as the heading',
  realCard.heading === 'الإطار');

/*
 * THE ONE THAT MATTERS. The category is the unknown key; the label handed in
 * is a perfectly good Arabic name. If the heading came from the CATEGORY, it
 * would read «probe-category». It reads the label.
 */
const probeCard = renderCard(UNKNOWN_CATEGORY, PART_VOCAB.frames.ar);
ok('a card handed an unknown category still renders the LABEL it was given',
  probeCard.heading === 'الإطار');
ok('…and «probe-category» appears in no visible text on that card',
  !probeCard.text.includes(UNKNOWN_CATEGORY));
ok('…though it is still present as a machine hook, which is where it belongs',
  probeCard.html.includes(`data-testid="v2-cat-${UNKNOWN_CATEGORY}"`));
ok('…and no kebab-cased Latin identifier is visible on it either',
  !/[a-z]+-[a-z0-9]+/i.test(probeCard.text));

/* The heading follows the PROP, not the decision — shown by moving the prop. */
ok('the heading tracks the prop, not the category',
  renderCard('frames', 'المحركات').heading === 'المحركات');

// ═══════════════════════════════════════════════════════════════════════════
section('12 — SCOPE: NOTHING PHASE 2C WAS NOT ASKED FOR');
// ═══════════════════════════════════════════════════════════════════════════
for (const [pattern, what] of [
  [/localStorage|sessionStorage|indexedDB/i, 'persistence'],
  [/firebase|firestore|setDoc/i, 'Firebase'],
  [/mirrorToProject|saveProject|saveDraft/, 'a project write'],
  [/\bfetch\s*\(/, 'a network call'],
  [/addToCart|checkout|buyNow/i, 'store behaviour'],
  [/buildStages|wiring|betaflight/i, 'assembly or setup'],
] as const) {
  ok(`the proposal adds no ${what}`, !pattern.test(allCode));
}
ok('the summary still owns the readiness copy, unchanged',
  SUMMARY.status.ready.title === 'جاهزون لبناء اقتراح القطع');

console.log(`\n[build v2 proposal] ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(f => console.log(`  FAILED: ${f}`));
  process.exit(1);
}
