/**
 * THE V2 ENTRY JOURNEY, IN A REAL BROWSER
 * =======================================
 *
 * Phase 2B exists to answer one question: does BUILD V2 already feel
 * dramatically simpler before a single part is shown? That is not a question a
 * unit test can answer, so this walks the journey the way a reader does and
 * MEASURES it — how far they scroll, how many controls they meet, and above
 * all which questions they are never asked.
 *
 * The claim under test is the one that matters:
 *
 *   Freestyle   → one viable size, two viable voltages. Asked the voltage.
 *                 NEVER shown a size screen.
 *   Long-range  → one viable size AND one viable voltage. Asked NEITHER.
 *   Cinewhoop   → cannot be started at all.
 *
 * And the half that must not move: `/build` without the flag is still V1.
 *
 * Run: npx tsx --tsconfig web/tsconfig.json scripts/testBuildV2E2E.ts
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright';
import { chromiumLaunchOptions } from './lib/browser';
import { PART_VOCAB } from '../web/lib/build/labels';
import { proposeBuild } from '../src/data/assembly/recommendation/proposeBuild';
import type { RecommendationInput } from '../src/data/assembly/recommendation/types';

/**
 * THE ENGINE, RUN IN NODE, SO THE BROWSER CAN BE CHECKED AGAINST IT.
 *
 * Phase 2F's hardest claim is «after a swap, every other card shows the
 * RECOMPUTED answer». Asserting that from the DOM alone can only ever say «it
 * changed» or «it did not», neither of which is the claim. So the expected
 * build is computed here, from the same function the page calls, and the page
 * is compared to it field by field.
 */
const engine = (over: Record<string, unknown> = {}) => proposeBuild({
  droneTypeId: 'freestyle', cellCount: 6, budgetTier: 'mid', owned: {}, ...over,
} as unknown as RecommendationInput);

const PORT = 3181;
const BASE = `http://localhost:${PORT}`;
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
const SHOTS = 'artifacts/build-v2';

let passed = 0;
const failures: string[] = [];
function ok(label: string, condition: boolean) {
  if (condition) { passed++; console.log(`  ok — ${label}`); }
  else { failures.push(label); console.log(`  FAIL — ${label}`); }
}

const freePort = () =>
  spawnSync('bash', ['-c', `fuser -k ${PORT}/tcp 2>/dev/null || true`], { stdio: 'ignore' });

function buildSite() {
  console.log('\n[build] production build of web/ …');
  const res = spawnSync('npx', ['next', 'build'], {
    cwd: 'web', env: process.env, stdio: ['ignore', 'ignore', 'inherit'],
  });
  if (res.status !== 0) throw new Error('next build failed');
}

async function startServer(): Promise<ChildProcess> {
  freePort();
  const proc = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: 'web', env: process.env, stdio: ['ignore', 'pipe', 'pipe'], detached: true,
  });
  for (let i = 0; i < 60; i++) {
    if (proc.exitCode !== null) throw new Error(`next start exited ${proc.exitCode}`);
    try {
      const r = await fetch(`${BASE}/build`, { redirect: 'manual' });
      if (r.status > 0) return proc;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('server never came up');
}

const consoleErrors: string[] = [];
function watch(page: Page) {
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(String(e)));
}

/**
 * How much of THIS SCREEN a reader scrolls past, and how much they must touch.
 *
 * Measured on the journey's own container, not the document. The site's global
 * header and footer are on every page in the product, V1 included — counting
 * them made the entry screen read as «1.99 screens» when the actual question
 * fits comfortably in one. A number that blames a screen for the site's chrome
 * is a number that sends you optimising the wrong thing.
 */
async function measure(
  page: Page,
  label: string,
  selector = '[data-testid="build-v2-preview"]',
  assertClean = true,
) {
  const m = await page.evaluate(sel => {
    const el = document.querySelector(sel);
    const box = el?.getBoundingClientRect();
    return {
      contentPx: box ? Math.round(box.height) : 0,
      viewport: window.innerHeight,
      docScreens: document.documentElement.scrollHeight / window.innerHeight,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      controls: el ? el.querySelectorAll(
        'button:not([disabled]), a[href], input, select, [tabindex]:not([tabindex="-1"])').length : 0,
      dir: el ? getComputedStyle(el).direction : '',
      /*
       * Text WIDER than the box holding it — the Arabic clipping the audit
       * found on V1's long option labels. Measured per element rather than on
       * the document, because a single clipped card does not move the page's
       * own scroll width.
       *
       * `clientWidth <= 1` is skipped: that is the `.sr-only` pattern, text
       * deliberately collapsed to a pixel and read only by a screen reader.
       * The first version of this check flagged «لاحقًا في هذا المسار» on
       * every screen — a caption doing exactly its job.
       */
      clipped: el ? [...el.querySelectorAll('*')]
        .filter(n => n.clientWidth > 1
          && n.scrollWidth > n.clientWidth + 1
          && getComputedStyle(n).overflowX !== 'auto')
        .length : 0,
    };
  }, selector);
  console.log(`      ${label}: ${(m.contentPx / m.viewport).toFixed(2)} screens of content `
    + `(${m.contentPx}px) · ${m.controls} controls · page ${m.docScreens.toFixed(2)} screens `
    + `incl. site chrome · overflow ${m.overflow}px · dir ${m.dir}`);
  /*
   * The measurements are ASSERTIONS, not just a log — a screen that scrolls
   * sideways or clips its own Arabic has failed whatever else it does.
   *
   * The V1 baseline is measured with `assertClean` off. Not to protect it:
   * Phase 2B changed no V1 markup, so a failure there would be a pre-existing
   * product finding wearing this suite's name. Its numbers are still printed,
   * and anything they show belongs in the report as an observation.
   */
  if (assertClean) {
    ok(`${label}: no horizontal overflow`, m.overflow <= 0);
    ok(`${label}: no clipped text`, m.clipped === 0);
    ok(`${label}: reads right-to-left`, m.dir === 'rtl');
  }
  return m;
}

const preview = (path = '') => `${BASE}/build?buildV2=1${path}`;

async function openPreview(page: Page) {
  await page.goto(preview(), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="build-v2-preview"]', { timeout: 20000 });
}

async function startJourney(page: Page) {
  await openPreview(page);
  await page.click('[data-testid="v2-start"]');
  await page.waitForSelector('[data-testid="v2-question"]', { timeout: 10000 });
}

/**
 * Freestyle at 6S, mid budget, stopped ON the owned-gear question.
 *
 * Four of the readiness journeys below differ only in what is answered from
 * here, and re-typing the first four clicks each time is how a walkthrough
 * quietly starts testing a different build than it claims to.
 */
async function freestyle6S(page: Page) {
  await startJourney(page);
  await page.click('[data-testid="v2-goal-freestyle"]');
  await page.click('[data-testid="v2-next"]');
  await page.waitForTimeout(200);
  await page.click('[data-testid="v2-input-cellCount-6"]');
  await page.click('[data-testid="v2-next"]');
  await page.waitForTimeout(200);
  await page.click('[data-testid="v2-budget-mid"]');
  await page.click('[data-testid="v2-next"]');
  await page.waitForTimeout(200);
}

/**
 * Open the proposal from a READY summary and report what a reader meets.
 *
 * The measurement that matters here is not the full height — it is whether
 * the headline and the decision burden are in the FIRST viewport. A proposal
 * whose «حسمنا ٦ اختيارات» is below the fold is V1's step 10 again.
 */
async function openProposal(page: Page, label: string) {
  await page.click('[data-testid="v2-open-proposal"]');
  await page.waitForSelector('[data-testid="v2-proposal"]', { timeout: 15000 });
  const m = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="v2-proposal"]')!;
    const burden = document.querySelector('[data-testid="v2-proposal-burden"]')!;
    const box = el.getBoundingClientRect();
    const bBox = burden.getBoundingClientRect();
    return {
      fullPx: Math.round(box.height),
      viewport: window.innerHeight,
      burdenBottom: Math.round(bBox.bottom + window.scrollY),
      controls: el.querySelectorAll('button, a[href], input, select').length,
      cards: el.querySelectorAll('[data-testid^="v2-cat-"]').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      burdenText: burden.textContent ?? '',
      title: document.querySelector('[data-testid="v2-proposal-title"]')?.textContent ?? '',
    };
  });
  console.log(`      proposal (${label}): ${(m.fullPx / m.viewport).toFixed(2)} screens full `
    + `· ${m.cards} categories · ${m.controls} controls · burden ends at ${m.burdenBottom}px `
    + `(viewport ${m.viewport}) · overflow ${m.overflow}px`);
  console.log(`         «${m.title}» — ${m.burdenText}`);
  return m;
}

/** The question currently on screen, by its heading. */
const questionTitle = (page: Page) =>
  page.locator('[data-testid="v2-question-title"]').first().textContent();

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  buildSite();
  const server = await startServer();
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch(chromiumLaunchOptions());

    for (const [name, viewport] of [['390px', PHONE], ['1280px', DESKTOP]] as const) {
      console.log(`\n════════ ${name} ════════`);
      const ctx = await browser.newContext({ viewport, locale: 'ar' });
      const page = await ctx.newPage();
      watch(page);

      // ── E. V1 IS UNTOUCHED ────────────────────────────────────────────────
      console.log(`\n[E] ${name} — /build without the flag is still V1`);
      await page.goto(`${BASE}/build`, { waitUntil: 'domcontentloaded' });
      ok(`${name}: no preview on the normal /build`,
        await page.locator('[data-testid="build-v2-preview"]').count() === 0);
      ok(`${name}: V1's three doors are there`,
        await page.locator('a[href^="/build/wizard"]').count() >= 3);
      ok(`${name}: V1's own links are there`,
        await page.locator('[data-testid^="build-link-"]').count() > 0);
      // The comparison that gives every V2 number below its meaning.
      await page.goto(`${BASE}/build`, { waitUntil: 'domcontentloaded' });
      // `#main` is the layout's content region — the site header and footer
      // each carry their own `.shell`, so that class alone would have
      // measured the header.
      await measure(page, 'V1 /build landing (baseline)', '#main', false);
      for (const flag of ['?buildV2=0', '?buildV2', '?buildV2=true', '?buildv2=1']) {
        await page.goto(`${BASE}/build${flag}`, { waitUntil: 'domcontentloaded' });
        ok(`${name}: «${flag}» does NOT open the preview`,
          await page.locator('[data-testid="build-v2-preview"]').count() === 0);
      }

      // ── ENTRY ─────────────────────────────────────────────────────────────
      console.log(`\n[0] ${name} — the entry screen`);
      await openPreview(page);
      ok(`${name}: the preview says it is a preview`,
        await page.locator('[data-testid="v2-preview-notice"]').count() === 1);
      ok(`${name}: three human phases are named`,
        await page.locator('[data-testid^="v2-phase-"]').count() === 3);
      ok(`${name}: the parts phase is the active one`,
        await page.locator('[data-testid="v2-phase-parts"]').getAttribute('data-active') === 'true');
      ok(`${name}: the later phases claim no progress`,
        await page.locator('[data-testid="v2-phase-assembly"]').getAttribute('data-active') === 'false'
        && await page.locator('[data-testid="v2-phase-setup"]').getAttribute('data-active') === 'false');
      const bodyText = (await page.locator('[data-testid="build-v2-preview"]').textContent()) ?? '';
      ok(`${name}: no «الخطوة N من M» anywhere`, !/الخطوة\s*\d+\s*من\s*\d+/.test(bodyText));
      await measure(page, 'entry');
      if (name === '390px') await page.screenshot({ path: `${SHOTS}/01-entry-390.png`, fullPage: true });

      // ── D. CINEWHOOP CANNOT START ─────────────────────────────────────────
      console.log(`\n[D] ${name} — an unavailable type cannot start a journey`);
      await startJourney(page);
      ok(`${name}: the first question is the goal`,
        (await questionTitle(page))?.includes('ماذا تريد أن تبني') === true);
      for (const t of ['cinewhoop', 'racing']) {
        ok(`${name}: «${t}» is visible but disabled`,
          await page.locator(`[data-testid="v2-goal-${t}"]`).isDisabled());
      }
      for (const t of ['freestyle', 'cinematic', 'long-range']) {
        ok(`${name}: «${t}» is selectable`,
          !await page.locator(`[data-testid="v2-goal-${t}"]`).isDisabled());
      }
      ok(`${name}: «التالي» is blocked before a goal is chosen`,
        await page.locator('[data-testid="v2-next"]').isDisabled());
      ok(`${name}: …and the reason is on screen`,
        await page.locator('[data-testid="v2-blocked-reason"]').count() === 1);
      await measure(page, 'goal question');
      if (name === '390px') await page.screenshot({ path: `${SHOTS}/02-goal-390.png`, fullPage: true });

      // ── A. FREESTYLE ──────────────────────────────────────────────────────
      console.log(`\n[A] ${name} — Freestyle: asked the voltage, never the size`);
      const tA = Date.now();
      await page.click('[data-testid="v2-goal-freestyle"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      const freestyleMs = Date.now() - tA;
      ok(`${name}: the next question is the voltage`,
        (await questionTitle(page))?.includes('جهد بطارية') === true);
      ok(`${name}: the SIZE was never asked`,
        await page.locator('[data-testid^="v2-input-sizeInch"]').count() === 0);
      ok(`${name}: both viable voltages are offered`,
        await page.locator('[data-testid="v2-input-cellCount-4"]').count() === 1
        && await page.locator('[data-testid="v2-input-cellCount-6"]').count() === 1);
      console.log(`      goal → voltage question: ${freestyleMs}ms`);
      await measure(page, 'voltage question');
      if (name === '390px') await page.screenshot({ path: `${SHOTS}/03-voltage-390.png`, fullPage: true });

      await page.click('[data-testid="v2-input-cellCount-6"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      ok(`${name}: then the budget`, (await questionTitle(page))?.includes('الميزانية') === true);
      ok(`${name}: «الفئة الأعلى» does not claim price is no object`,
        ((await page.locator('[data-testid="v2-budget-premium"]').textContent()) ?? '')
          .includes('السعر ليس الأولوية') === false);
      ok(`${name}: «لا تفضيل» is offered`,
        await page.locator('[data-testid="v2-budget-none"]').count() === 1);
      await measure(page, 'budget question');

      await page.click('[data-testid="v2-budget-none"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      ok(`${name}: then the owned gear`, (await questionTitle(page))?.includes('معدات') === true);
      await page.click('[data-testid="v2-owned-none"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(200);

      ok(`${name}: the summary is reached`,
        await page.locator('[data-testid="v2-summary"]').count() === 1);
      ok(`${name}: the size is shown as DERIVED`,
        await page.locator('[data-testid="v2-summary-sizeInch"]').getAttribute('data-provenance') === 'derived');
      ok(`${name}: the voltage is shown as CHOSEN`,
        await page.locator('[data-testid="v2-summary-cellCount"]').getAttribute('data-provenance') === 'chosen');
      ok(`${name}: «لا تفضيل» left no budget row`,
        await page.locator('[data-testid="v2-summary-budgetTier"]').count() === 0);
      ok(`${name}: no part recommendation is rendered`,
        await page.locator('[data-testid^="part-card-"]').count() === 0);
      ok(`${name}: the next phase is named, not shown`,
        await page.locator('[data-testid="v2-summary-next"]').count() === 1);
      ok(`${name}: a viable build with nothing owned reports READY`,
        await page.locator('[data-testid="v2-summary-next"]').getAttribute('data-state') === 'ready');
      ok(`${name}: …and says so in Arabic`,
        ((await page.locator('[data-testid="v2-summary-next"]').textContent()) ?? '')
          .includes('جاهزون لبناء اقتراح القطع'));
      await measure(page, 'summary');
      if (name === '390px') await page.screenshot({ path: `${SHOTS}/04-summary-390.png`, fullPage: true });

      // Back must not lose answers.
      await page.click('[data-testid="v2-back"]');
      await page.waitForTimeout(150);
      ok(`${name}: back from the summary returns to a question`,
        await page.locator('[data-testid="v2-question"]').count() >= 1);
      await page.click('[data-testid="v2-back"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-back"]');
      await page.waitForTimeout(150);
      ok(`${name}: going back to the voltage keeps the answer selected`,
        await page.locator('[data-testid="v2-input-cellCount-6"]').getAttribute('data-selected') === 'true');

      // ── B. LONG-RANGE ─────────────────────────────────────────────────────
      console.log(`\n[B] ${name} — Long-range: asked neither size nor voltage`);
      await startJourney(page);
      const tB = Date.now();
      await page.click('[data-testid="v2-goal-long-range"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      const longRangeMs = Date.now() - tB;
      ok(`${name}: no size question`, await page.locator('[data-testid^="v2-input-sizeInch"]').count() === 0);
      ok(`${name}: no voltage question`, await page.locator('[data-testid^="v2-input-cellCount"]').count() === 0);
      ok(`${name}: it goes straight to the budget`,
        (await questionTitle(page))?.includes('الميزانية') === true);
      console.log(`      goal → next question: ${longRangeMs}ms`);
      await page.click('[data-testid="v2-budget-mid"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-owned-none"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(200);
      ok(`${name}: the summary shows BOTH as derived`,
        await page.locator('[data-testid="v2-summary-sizeInch"]').getAttribute('data-provenance') === 'derived'
        && await page.locator('[data-testid="v2-summary-cellCount"]').getAttribute('data-provenance') === 'derived');
      if (name === '390px') await page.screenshot({ path: `${SHOTS}/05-longrange-summary-390.png`, fullPage: true });

      // ── C. OWNED EQUIPMENT ────────────────────────────────────────────────
      console.log(`\n[C] ${name} — owned radio and goggles`);
      await startJourney(page);
      await page.click('[data-testid="v2-goal-freestyle"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-input-cellCount-6"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-budget-mid"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      ok(`${name}: the owned question offers no ecosystem list yet`,
        await page.locator('[data-testid^="v2-owned-rc-"]').count() === 0
        && await page.locator('[data-testid^="v2-owned-video-"]').count() === 0);
      await measure(page, 'owned gear — which');
      await page.click('[data-testid="v2-owned-both"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);

      // «لدي الاثنان» opens TWO screens, never one screen with two decisions.
      ok(`${name}: the radio ecosystem is its own screen`,
        (await questionTitle(page))?.includes('جهاز التحكم') === true);
      ok(`${name}: the goggle question is not on the radio screen`,
        await page.locator('[data-testid^="v2-owned-video-"]').count() === 0);
      const rcOptions = await page.locator('[data-testid^="v2-owned-rc-"]').allTextContents();
      ok(`${name}: ExpressLRS is offered`, rcOptions.some(t => t.includes('ExpressLRS')));
      ok(`${name}: Crossfire is offered`, rcOptions.some(t => t.includes('Crossfire')));
      ok(`${name}: «CRSF» is NOT a radio system option`,
        !rcOptions.some(t => /\bCRSF\b/.test(t)));
      ok(`${name}: «Diversity» is NOT a radio system option`,
        !rcOptions.some(t => t.includes('Diversity')));

      /*
       * SILENCE IS NOT AN ANSWER.
       *
       * This screen used to open with «لست متأكدًا» already selected, because
       * selection was «the system field is empty». A reader who pressed
       * «التالي» without touching anything was recorded as having chosen it.
       */
      const rcSelected = await page.locator(
        '[data-testid^="v2-owned-rc-"][data-selected="true"]').count();
      ok(`${name}: the radio screen opens with NOTHING selected`, rcSelected === 0);
      ok(`${name}: …and «التالي» is blocked until the reader answers`,
        await page.locator('[data-testid="v2-next"]').isDisabled());
      ok(`${name}: …with a reason that names «لست متأكدًا» as a way out`,
        ((await page.locator('[data-testid="v2-blocked-reason"]').textContent()) ?? '')
          .includes('لست متأكدًا'));
      await measure(page, 'owned gear — radio');
      if (name === '390px') await page.screenshot({ path: `${SHOTS}/06-owned-rc-390.png`, fullPage: true });

      // The accessibility relationship, proven in the DOM rather than grepped:
      // the id the button points at must exist and hold the visible sentence.
      const described = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="v2-next"]')!;
        const id = btn.getAttribute('aria-describedby');
        const target = id ? document.getElementById(id) : null;
        return {
          id,
          targetExists: !!target,
          targetText: target?.textContent ?? '',
          visibleText: document.querySelector(
            '[data-testid="v2-blocked-reason"]')?.textContent ?? '',
        };
      });
      ok(`${name}: the blocked «التالي» names a describedby id`, !!described.id);
      ok(`${name}: …that id resolves to a real element`, described.targetExists);
      ok(`${name}: …holding the same sentence the reader can see`,
        described.targetText.length > 0 && described.targetText === described.visibleText);

      // An explicit «لست متأكدًا» IS an answer: it selects, and it unblocks.
      await page.click('[data-testid="v2-owned-rc-unsure"]');
      await page.waitForTimeout(120);
      ok(`${name}: clicking «لست متأكدًا» selects it`,
        await page.locator('[data-testid="v2-owned-rc-unsure"]')
          .getAttribute('data-selected') === 'true');
      ok(`${name}: …and «التالي» is now enabled`,
        await page.locator('[data-testid="v2-next"]').isEnabled());
      ok(`${name}: …and no blocker reason is shown any more`,
        await page.locator('[data-testid="v2-blocked-reason"]').count() === 0);
      if (name === '390px') {
        await page.screenshot({ path: `${SHOTS}/07-owned-rc-unsure-390.png`, fullPage: true });
      }

      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);

      ok(`${name}: the goggle ecosystem is its own screen`,
        (await questionTitle(page))?.includes('نظارتك') === true);
      ok(`${name}: the radio question is not on the goggle screen`,
        await page.locator('[data-testid^="v2-owned-rc-"]').count() === 0);
      const videoOptions = await page.locator('[data-testid^="v2-owned-video-"]').allTextContents();
      ok(`${name}: DJI is offered as a goggle system`, videoOptions.some(t => t.includes('DJI')));
      ok(`${name}: the goggle screen also opens with NOTHING selected`,
        await page.locator('[data-testid^="v2-owned-video-"][data-selected="true"]').count() === 0);
      ok(`${name}: …and blocks «التالي» the same way`,
        await page.locator('[data-testid="v2-next"]').isDisabled());
      await measure(page, 'owned gear — goggles');
      if (name === '390px') await page.screenshot({ path: `${SHOTS}/06-owned-video-390.png`, fullPage: true });

      // Back must return the explicit unsure answer, not reset it.
      await page.click('[data-testid="v2-back"]');
      await page.waitForTimeout(150);
      ok(`${name}: going back finds the explicit «لست متأكدًا» still selected`,
        await page.locator('[data-testid="v2-owned-rc-unsure"]')
          .getAttribute('data-selected') === 'true');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);

      await page.click('[data-testid="v2-owned-video-DJI"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(200);

      /*
       * THE SUMMARY MUST NOT LOSE A QUESTION IT PUT.
       *
       * «I own a radio, but I'm not sure which system» used to vanish from
       * «هذا ما فهمناه» entirely — the row rendered only for a truthy system
       * name — so the trust screen implied the reader was never asked.
       */
      ok(`${name}: the explicit «لست متأكدًا» reaches the summary`,
        ((await page.locator('[data-testid="v2-summary-rcSystem"]').textContent()) ?? '')
          .includes('لست متأكدًا'));
      ok(`${name}: …and is badged as the reader's own answer`,
        await page.locator('[data-testid="v2-summary-rcSystem"]')
          .getAttribute('data-provenance') === 'chosen');

      /*
       * AN UNIDENTIFIED RADIO IS NOT READINESS.
       *
       * This journey answered «لست متأكدًا» for the radio and «DJI» for the
       * goggles, so exactly one item is outstanding — and the screen must not
       * tell the reader we are ready to propose every part as though their
       * radio were irrelevant.
       */
      const statusC = page.locator('[data-testid="v2-summary-next"]');
      ok(`${name}: an unsure radio reports «needs identification», not ready`,
        await statusC.getAttribute('data-state') === 'needs-equipment-identification');
      ok(`${name}: …the ready claim is ABSENT`,
        !((await statusC.textContent()) ?? '').includes('جاهزون لبناء اقتراح القطع'));
      ok(`${name}: …the radio is named as what must be identified`,
        await page.locator('[data-testid="v2-summary-unresolved-rc"]').count() === 1
        && ((await page.locator('[data-testid="v2-summary-unresolved-rc"]').textContent()) ?? '')
          .includes('المستقبل'));
      ok(`${name}: …and the identified goggles are NOT listed as unresolved`,
        await page.locator('[data-testid="v2-summary-unresolved-video"]').count() === 0);
      if (name === '390px') {
        await page.screenshot({ path: `${SHOTS}/10-summary-needs-rc-390.png`, fullPage: true });
      }
      if (name === '390px') {
        await page.screenshot({ path: `${SHOTS}/08-summary-unsure-390.png`, fullPage: true });
      }
      ok(`${name}: the summary records the owned goggles`,
        ((await page.locator('[data-testid="v2-summary-videoSystem"]').textContent()) ?? '')
          .includes('DJI'));

      /*
       * And the other direction: a KNOWN system must still be recorded, and
       * «سأبدأ من الصفر» must invent no equipment rows at all.
       */
      await startJourney(page);
      await page.click('[data-testid="v2-goal-freestyle"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-input-cellCount-6"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-budget-mid"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-owned-radio"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-owned-rc-ExpressLRS"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(200);
      ok(`${name}: a known radio system reaches the summary by name`,
        ((await page.locator('[data-testid="v2-summary-rcSystem"]').textContent()) ?? '')
          .includes('ExpressLRS'));
      ok(`${name}: owning only a radio invents no goggle row`,
        await page.locator('[data-testid="v2-summary-videoSystem"]').count() === 0);

      await startJourney(page);
      await page.click('[data-testid="v2-goal-long-range"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-budget-none"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-owned-none"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(200);
      ok(`${name}: «سأبدأ من الصفر» invents no equipment rows`,
        await page.locator('[data-testid="v2-summary-rcSystem"]').count() === 0
        && await page.locator('[data-testid="v2-summary-videoSystem"]').count() === 0);
      ok(`${name}: …and «سأبدأ من الصفر» is READY, nothing outstanding`,
        await page.locator('[data-testid="v2-summary-next"]').getAttribute('data-state') === 'ready');

      // ── D. BOTH ECOSYSTEMS UNSURE ─────────────────────────────────────────
      console.log(`\n[D2] ${name} — both owned systems explicitly unidentified`);
      await freestyle6S(page);
      await page.click('[data-testid="v2-owned-both"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-owned-rc-unsure"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-owned-video-unsure"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(250);
      const statusD = page.locator('[data-testid="v2-summary-next"]');
      ok(`${name}: two unsure systems still report «needs identification»`,
        await statusD.getAttribute('data-state') === 'needs-equipment-identification');
      ok(`${name}: …and BOTH unresolved items are shown`,
        await page.locator('[data-testid="v2-summary-unresolved-rc"]').count() === 1
        && await page.locator('[data-testid="v2-summary-unresolved-video"]').count() === 1);
      ok(`${name}: …with no full-ready claim anywhere`,
        !((await statusD.textContent()) ?? '').includes('جاهزون لبناء اقتراح القطع'));
      ok(`${name}: …and both rows survive in the summary as «لست متأكدًا»`,
        ((await page.locator('[data-testid="v2-summary-rcSystem"]').textContent()) ?? '')
          .includes('لست متأكدًا')
        && ((await page.locator('[data-testid="v2-summary-videoSystem"]').textContent()) ?? '')
          .includes('لست متأكدًا'));
      await measure(page, 'summary — needs identification');

      // ── E. A KNOWN SYSTEM THE CATALOGUE CANNOT SATISFY ────────────────────
      /*
       * Crossfire on a Freestyle 6S build: the engine finds NO blocker-free
       * complete assignment, so `provenPath` is null. The summary must say so
       * rather than promise a proposal it cannot make — and the «why» has to
       * be the engine's sentence, framed as the current catalogue rather than
       * as the technology being impossible.
       */
      console.log(`\n[E2] ${name} — a known system with no viable build`);
      await freestyle6S(page);
      await page.click('[data-testid="v2-owned-radio"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-owned-rc-Crossfire"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(300);
      const statusE = page.locator('[data-testid="v2-summary-next"]');
      const blockedText = (await statusE.textContent()) ?? '';
      ok(`${name}: no proven path reports BLOCKED`,
        await statusE.getAttribute('data-state') === 'no-viable-build');
      ok(`${name}: …the ready claim is ABSENT`,
        !blockedText.includes('جاهزون لبناء اقتراح القطع'));
      ok(`${name}: …the reader is told plainly what happened`,
        blockedText.includes('لا نستطيع تكوين اقتراح كامل ومتوافق'));
      ok(`${name}: …a domain-derived reason is visible`,
        await page.locator('[data-testid="v2-summary-blocked-reasons"] li').count() >= 1);
      ok(`${name}: …framed as the CURRENT catalogue, not an impossibility`,
        blockedText.includes('الكتالوج الحالي'));
      ok(`${name}: …and their own answer is still on the screen to change`,
        ((await page.locator('[data-testid="v2-summary-rcSystem"]').textContent()) ?? '')
          .includes('Crossfire'));
      ok(`${name}: …still no part is rendered`,
        await page.locator('[data-testid^="part-card-"]').count() === 0);
      await measure(page, 'summary — blocked');
      if (name === '390px') {
        await page.screenshot({ path: `${SHOTS}/11-summary-blocked-390.png`, fullPage: true });
      }

      // ── F. A KNOWN SYSTEM THE CATALOGUE CAN SATISFY ───────────────────────
      console.log(`\n[F2] ${name} — a known, supported system is still READY`);
      await freestyle6S(page);
      await page.click('[data-testid="v2-owned-goggles"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-owned-video-DJI"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(250);
      ok(`${name}: a known supported system reaches READY`,
        await page.locator('[data-testid="v2-summary-next"]').getAttribute('data-state') === 'ready');
      ok(`${name}: …and says so`,
        ((await page.locator('[data-testid="v2-summary-next"]').textContent()) ?? '')
          .includes('جاهزون لبناء اقتراح القطع'));

      // ── Changing the goal re-evaluates honestly ───────────────────────────
      console.log(`\n[F] ${name} — changing the goal re-asks what depends on it`);
      await startJourney(page);
      await page.click('[data-testid="v2-goal-freestyle"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-input-cellCount-4"]');
      await page.click('[data-testid="v2-back"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-goal-long-range"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(200);
      ok(`${name}: the freestyle voltage answer did not follow to long-range`,
        await page.locator('[data-testid^="v2-input-cellCount"]').count() === 0);
      ok(`${name}: …and the journey moved on to the budget`,
        (await questionTitle(page))?.includes('الميزانية') === true);

      // ══ PHASE 2C — THE PROPOSAL ═══════════════════════════════════════════
      console.log(`\n[P-A] ${name} — Freestyle 6S · متوازن · لا معدات → proposal`);
      await freestyle6S(page);
      await page.click('[data-testid="v2-owned-none"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(250);
      ok(`${name}: a ready summary offers the proposal`,
        await page.locator('[data-testid="v2-open-proposal"]').count() === 1);
      const pa = await openProposal(page, 'freestyle mid');

      ok(`${name}: the headline claims a proposal`,
        pa.title.includes('هذا البناء المقترح لك'));
      ok(`${name}: the burden is stated in real Arabic counts`,
        /حسمنا .+ اختيار/.test(pa.burdenText) && /نحتاج رأيك/.test(pa.burdenText));
      ok(`${name}: …and no Western digits leaked into it`, !/[0-9]/.test(pa.burdenText));
      ok(`${name}: the burden line is inside the first viewport`,
        pa.burdenBottom <= pa.viewport);
      ok(`${name}: every required category has a card`, pa.cards === 8);
      ok(`${name}: no horizontal overflow`, pa.overflow <= 0);

      // The decisions that need the reader come first and are already open.
      const groups = await page.locator('[data-testid^="v2-group-"]')
        .evaluateAll(ns => ns.map(n => n.getAttribute('data-testid')));
      ok(`${name}: «نحتاج اختيارك» is the first group`, groups[0] === 'v2-group-needs-you');
      ok(`${name}: the settled group follows it`, groups[1] === 'v2-group-system-decided');
      ok(`${name}: no «قطعك» group — Phase 2B enters no owned parts`,
        !groups.includes('v2-group-yours'));
      ok(`${name}: no «تعذّر» group in a proven build`, !groups.includes('v2-group-problem'));

      const recCards = page.locator('[data-testid^="v2-cat-"][data-status="recommended"]');
      ok(`${name}: recommended cards exist`, await recCards.count() > 0);
      const recText = (await recCards.first().textContent()) ?? '';
      ok(`${name}: a recommended card says «اقترحناه لك»`, recText.includes('اقترحناه لك'));
      ok(`${name}: …and never «الأفضل»`, !recText.includes('الأفضل'));

      const choiceCards = page.locator('[data-testid^="v2-cat-"][data-status="choice-required"]');
      ok(`${name}: the tied categories are there`, await choiceCards.count() === 2);
      const anySelected = await page.locator('[data-testid^="v2-candidate-"][data-selected="true"]')
        .count();
      ok(`${name}: NO candidate is preselected — a tie is shown as a tie`, anySelected === 0);
      const candCount = await page.locator('[data-testid^="v2-candidate-"]').count();
      ok(`${name}: candidates are listed for the reader to see`, candCount >= 2);
      /*
       * A SHORT list under a light load opens by itself; a long one waits to
       * be asked. Freestyle-mid has two open decisions — propellers (4) and
       * video units (7) — so exactly one of them should be open on arrival.
       */
      ok(`${name}: the long candidate list is collapsed behind a named button`,
        await page.locator('[data-testid="v2-show-candidates-videoUnits"]').count() === 1);
      ok(`${name}: …whose label carries the count in Arabic digits`,
        /[٠-٩]/.test((await page.locator('[data-testid="v2-show-candidates-videoUnits"]')
          .textContent()) ?? ''));
      ok(`${name}: the short list is open without being asked`,
        await page.locator('[data-testid="v2-show-candidates-propellers"]').count() === 0
        && await page.locator('[data-testid="v2-candidates-propellers"]').count() === 1);
      ok(`${name}: …and the list tells the reader what to do with it`,
        ((await choiceCards.first().textContent()) ?? '').includes('اختر قطعة واحدة لهذه الفئة'));

      ok(`${name}: the manual check is announced`,
        await page.locator('[data-testid="v2-proposal-manual"]').count() === 1);
      ok(`${name}: …and nothing claims full compatibility`,
        !((await page.locator('[data-testid="v2-proposal"]').textContent()) ?? '')
          .includes('متوافق بالكامل'));
      ok(`${name}: no raw part id is on screen`,
        !/[a-z]+-[a-z0-9]+-(budget|mid|premium)\b/.test(
          (await page.locator('[data-testid="v2-proposal"]').textContent()) ?? ''));

      // Progressive disclosure: settled categories are collapsed until asked.
      const firstMore = page.locator('[data-testid^="v2-more-"]').first();
      ok(`${name}: a settled category starts collapsed`,
        await firstMore.getAttribute('aria-expanded') === 'false');
      await firstMore.click();
      await page.waitForTimeout(120);
      ok(`${name}: …and opens on a real button`,
        await firstMore.getAttribute('aria-expanded') === 'true');
      const expanded = await page.evaluate(() => Math.round(
        document.querySelector('[data-testid="v2-proposal"]')!.getBoundingClientRect().height));
      console.log(`      proposal expanded by one card: ${expanded}px (was ${pa.fullPx}px)`);
      ok(`${name}: expanding actually reveals content`, expanded > pa.fullPx);

      /*
       * COMPATIBILITY DETAIL: THE RULE'S NAME, NOT ITS KEY.
       *
       * This disclosure rendered `frame-size` — English, kebab-cased, a
       * database identifier — to a reader who has never built a drone. The
       * check opens a real recommended card's detail and reads what is on the
       * screen: the Arabic description present, the identifier absent from the
       * text but still on the element as a machine hook.
       */
      const compatCategory = (await firstMore.getAttribute('data-testid'))!
        .replace('v2-more-', '');
      const compatBtn = page.locator(`[data-testid="v2-compat-more-${compatCategory}"]`);
      await compatBtn.click();
      await page.waitForTimeout(150);
      const ruleRows = page.locator(`[data-testid="v2-cat-${compatCategory}"] li[data-rule]`);
      ok(`${name}: the compatibility detail lists the rules that ran`,
        await ruleRows.count() >= 1);
      const ruleText = (await ruleRows.first().textContent()) ?? '';
      const ruleId = (await ruleRows.first().getAttribute('data-rule')) ?? '';
      ok(`${name}: …the row is Arabic prose`,
        (ruleText.match(/[\u0621-\u064A]+/g) ?? []).length >= 3);
      ok(`${name}: …and carries the verdict`, /سليم|مخالف|غير مؤكد/.test(ruleText));
      ok(`${name}: …the raw rule id is NOT in the visible text (${ruleId})`,
        ruleId !== '' && !ruleText.includes(ruleId));
      ok(`${name}: …the id is still on the element for machines`,
        /^[a-z-]+$/.test(ruleId));
      if (name === '390px') {
        /*
         * The CARD, not the page. A full-page shot puts the site's sticky nav
         * over exactly the rows this is evidence of — the assertions above
         * read them either way, but a screenshot nobody can read is not
         * evidence.
         */
        const panel = page.locator(
          `[data-testid="v2-cat-${compatCategory}"] ul:has(li[data-rule])`);
        // Centre it first: the site's sticky nav paints over the bottom of the
        // viewport, and an element screenshot captures whatever is on top.
        await panel.scrollIntoViewIfNeeded();
        await page.evaluate(() => window.scrollBy(0, -200));
        await page.waitForTimeout(150);
        await panel.screenshot({ path: `${SHOTS}/15-compat-detail-390.png` });
      }

      /*
       * And the whole proposal, read as one string: no kebab-cased Latin
       * identifier anywhere. That covers part ids, rule ids and finding ids in
       * one assertion, on the text a reader actually sees.
       */
      const proposalText = (await page.locator('[data-testid="v2-proposal"]').innerText()) ?? '';
      const latinKeys = proposalText.match(/\b[a-z]+(?:-[a-z0-9]+){1,}\b/g) ?? [];
      ok(`${name}: no internal identifier is visible anywhere in the proposal `
        + `(${latinKeys.slice(0, 3).join(', ') || 'none'})`, latinKeys.length === 0);

      /*
       * THE HEADINGS, AGAINST THE VOCABULARY — because the kebab-case sweep
       * above would not catch a category key that happens to be one word, or
       * camelCase like `videoUnits`. Every card's heading must be the Arabic
       * name this surface holds for that category, character for character.
       * A raw key in a heading fails here even when it looks innocent.
       */
      const headings = await page.locator('[data-testid^="v2-cat-"]').evaluateAll(
        els => els.map(el => ({
          category: (el.getAttribute('data-testid') ?? '').replace('v2-cat-', ''),
          heading: (el.querySelector('h4')?.textContent ?? '').trim(),
        })));
      ok(`${name}: every card has a heading (${headings.length} cards)`,
        headings.length > 0 && headings.every(h => h.heading !== ''));
      const wrongHeading = headings.filter(h => h.heading !== PART_VOCAB[h.category]?.ar);
      ok(`${name}: every heading is the Arabic category name, never the key `
        + `(${wrongHeading.map(h => `${h.category}→${h.heading}`).join(', ') || 'all correct'})`,
        wrongHeading.length === 0);
      ok(`${name}: …and no heading is its own category key`,
        headings.every(h => h.heading !== h.category));
      await compatBtn.click();
      await page.waitForTimeout(100);

      if (name === '390px') {
        await page.screenshot({ path: `${SHOTS}/12-proposal-390.png`, fullPage: true });
      }

      // ── P-B. NO BUDGET PREFERENCE → NOTHING RANKED ───────────────────────
      console.log(`\n[P-B] ${name} — Freestyle 6S · لا تفضيل → everything open`);
      await startJourney(page);
      await page.click('[data-testid="v2-goal-freestyle"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(200);
      await page.click('[data-testid="v2-input-cellCount-6"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(200);
      await page.click('[data-testid="v2-budget-none"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(200);
      await page.click('[data-testid="v2-owned-none"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(250);
      const pb = await openProposal(page, 'freestyle no preference');
      ok(`${name}: with nothing to rank by, the headline does NOT claim a proposal`,
        await page.locator('[data-testid="v2-proposal"]').getAttribute('data-quality') === 'all-open'
        && !pb.title.includes('المقترح لك'));
      ok(`${name}: …and it says what would let the system rank`,
        ((await page.locator('[data-testid="v2-proposal"]').textContent()) ?? '')
          .includes('فئة ميزانية'));
      ok(`${name}: every category is open`,
        await page.locator('[data-testid^="v2-cat-"][data-status="choice-required"]').count() === 8);
      ok(`${name}: still nothing preselected`,
        await page.locator('[data-testid^="v2-candidate-"][data-selected="true"]').count() === 0);
      /*
       * EIGHT open decisions is the heavy case. Every list collapses, so the
       * screen stays a scannable set of cards instead of the 31-row wall the
       * first version measured at 5.12 viewports.
       */
      /*
       * VISIBLE, not present. A collapsed panel keeps its rows in the DOM
       * behind `hidden` — counting nodes would pass while the wall was still
       * on screen, which is the opposite of what this asserts.
       */
      ok(`${name}: under a heavy load every list collapses`,
        await page.locator('[data-testid^="v2-show-candidates-"]').count() === 8
        && (await page.locator('[data-testid^="v2-show-candidates-"]')
          .evaluateAll(ns => ns.every(n => n.getAttribute('aria-expanded') === 'false')))
        && await page.locator('[data-testid^="v2-candidate-"]:visible').count() === 0);
      ok(`${name}: …and the screen is no longer a wall`, pb.fullPx / pb.viewport < 3.2);
      if (name === '390px') {
        await page.screenshot({ path: `${SHOTS}/13-proposal-all-open-390.png`, fullPage: true });
      }

      // ── P-C. OWNED DJI GOGGLES → THE CONSTRAINT REACHES THE PROPOSAL ─────
      console.log(`\n[P-C] ${name} — Freestyle 6S · متوازن · DJI → constrained proposal`);
      await freestyle6S(page);
      await page.click('[data-testid="v2-owned-goggles"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-owned-video-DJI"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(250);
      const pc = await openProposal(page, 'freestyle DJI');
      ok(`${name}: owning goggles left FEWER open decisions than not owning them`,
        await page.locator('[data-testid^="v2-cat-"][data-status="choice-required"]').count()
          < 2 + 1);
      const vtxText = (await page.locator('[data-testid="v2-cat-videoUnits"]').textContent()) ?? '';
      ok(`${name}: the video decision respects DJI`, vtxText.includes('DJI'));
      ok(`${name}: …and the burden line reflects the lighter load`,
        /نحتاج رأيك في اختيار واحد/.test(pc.burdenText));

      // ── P-D. AN UNIDENTIFIED RADIO STOPS BEFORE THE PROPOSAL ─────────────
      console.log(`\n[P-D] ${name} — «لست متأكدًا» cannot reach the parts proposal`);
      await freestyle6S(page);
      await page.click('[data-testid="v2-owned-radio"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-owned-rc-unsure"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(250);
      ok(`${name}: the summary is «needs identification»`,
        await page.locator('[data-testid="v2-summary-next"]').getAttribute('data-state')
          === 'needs-equipment-identification');
      ok(`${name}: there is NO door to the proposal`,
        await page.locator('[data-testid="v2-open-proposal"]').count() === 0);
      ok(`${name}: …and no part is rendered anywhere`,
        await page.locator('[data-testid^="v2-cat-"]').count() === 0
        && await page.locator('[data-testid="v2-proposal"]').count() === 0);

      // ── P-E. A BLOCKED BUILD CANNOT REACH THE PROPOSAL ───────────────────
      /*
       * THIS GATE IS NOW THE ONLY ONE, AND THAT IS DELIBERATE.
       *
       * `proposalDefects` used to report every `unavailable` decision as
       * `unavailable-required`, so a blocked build that somehow reached the
       * proposal would have hit the consistency refusal — a second, accidental
       * door-stop that existed only because the defect rule was wrong. Fixing
       * the rule (it now needs a `provenPath` to have a contradiction with)
       * removed that accident, so `readinessOf` carries the whole weight.
       *
       * Which is exactly why these assertions matter more than they did: they
       * are what stands between a reader and a proposal for a build that does
       * not exist.
       */
      console.log(`\n[P-E] ${name} — Crossfire: blocked before any part`);
      await freestyle6S(page);
      await page.click('[data-testid="v2-owned-radio"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-owned-rc-Crossfire"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(300);
      ok(`${name}: the summary is blocked`,
        await page.locator('[data-testid="v2-summary-next"]').getAttribute('data-state')
          === 'no-viable-build');
      ok(`${name}: there is NO door to the proposal`,
        await page.locator('[data-testid="v2-open-proposal"]').count() === 0);
      ok(`${name}: …and no part is rendered`,
        await page.locator('[data-testid^="v2-cat-"]').count() === 0);

      // ── P-F. LONG-RANGE — DERIVED PREREQUISITES, THEN A PROPOSAL ─────────
      console.log(`\n[P-F] ${name} — Long-range: asked neither, still proposes`);
      await startJourney(page);
      await page.click('[data-testid="v2-goal-long-range"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(200);
      ok(`${name}: still no size or voltage question`,
        await page.locator('[data-testid^="v2-input-"]').count() === 0);
      await page.click('[data-testid="v2-budget-mid"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(200);
      await page.click('[data-testid="v2-owned-none"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(250);
      const pf = await openProposal(page, 'long-range mid');
      ok(`${name}: long-range reaches a proposal`, pf.title.includes('هذا البناء المقترح لك'));
      ok(`${name}: …with «الخيار الوحيد المتوافق في الكتالوج» categories`,
        await page.locator('[data-testid^="v2-cat-"][data-status="only-compatible"]').count() > 0);
      const onlyText = (await page.locator('[data-testid^="v2-cat-"][data-status="only-compatible"]')
        .first().textContent()) ?? '';
      ok(`${name}: …which never claims to be the best`, !onlyText.includes('أفضل'));
      ok(`${name}: the burden line is still in the first viewport`,
        pf.burdenBottom <= pf.viewport);
      if (name === '390px') {
        await page.screenshot({ path: `${SHOTS}/14-proposal-longrange-390.png`, fullPage: true });
      }

      // ── G2. THE READER ACTUALLY CHOOSES ───────────────────────────────────
      /*
       * PHASE 2E, IN THE ONLY PLACE IT CAN BE PROVEN.
       *
       * Everything below is about one claim: a card looks chosen because the
       * ENGINE said so. That cannot be checked by reading source — a component
       * with its own `selected` flag would render identically on the happy
       * path. So this presses the real button and then reads what came back,
       * including the cases where the answer is NOT the obvious one.
       *
       * «لا تفضيل» is the fixture on purpose: with no budget to rank by, the
       * engine settles nothing and all eight categories are open, which is the
       * heaviest screen the reader can reach and the one with the most to get
       * wrong.
       */
      console.log(`\n[G2] ${name} — choosing a part, and unchoosing it`);

      /**
       * Press «التالي» until the summary's door appears, then go through it.
       *
       * Written as a loop rather than a fixed number of clicks because the
       * journey is DERIVED: changing one answer on the way back can leave every
       * later question already answered, in which case «التالي» goes straight
       * to the summary and a scripted second click has nothing to press. A walk
       * that assumes a fixed shape tests a journey the product does not have.
       */
      const advanceToProposal = async () => {
        for (let step = 0; step < 8; step++) {
          if (await page.locator('[data-testid="v2-open-proposal"]').count() === 1) break;
          const next = page.locator('[data-testid="v2-next"]');
          if (await next.count() !== 1 || !(await next.isEnabled())) break;
          await next.click();
          await page.waitForTimeout(220);
        }
        await page.click('[data-testid="v2-open-proposal"]');
        await page.waitForSelector('[data-testid="v2-proposal"]', { timeout: 15000 });
        await page.waitForTimeout(150);
      };

      const openAllOpenProposal = async () => {
        await startJourney(page);
        await page.click('[data-testid="v2-goal-freestyle"]');
        await page.click('[data-testid="v2-next"]');
        await page.waitForTimeout(200);
        await page.click('[data-testid="v2-input-cellCount-6"]');
        await page.click('[data-testid="v2-next"]');
        await page.waitForTimeout(200);
        await page.click('[data-testid="v2-budget-none"]');
        await page.click('[data-testid="v2-next"]');
        await page.waitForTimeout(200);
        await page.click('[data-testid="v2-owned-none"]');
        await page.click('[data-testid="v2-next"]');
        await page.waitForTimeout(250);
        await page.click('[data-testid="v2-open-proposal"]');
        await page.waitForSelector('[data-testid="v2-proposal"]', { timeout: 15000 });
      };

      /** Every candidate button in one category, in the order rendered. */
      const chooseButtons = (cat: string) =>
        page.locator(`[data-testid^="v2-choose-${cat}-"]`);

      /** Open a collapsed candidate list, if it is collapsed. */
      const revealCandidates = async (cat: string) => {
        const toggle = page.locator(`[data-testid="v2-show-candidates-${cat}"]`);
        if (await toggle.count() === 1 && await toggle.getAttribute('aria-expanded') === 'false') {
          await toggle.click();
          await page.waitForTimeout(120);
        }
      };

      const statusOf = (cat: string) =>
        page.locator(`[data-testid="v2-cat-${cat}"]`).getAttribute('data-status');
      const sourceOf = (cat: string) =>
        page.locator(`[data-testid="v2-cat-${cat}"]`).getAttribute('data-source');

      await openAllOpenProposal();

      ok(`${name}: the all-open build really does leave every category open`,
        await page.locator('[data-testid^="v2-cat-"][data-status="choice-required"]').count() === 8);
      /*
       * NOTHING STARTS CHOSEN. Not `candidateIds[0]`, not the `provenPath`
       * member, not the first row on screen. This is the assertion that fails
       * the moment someone «helpfully» preselects a default.
       */
      ok(`${name}: no category is chosen before the reader presses anything`,
        await page.locator('[data-testid^="v2-cat-"][data-source="user-selected"]').count() === 0);
      ok(`${name}: …and there is nothing to un-choose either`,
        await page.locator('[data-testid^="v2-change-choice-"]').count() === 0);
      ok(`${name}: every candidate row is offered as unselected`,
        (await page.locator('[data-testid^="v2-candidate-"][data-selected="true"]').count()) === 0
        && (await page.locator('[data-testid^="v2-candidate-"]').count()) > 0);
      ok(`${name}: the list no longer calls itself display-only`,
        !((await page.locator('[data-testid="v2-proposal"]').textContent()) ?? '')
          .includes('للعرض في هذه المرحلة'));

      await revealCandidates('frames');
      const frameButtons = await chooseButtons('frames').count();
      ok(`${name}: the frame list offers more than one real choice`, frameButtons >= 2);

      /*
       * THE LAST ROW, NEVER THE FIRST.
       *
       * A UI that quietly defaults to `candidateIds[0]` passes every assertion
       * about «the chosen one» if the test also presses the first row. Pressing
       * the last one makes the two answers different, so a default cannot hide
       * behind the click.
       */
      const lastFrame = chooseButtons('frames').nth(frameButtons - 1);
      const lastFrameName = (await lastFrame.getAttribute('aria-label') ?? '')
        .replace(/^اختيار\s+/, '');
      const firstFrameName = (await chooseButtons('frames').first().getAttribute('aria-label') ?? '')
        .replace(/^اختيار\s+/, '');
      ok(`${name}: the row pressed is NOT the first one offered`,
        lastFrameName.length > 0 && lastFrameName !== firstFrameName);
      ok(`${name}: the button's accessible name carries the part, not an id`,
        lastFrameName.length > 2 && !/[a-z]+-[a-z0-9-]+/.test(lastFrameName));

      const box = await lastFrame.boundingBox();
      ok(`${name}: the choose button is a real touch target`,
        !!box && box.height >= 44);

      /*
       * A RING A KEYBOARD USER CAN SEE.
       *
       * `:focus-visible` is a browser judgement, not a class the markup can
       * assert, so the only honest check is to focus the button FROM THE
       * KEYBOARD and read the computed outline back. A `minHeight` in a style
       * object proves nothing about this.
       */
      await lastFrame.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      const ring = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          testId: el.getAttribute('data-testid') ?? '',
          width: parseFloat(cs.outlineWidth) || 0,
          style: cs.outlineStyle,
          colour: cs.outlineColor,
        };
      });
      ok(`${name}: the keyboard really is on the choose button`,
        !!ring && ring.testId.startsWith('v2-choose-'));
      ok(`${name}: …and it draws a visible focus ring`,
        !!ring && ring.width >= 2 && ring.style !== 'none'
        && !/rgba\(0, 0, 0, 0\)|transparent/.test(ring.colour));

      /*
       * AND THE SCREEN IS STILL A SCREEN. Eight open categories, each list now
       * carrying a button per row, is the heaviest this page ever gets.
       */
      const openMetrics = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="v2-proposal"]')!;
        return {
          screens: +(el.getBoundingClientRect().height / window.innerHeight).toFixed(2),
          controls: el.querySelectorAll('button, a[href]').length,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      console.log(`      all-open proposal with one list open (${name}): `
        + `${openMetrics.screens} screens · ${openMetrics.controls} controls `
        + `· overflow ${openMetrics.overflow}px`);
      ok(`${name}: the page never scrolls sideways`, openMetrics.overflow === 0);

      await lastFrame.click();
      await page.waitForTimeout(250);

      ok(`${name}: the engine now reports the frame as the READER's choice`,
        await statusOf('frames') === 'user-selected'
        && await sourceOf('frames') === 'user-selected');
      ok(`${name}: …and it is the part that was pressed, not the first row`,
        ((await page.locator('[data-testid="v2-part-name-frames"]').first().textContent()) ?? '')
          .trim() === lastFrameName);
      ok(`${name}: the card carries «اخترتها», never «اقترحناه لك»`,
        ((await page.locator('[data-testid="v2-badge-frames"]').textContent()) ?? '')
          .includes('اخترتها'));
      ok(`${name}: the card moved into «اخترتها», out of «نحتاج اختيارك»`,
        await page.locator('[data-testid="v2-group-chosen"] [data-testid="v2-cat-frames"]')
          .count() === 1);
      ok(`${name}: the choice was announced politely`,
        ((await page.locator('[data-testid="v2-selection-announcement"]').textContent()) ?? '')
          === `تم اختيار ${lastFrameName}`);
      ok(`${name}: the keyboard landed on the card that changed`,
        await page.evaluate(() => document.activeElement
          ?.getAttribute('data-testid')) === 'v2-cat-frames');
      ok(`${name}: the chosen category has no candidate list left to argue with`,
        await page.locator('[data-testid="v2-candidates-frames"]').count() === 0);
      ok(`${name}: …and it offers the way back out`,
        await page.locator('[data-testid="v2-change-choice-frames"]').count() === 1);
      /*
       * A CHOICE IS NOT A RECOMMENDATION. The headline may only change to the
       * reader's own, never to «هذا البناء المقترح لك», because the system
       * still settled nothing here.
       */
      const afterOneTitle =
        (await page.locator('[data-testid="v2-proposal-title"]').textContent()) ?? '';
      ok(`${name}: the page now says the build is the reader's shape`,
        afterOneTitle.includes('اختياراتك لهذا البناء'));

      /*
       * THE NEXT DECISION IS RECOMPUTED, NOT REPLAYED.
       *
       * With a frame fixed, the surviving motors are the ones that fit THAT
       * frame. A UI that kept the list it had already rendered would offer
       * parts the engine has just ruled out.
       */
      await revealCandidates('motors');
      const motorButtons = await chooseButtons('motors').count();
      ok(`${name}: motors are still an open decision after the frame`,
        await statusOf('motors') === 'choice-required' && motorButtons >= 1);

      const lastMotor = chooseButtons('motors').nth(motorButtons - 1);
      const motorName = (await lastMotor.getAttribute('aria-label') ?? '')
        .replace(/^اختيار\s+/, '');
      await lastMotor.click();
      await page.waitForTimeout(250);

      ok(`${name}: the second choice lands too`,
        await sourceOf('motors') === 'user-selected');
      /* ACCUMULATION. The first choice is not a thing the second replaced. */
      ok(`${name}: …and the first choice is still the reader's`,
        await sourceOf('frames') === 'user-selected');

      if (name === '390px') {
        await page.screenshot({ path: `${SHOTS}/15-two-reader-choices-390.png`, fullPage: true });
      }

      // ── Undo, and ONLY the category it belongs to ─────────────────────────
      await page.click('[data-testid="v2-change-choice-frames"]');
      await page.waitForTimeout(250);
      ok(`${name}: clearing the frame reopens exactly that category`,
        await sourceOf('frames') !== 'user-selected');
      ok(`${name}: …and leaves the motor choice alone`,
        await sourceOf('motors') === 'user-selected');
      ok(`${name}: the undo was announced too`,
        ((await page.locator('[data-testid="v2-selection-announcement"]').textContent()) ?? '')
          === `تم إلغاء اختيار ${lastFrameName}`);
      ok(`${name}: …and the keyboard followed the change again`,
        await page.evaluate(() => document.activeElement
          ?.getAttribute('data-testid')) === 'v2-cat-frames');

      // ── What survives navigation, and what must not ───────────────────────
      /*
       * IN-V2 NAVIGATION IS NOT AN ANSWER CHANGE.
       *
       * Going to the summary and back moves the screen, not the answers, so a
       * choice the reader made has to still be there. Losing it here is the
       * cheapest possible way to make the feature feel broken.
       */
      await page.click('[data-testid="v2-back"]');
      await page.waitForTimeout(200);
      await page.click('[data-testid="v2-open-proposal"]');
      await page.waitForTimeout(250);
      ok(`${name}: a choice survives proposal → summary → proposal`,
        await sourceOf('motors') === 'user-selected');

      /*
       * BUDGET CLEARS NOTHING. It is a preference and a preference does not
       * outrank a choice — so changing it must not quietly discard one.
       */
      await page.click('[data-testid="v2-back"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-back"]');
      await page.waitForTimeout(200);
      let guard = 0;
      while (!(await questionTitle(page)).includes('الميزانية') && guard++ < 6) {
        await page.click('[data-testid="v2-back"]');
        await page.waitForTimeout(150);
      }
      ok(`${name}: reached the budget question again`,
        (await questionTitle(page)).includes('الميزانية'));
      await page.click('[data-testid="v2-budget-mid"]');
      await page.waitForTimeout(200);
      await advanceToProposal();
      ok(`${name}: changing the BUDGET keeps the reader's choice`,
        await sourceOf('motors') === 'user-selected');
      ok(`${name}: …and the choice still outranks the new ranking`,
        ((await page.locator('[data-testid="v2-part-name-motors"]').first().textContent()) ?? '')
          .trim() === motorName);

      /*
       * THE GOAL IS A DIFFERENT BUILD. Everything chosen under the old one goes.
       */
      await page.click('[data-testid="v2-back"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-back"]');
      await page.waitForTimeout(200);
      guard = 0;
      while (!(await questionTitle(page)).includes('ماذا تريد أن تبني') && guard++ < 8) {
        await page.click('[data-testid="v2-back"]');
        await page.waitForTimeout(150);
      }
      ok(`${name}: reached the goal question again`,
        (await questionTitle(page)).includes('ماذا تريد أن تبني'));
      await page.click('[data-testid="v2-goal-long-range"]');
      await page.waitForTimeout(200);
      await advanceToProposal();
      ok(`${name}: changing the GOAL discards every earlier choice`,
        await page.locator('[data-testid^="v2-cat-"][data-source="user-selected"]')
          .count() === 0);

      /*
       * AN ECOSYSTEM ANSWER CLEARS ITS OWN SHELF, AND ONLY ITS OWN.
       *
       * Naming a radio narrows `receivers`. It says nothing whatever about the
       * frame the reader picked, and taking that away would be the eager
       * failure `selectionState.ts` is written to avoid.
       */
      await openAllOpenProposal();
      await revealCandidates('frames');
      const ecoFrame = chooseButtons('frames').first();
      const ecoFrameName = (await ecoFrame.getAttribute('aria-label') ?? '')
        .replace(/^اختيار\s+/, '');
      await ecoFrame.click();
      await page.waitForTimeout(250);
      await revealCandidates('receivers');
      const rxCount = await chooseButtons('receivers').count();
      ok(`${name}: receivers are an open decision before any radio is named`,
        await statusOf('receivers') === 'choice-required' && rxCount >= 1);
      await chooseButtons('receivers').first().click();
      await page.waitForTimeout(250);
      ok(`${name}: both a frame and a receiver are now the reader's`,
        await sourceOf('frames') === 'user-selected'
        && await sourceOf('receivers') === 'user-selected');

      await page.click('[data-testid="v2-back"]');
      await page.waitForTimeout(150);
      await page.click('[data-testid="v2-back"]');
      await page.waitForTimeout(200);
      guard = 0;
      while (!(await questionTitle(page)).includes('معدات') && guard++ < 8) {
        await page.click('[data-testid="v2-back"]');
        await page.waitForTimeout(150);
      }
      ok(`${name}: reached the owned-gear question again`,
        (await questionTitle(page)).includes('معدات'));
      await page.click('[data-testid="v2-owned-radio"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(250);
      await page.click('[data-testid="v2-owned-rc-ExpressLRS"]');
      await page.waitForTimeout(200);
      await advanceToProposal();
      ok(`${name}: naming a radio clears the RECEIVER choice`,
        await sourceOf('receivers') !== 'user-selected');
      ok(`${name}: …and does not touch the frame, which it says nothing about`,
        await sourceOf('frames') === 'user-selected'
        && ((await page.locator('[data-testid="v2-part-name-frames"]').first().textContent())
          ?? '').trim() === ecoFrameName);

      if (name === '390px') {
        await page.screenshot({ path: `${SHOTS}/16-ecosystem-cleared-receiver-390.png`, fullPage: true });
      }

      // ── G3. OVERRULING A RECOMMENDATION ───────────────────────────────────
      /*
       * PHASE 2F, IN A REAL BROWSER.
       *
       * The beginner journey is «اقترح لي بناءً مناسبًا» and then «دعني أغيّر
       * قطعة إذا أردت». Phase 2E answered the first half's open decisions;
       * this is the second half, on the categories the system settled.
       *
       * Every expectation below is computed from `proposeBuild` in node and
       * compared against the DOM, so «the other cards show the recomputed
       * answer» is checked against the engine rather than against a guess
       * about what ought to have moved.
       */
      console.log(`\n[G3] ${name} — changing a part the system recommended`);

      const base = engine();
      const swapCat = base.decisions.find(d =>
        d.status === 'recommended'
        && d.candidateIds.filter(id => id !== d.partId).length > 1)!;
      const swapAlts = swapCat.candidateIds.filter(id => id !== swapCat.partId);
      /* The LAST alternative, so a `candidateIds[0]` default cannot hide. */
      const altA = swapAlts[swapAlts.length - 1];
      const altB = swapAlts[0];
      const partName = (b: ReturnType<typeof engine>, c: string) => b.parts[c]?.nameAr ?? '';

      await freestyle6S(page);
      await page.click('[data-testid="v2-owned-none"]');
      await page.click('[data-testid="v2-next"]');
      await page.waitForTimeout(250);
      await page.click('[data-testid="v2-open-proposal"]');
      await page.waitForSelector('[data-testid="v2-proposal"]', { timeout: 15000 });

      const swapToggle = `[data-testid="v2-show-alternatives-${swapCat.category}"]`;
      const statusOfCat = (c: string) =>
        page.locator(`[data-testid="v2-cat-${c}"]`).getAttribute('data-status');
      const sourceOfCat = (c: string) =>
        page.locator(`[data-testid="v2-cat-${c}"]`).getAttribute('data-source');
      const shownPart = async (c: string) =>
        ((await page.locator(`[data-testid="v2-part-name-${c}"]`).first().textContent())
          ?? '').trim();

      ok(`${name}: «${swapCat.category}» arrives as a system recommendation`,
        await statusOfCat(swapCat.category) === 'recommended'
        && await sourceOfCat(swapCat.category) === 'system');
      ok(`${name}: …showing the part the engine ranked first`,
        await shownPart(swapCat.category) === partName(base, swapCat.category));
      ok(`${name}: the swap control is offered`,
        await page.locator(swapToggle).count() === 1);

      /*
       * CLOSED BY DEFAULT, ON EVERY RECOMMENDED CARD. Six open alternative
       * lists is V1's step 10 rebuilt — the failure this whole journey exists
       * to undo.
       */
      const toggles = await page.locator('[data-testid^="v2-show-alternatives-"]').all();
      const anyOpen = await Promise.all(
        toggles.map(t => t.getAttribute('aria-expanded')));
      ok(`${name}: every alternatives list starts closed (${toggles.length} cards)`,
        toggles.length > 0 && anyOpen.every(v => v === 'false'));
      const beforeMetrics = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="v2-proposal"]')!;
        return {
          screens: +(el.getBoundingClientRect().height / window.innerHeight).toFixed(2),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      console.log(`      proposal with every alternatives list closed (${name}): `
        + `${beforeMetrics.screens} screens · overflow ${beforeMetrics.overflow}px`);
      ok(`${name}: …and the page still does not scroll sideways`,
        beforeMetrics.overflow === 0);

      await page.click(swapToggle);
      await page.waitForTimeout(150);
      const altButtons = page.locator(`[data-testid^="v2-choose-${swapCat.category}-"]`);
      ok(`${name}: the list holds exactly the engine's alternatives`,
        await altButtons.count() === swapAlts.length);
      ok(`${name}: …and the current recommendation is not among them`,
        await page.locator(
          `[data-testid="v2-choose-${swapCat.category}-${swapCat.partId}"]`).count() === 0);

      const altAButton = page.locator(`[data-testid="v2-choose-${swapCat.category}-${altA}"]`);
      const altAName = (await altAButton.getAttribute('aria-label') ?? '')
        .replace(/^اختيار\s+/, '');
      ok(`${name}: the alternative pressed is the LAST offered, not the first`,
        swapAlts.length > 1 && altA !== altB);
      const altBox = await altAButton.boundingBox();
      ok(`${name}: the alternative button is a real touch target`,
        !!altBox && altBox.height >= 44);

      /* Keyboard, and a ring a sighted keyboard user can actually find. */
      await altAButton.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      const altRing = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          testId: el.getAttribute('data-testid') ?? '',
          width: parseFloat(cs.outlineWidth) || 0,
          style: cs.outlineStyle,
        };
      });
      ok(`${name}: the keyboard reaches the alternative and it draws a ring`,
        !!altRing && altRing.testId === `v2-choose-${swapCat.category}-${altA}`
        && altRing.width >= 2 && altRing.style !== 'none');

      /* Press it with the KEYBOARD, so the whole path is proven hands-free. */
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      const afterA = engine({ selectedParts: { [swapCat.category]: altA } });
      ok(`${name}: the engine now calls it the reader's own`,
        await statusOfCat(swapCat.category) === 'user-selected'
        && await sourceOfCat(swapCat.category) === 'user-selected');
      ok(`${name}: …and it is the exact alternative pressed`,
        await shownPart(swapCat.category) === partName(afterA, swapCat.category)
        && await shownPart(swapCat.category) === altAName);
      ok(`${name}: the card moved into «اخترتها»`,
        await page.locator(
          `[data-testid="v2-group-chosen"] [data-testid="v2-cat-${swapCat.category}"]`)
          .count() === 1);
      ok(`${name}: the swap control is gone — it is an ordinary choice now`,
        await page.locator(swapToggle).count() === 0
        && await page.locator(
          `[data-testid="v2-change-choice-${swapCat.category}"]`).count() === 1);
      ok(`${name}: the choice was announced`,
        ((await page.locator('[data-testid="v2-selection-announcement"]').textContent()) ?? '')
          === `تم اختيار ${altAName}`);
      ok(`${name}: the keyboard landed on the card that changed`,
        await page.evaluate(() => document.activeElement
          ?.getAttribute('data-testid')) === `v2-cat-${swapCat.category}`);

      /*
       * EVERY OTHER CARD EQUALS THE RECOMPUTED BUILD — not the one before.
       * Checked against the engine, category by category, whether or not this
       * catalogue happened to move any of them.
       */
      let checked = 0;
      let moved = 0;
      for (const d of afterA.decisions) {
        if (d.category === swapCat.category) continue;
        const expected = partName(afterA, d.category);
        if (!expected) continue;
        checked++;
        if (partName(base, d.category) !== expected) moved++;
        ok(`${name}: «${d.category}» shows the recomputed answer`,
          await shownPart(d.category) === expected);
      }
      console.log(`      recomputation (${name}): ${checked} other categories checked, `
        + `${moved} genuinely moved`);
      ok(`${name}: …and that comparison covered real categories`, checked >= 4);

      if (name === '390px') {
        await page.screenshot({ path: `${SHOTS}/17-recommendation-overridden-390.png`, fullPage: true });
      }

      // ── Back to the system's own answer, then a different alternative ─────
      await page.click(`[data-testid="v2-change-choice-${swapCat.category}"]`);
      await page.waitForTimeout(300);
      ok(`${name}: clearing restores the SYSTEM recommendation`,
        await statusOfCat(swapCat.category) === 'recommended'
        && await sourceOfCat(swapCat.category) === 'system'
        && await shownPart(swapCat.category) === partName(base, swapCat.category));
      ok(`${name}: …and the swap control is back with it`,
        await page.locator(swapToggle).count() === 1);
      ok(`${name}: …and every other card is back to the engine's original answer`,
        await shownPart(afterA.decisions.find(d =>
          d.category !== swapCat.category && base.parts[d.category])!.category)
          === partName(base, afterA.decisions.find(d =>
            d.category !== swapCat.category && base.parts[d.category])!.category));

      await page.click(swapToggle);
      await page.waitForTimeout(150);
      await page.click(`[data-testid="v2-choose-${swapCat.category}-${altB}"]`);
      await page.waitForTimeout(300);
      const afterB = engine({ selectedParts: { [swapCat.category]: altB } });
      ok(`${name}: A → clear → B lands on B`,
        await sourceOfCat(swapCat.category) === 'user-selected'
        && await shownPart(swapCat.category) === partName(afterB, swapCat.category));
      ok(`${name}: …and B is a different part from A`,
        partName(afterB, swapCat.category) !== partName(afterA, swapCat.category));

      // ── The swap survives leaving the proposal and coming back ────────────
      await page.click('[data-testid="v2-back"]');
      await page.waitForTimeout(200);
      await page.click('[data-testid="v2-open-proposal"]');
      await page.waitForTimeout(300);
      ok(`${name}: the swap survives proposal → summary → proposal`,
        await sourceOfCat(swapCat.category) === 'user-selected'
        && await shownPart(swapCat.category) === partName(afterB, swapCat.category));

      const afterMetrics = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="v2-proposal"]')!;
        return {
          screens: +(el.getBoundingClientRect().height / window.innerHeight).toFixed(2),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      console.log(`      proposal after the swap (${name}): ${afterMetrics.screens} screens `
        + `· overflow ${afterMetrics.overflow}px`);
      ok(`${name}: still no horizontal overflow after the swap`, afterMetrics.overflow === 0);

      // ── H. THE PREVIEW'S OWN WAY OUT ──────────────────────────────────────
      /*
       * «العودة إلى مسار البناء الحالي» must actually return to V1.
       *
       * This is not a formality. The gate reads `location.search` and
       * subscribes to `popstate`; a `next/link` navigation calls
       * `history.pushState`, which fires NO `popstate`. The URL changed to
       * `/build` and the preview stayed on screen — a link that lied. Caught
       * here, fixed by making it a real navigation.
       */
      console.log(`\n[H] ${name} — the way back to V1 actually goes there`);
      await openPreview(page);
      ok(`${name}: the preview is on screen before the click`,
        await page.locator('[data-testid="build-v2-preview"]').count() === 1);
      await Promise.all([
        page.waitForURL(u => new URL(u).search === '', { timeout: 15000 }),
        page.click('[data-testid="v2-back-to-v1"]'),
      ]);
      await page.waitForSelector('a[href^="/build/wizard"]', { timeout: 15000 });
      ok(`${name}: the URL is now plain /build`,
        new URL(page.url()).pathname === '/build' && new URL(page.url()).search === '');
      ok(`${name}: the preview is gone`,
        await page.locator('[data-testid="build-v2-preview"]').count() === 0);
      ok(`${name}: V1's three doors are back — with no manual reload`,
        await page.locator('a[href^="/build/wizard"]').count() >= 3);
      if (name === '390px') {
        await page.screenshot({ path: `${SHOTS}/09-back-to-v1-390.png`, fullPage: true });
      }

      // ── No persistence ────────────────────────────────────────────────────
      const stored = await page.evaluate(() => {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && /v2|preview/i.test(k)) keys.push(k);
        }
        return keys;
      });
      ok(`${name}: the preview writes no storage of its own`, stored.length === 0);

      await ctx.close();
    }

    console.log('\n[G] Console health');
    ok('zero console errors', consoleErrors.length === 0);
    consoleErrors.slice(0, 5).forEach(e => console.log(`      ${e}`));
  } finally {
    if (browser) await browser.close();
    try { process.kill(-server.pid!, 'SIGKILL'); } catch { /* already gone */ }
    freePort();
  }

  console.log(`\n[build v2 e2e] ${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach(f => console.log(`  FAILED: ${f}`));
    process.exit(1);
  }
}

await main();
