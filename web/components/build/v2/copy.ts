/**
 * EVERY ARABIC SENTENCE THE V2 ENTRY JOURNEY SAYS
 * ===============================================
 *
 * In one file so the copy can be read as PROSE and judged as prose, instead of
 * being audited across eight components. Whoever reviews the Arabic should be
 * able to read this top to bottom without opening a single .tsx.
 *
 * THE RULES THIS COPY FOLLOWS
 * ---------------------------
 * · Arabic first. A technical token appears only where the reader will meet it
 *   again on a product page — «ExpressLRS», «DJI», «4S». Never «ecosystem»,
 *   never «prerequisite», never «compatibility engine».
 * · No sentence claims one option is better than another unless the CATALOGUE
 *   says so. The voltage and size notes are borrowed from `labels.ts`, where
 *   they are already written as «context, not a rule».
 * · No step counting. «الخطوة ٢ من ٨» is the feeling V2 exists to remove.
 * · Short. A question, one line of why, then the choices.
 */

/** The entry screen. */
export const ENTRY = {
  title: 'ابنِ درونك خطوة بخطوة',
  lead:
    'أخبرنا بما تريد بناءه، ونتكفّل نحن بما نستطيع حسمه من القطع المتوافقة — '
    + 'ولا نسألك إلا عمّا نحتاجه فعلًا.',
  reassure:
    'لست مضطرًا لمعرفة كل قطعة الآن. التفاصيل التقنية موجودة متى أردتها.',
  cta: 'ابدأ البناء',
} as const;

/** The three human stages. Not a progress bar — a map. */
export const PHASES = [
  { id: 'parts', titleAr: 'اختيار القطع' },
  { id: 'assembly', titleAr: 'التجميع' },
  { id: 'setup', titleAr: 'الإعداد وأول تشغيل' },
] as const;

export const PHASE_FUTURE_NOTE = 'لاحقًا في هذا المسار';

/** The goal question. */
export const GOAL = {
  question: 'ماذا تريد أن تبني؟',
  help: 'نوع الطيران الذي تريده هو ما يحدّد بقية الاختيارات.',
} as const;

/** Prerequisite questions, keyed by the engine's own input key. */
export const REQUIRED_INPUT = {
  cellCount: {
    question: 'على أي جهد بطارية تبني؟',
    help: 'كلاهما يعمل لهذا البناء، ولا شيء في بياناتنا يرجّح أحدهما — الاختيار لك.',
  },
  sizeInch: {
    question: 'ما مقاس البناء؟',
    help: 'أكثر من مقاس يؤدي إلى بناء سليم هنا، فالاختيار لك.',
  },
} as const;

/** The budget preference. Optional, and honest about what it does. */
export const BUDGET = {
  question: 'ما فئة الميزانية التي تناسبك؟',
  help: 'يساعدنا هذا في ترتيب الخيارات المتوافقة — ولا يتجاوز التوافق أبدًا.',
  options: [
    { value: 'budget', label: 'اقتصادي' },
    { value: 'mid', label: 'متوازن' },
    // NOT «السعر ليس الأولوية» — that is a claim about the reader's wallet.
    // `premium` is a tier the catalogue assigns to a part, nothing more.
    { value: 'premium', label: 'الفئة الأعلى' },
    { value: 'none', label: 'لا تفضيل' },
  ],
  /*
   * NOT «دون ترتيب بالسعر». The engine has never sorted by `priceRangeUSD`;
   * it ranks by the catalogue's `tier` and only when the reader names one. A
   * note promising «no price ordering» describes a feature that does not
   * exist, and quietly tells the reader that the other three answers DO sort
   * by price. Both halves are false.
   */
  noneNote: 'لن نفضّل فئة ميزانية على أخرى.',
} as const;

/** Equipment already on the reader's desk. */
export const OWNED = {
  question: 'هل لديك معدات تريد أن نبني حولها؟',
  help: 'إن كنت تملك جهاز تحكم أو نظارة، فسنقصر الاختيارات على ما يعمل معها.',
  options: [
    { value: 'none', label: 'لا، سأبدأ من الصفر' },
    { value: 'radio', label: 'لدي جهاز تحكم' },
    { value: 'goggles', label: 'لدي نظارة' },
    { value: 'both', label: 'لدي الاثنان' },
  ],
  radioQuestion: 'أي نظام يستخدم جهاز التحكم لديك؟',
  radioHelp: 'المستقبل يجب أن يتحدث لغة جهازك نفسها.',
  gogglesQuestion: 'من أي منظومة نظارتك؟',
  gogglesHelp: 'وحدة الفيديو ونظارتك يجب أن تكونا من المنظومة نفسها.',
  unsure: 'لست متأكدًا',
  unsureNote: 'لا بأس — سنعرض كل المنظومات، ويمكنك تحديدها لاحقًا.',
} as const;

/** The summary — «this is what we understood». */
export const SUMMARY = {
  title: 'هذا ما فهمناه',
  lead: 'راجع ما اخترته وما استنتجه النظام قبل أن ننتقل إلى القطع.',
  chosenBadge: 'اخترته أنت',
  /*
   * The reader ANSWERED this question — the answer was «I don't know». The
   * row exists so «هذا ما فهمناه» cannot silently drop a question they were
   * put through, and the badge stays «اخترته أنت» because choosing this was
   * their decision, not the system's inference.
   */
  unsureValue: 'لست متأكدًا',
  derivedBadge: 'استنتجه النظام',
  derivedNote: 'من القطع المتوفرة لهذا النوع',
  fields: {
    droneType: 'نوع البناء',
    sizeInch: 'المقاس',
    cellCount: 'جهد البطارية',
    budgetTier: 'فئة الميزانية',
    rcSystem: 'نظام التحكم لديك',
    videoSystem: 'منظومة النظارة لديك',
  },
  /*
   * HOW THE SUMMARY ENDS — AND IT DOES NOT ALWAYS END WELL.
   *
   * This used to be one unconditional «جاهزون لبناء اقتراح القطع», shown to
   * every reader including those whose answers the catalogue cannot satisfy.
   * A review screen that always reports success is not a review screen.
   */
  status: {
    ready: {
      title: 'جاهزون لبناء اقتراح القطع',
      body: 'الخطوة التالية ستعرض القطع المقترحة وسبب كل اختيار.',
    },
    /*
     * Not a lecture and not a wizard. One line per unidentified item, saying
     * what it blocks and nothing more. Identifying it is Phase 2C's problem;
     * pretending it does not matter was this screen's.
     */
    needsEquipment: {
      title: 'نحتاج تحديد معدّاتك أولًا',
      rc: 'نحتاج معرفة نظام جهاز التحكم قبل اختيار المستقبل.',
      video: 'نحتاج معرفة منظومة النظارة قبل اختيار وحدة الفيديو.',
      body: 'بقية الاختيارات جاهزة، ولن نقترح قطعة تعتمد على معلومة لا نملكها.',
    },
    /*
     * «حاليًا» is doing real work. The catalogue not stocking a combination is
     * not the same as the combination being impossible, and a reader who owns
     * the gear in question deserves to know which of the two they are hearing.
     * The sentences underneath are the ENGINE's, never this file's.
     */
    blocked: {
      title: 'لا نستطيع تكوين اقتراح كامل ومتوافق بهذه الاختيارات حاليًا.',
      body: 'يمكنك تغيير أحد اختياراتك أعلاه والمحاولة مرة أخرى.',
      reasonsLabel: 'ما وجدناه:',
    },
  },
} as const;

/**
 * THE PROPOSAL SCREEN — PHASE 2C.
 *
 * Every number on this screen is derived from the engine's decisions. None of
 * these sentences contains one, which is why they are all fragments joined by
 * `proposalBurdenAr()` below rather than templates with «6» typed into them.
 */
export const PROPOSAL = {
  /*
   * TWO HEADLINES, BECAUSE ONE OF THEM IS SOMETIMES FALSE.
   *
   * «هذا البناء المقترح لك» claims the system proposed a build. Answer
   * Freestyle 6S with «لا تفضيل» and it recommended nothing at all — the
   * budget tier is its only tiebreaker — so all eight categories come back
   * open and the honest headline is the second one.
   */
  titleProposed: 'هذا البناء المقترح لك',
  titleAllOpen: 'الخيارات كلها أمامك',
  /*
   * THE READER'S OWN BUILD, SAID BACK TO THEM.
   *
   * «اختياراتك» — never «المقترح لك», because we proposed nothing here, and
   * never «الخيارات كلها أمامك», because at least one of them is not: they
   * closed it. What remains open is already reported, count by count, in the
   * burden line right underneath, so this sentence does not repeat it — and
   * must not, because a reader who has closed every category would read
   * «وما بقي يحتاج قرارك» as a request for something that is finished.
   */
  titleReaderShaped: 'اختياراتك لهذا البناء',
  leadProposed: 'ما حسمه النظام، وما ما زال يحتاج رأيك — وسبب كل اختيار.',
  leadReaderShaped: 'ما تراه هنا اخترته أنت — والنظام لم يحسم شيئًا من عنده في هذا البناء.',
  leadAllOpen:
    'كل القطع المتوافقة صالحة لهذا البناء، ولم يجد النظام ما يرجّح واحدة على '
    + 'أخرى. اختيار فئة ميزانية يعطيه أساسًا للترجيح.',

  /** Assembled from the counts; see `proposalBurdenAr`. */
  burden: {
    settledPrefix: 'حسمنا',
    needYouPrefix: 'ونحتاج رأيك في',
    nothingSettled: 'لم نحسم أي اختيار',
    nothingLeft: 'ولا نحتاج منك اختيارًا إضافيًا',
  },

  groups: {
    'needs-you': {
      title: 'نحتاج اختيارك',
      note: 'خيارات متعادلة في نظرنا — لا نملك ما يرجّح بينها، والقرار لك.',
    },
    'system-decided': { title: 'حسمها النظام', note: '' },
    yours: { title: 'قطعك', note: '' },
    /*
     * «اخترتها» — not «قطعك». Owning a part and choosing one for a build are
     * different sentences, and the domain keeps them apart precisely so this
     * heading does not tell someone they have hardware they have not bought.
     */
    chosen: { title: 'اخترتها', note: '' },
    problem: { title: 'تعذّر', note: '' },
  },

  /*
   * «اقترحناه لك» — not «الأفضل». The engine ranks by the catalogue's tier
   * against the reader's own answer; nothing in the data establishes a best
   * product, and saying so would be inventing a claim the domain refuses to
   * make.
   */
  recommendedBadge: 'اقترحناه لك',
  /*
   * The reader's own choice, said back to them. Never «اقترحناه لك» — we did
   * not — and never «تملكها», which is the other thing this is not.
   */
  selectedBadge: 'اخترتها',
  /*
   * A statement about THIS CATALOGUE, deliberately worded so it cannot be read
   * as «no other product exists». We stock one that fits; the market is not
   * ours to describe.
   */
  onlyCompatibleBadge: 'الخيار الوحيد المتوافق في الكتالوج',
  onlyCompatibleNote: 'لا يعني أنه الوحيد في السوق — بل الوحيد المتوافق ممّا لدينا.',
  ownedBadge: 'قطعة لديك',
  unavailableBadge: 'غير متاح',

  /*
   * The engine's reasons already say «التي اخترتها» where a decision rests on
   * the reader's answer, so a separate «بناءً على إجابتك:» label was written
   * here and never rendered. The dead-copy guard caught it.
   */
  whyTitle: 'لماذا هذه القطعة؟',
  /*
   * A tied category has no «هذه القطعة» to ask about — nothing was chosen.
   * Its reasons explain why the system declined to choose, so they need their
   * own heading; reusing the other one asks the reader about a part that is
   * not there.
   */
  whyTieTitle: 'لماذا لم نرجّح واحدة؟',

  /*
   * ONE LINE, NOT A FOREST OF TICKS. A beginner does not need four green rows;
   * they need to know the checks ran and passed. The detail is one click away
   * for whoever wants it — and it lists only rules the engine ACTUALLY
   * evaluated for this decision, never the full registry.
   */
  compat: {
    allPass: 'فحوص التوافق المطبَّقة: سليمة',
    someUnknown: 'فحوص التوافق المطبَّقة: بعضها يحتاج تأكيدًا',
    someViolated: 'فحوص التوافق المطبَّقة: هناك مخالفة',
    none: 'لا توجد قاعدة توافق مشتركة تنطبق على هذا الاختيار.',
    disclose: 'عرض التفاصيل',
    status: { pass: 'سليم', violated: 'مخالف', unknown: 'غير مؤكد' },
  },

  candidates: {
    title: 'الخيارات المتوافقة',
    /*
     * THE SENTENCE THAT TELLS THE READER WHAT TO DO — AND WHAT IT COSTS.
     *
     * It used to say «هذه القائمة للعرض في هذه المرحلة — الاختيار بينها يأتي
     * لاحقًا.» That was true for two phases and is now false: the buttons
     * below it reach the engine. Phase 2C wrote it because the DOMAIN could
     * not record «chose but does not own»; Phase 2D built that; Phase 2E wired
     * it. A list that has become clickable while still announcing itself as
     * display-only is worse than either state on its own.
     *
     * «واحدة» is the whole instruction: a category takes ONE part, choosing a
     * second replaces the first, and neither of those needs a sentence once
     * the first one is clear. «ويمكنك تغييرها» is the other half — a reader who
     * believes a click is final does not click — and the pronoun is feminine
     * because it refers to «قطعة», not to «الاختيار».
     */
    instruction: 'اختر قطعة واحدة لهذه الفئة — ويمكنك تغييرها بعد ذلك.',
    /*
     * The button, and it is a VERB. «اختيار» names the action the reader is
     * taking; the part it applies to is on the accessible name, so a screen
     * reader hears «اختيار Source One V5» rather than eight identical buttons.
     */
    choose: 'اختيار',
    /*
     * Undo, named for what it does rather than for what it undoes. NOT «إلغاء»
     * on its own, which in Arabic reads as «cancel» and would leave the reader
     * unsure whether the category goes back to being open or empties out.
     */
    change: 'تغيير الاختيار',
    /*
     * WHAT THE LIVE REGION SAYS — and it is feedback, never state.
     *
     * A sighted reader sees the card move to «اخترتها» and change shape. A
     * screen-reader user gets no such cue, because the change happens far from
     * the button they pressed. So the action is announced politely, once, in
     * the past tense — «تم» — because by the time it is read the engine has
     * already recomputed and the screen already shows the result. Nothing here
     * decides anything: if the engine refused the choice, the card says so and
     * this sentence is still only a report that the click was received.
     */
    chosenAnnouncement: (partAr: string) => `تم اختيار ${partAr}`,
    clearedAnnouncement: (partAr: string) => `تم إلغاء اختيار ${partAr}`,
    /*
     * Long lists, and screens with many open decisions, collapse.
     *
     * Measured: Freestyle with «لا تفضيل» leaves all eight categories open,
     * and expanding every list put 31 candidate rows on one screen — 5.12
     * phone viewports, which is the V1 wizard step this journey replaced. A
     * short list under a light load still opens straight away, because that
     * is the decision the reader came for.
     */
    show: 'عرض الخيارات',
  },

  /*
   * WHEN THE SYSTEM HAS ALREADY CHOSEN, AND THE READER WANTS SOMETHING ELSE
   * ======================================================================
   *
   * A `recommended` category is settled — the engine ranked the viable
   * candidates against the reader's own budget answer and one came out ahead.
   * But the beginner journey this product is for is «اقترح لي بناءً مناسبًا»
   * followed by «دعني أغيّر قطعة إذا أردت», and until Phase 2F the second half
   * had no control at all: the alternatives were sitting in `candidateIds` and
   * the card never offered them.
   *
   * WHAT THIS COPY MUST NOT SAY
   * ---------------------------
   * · NOT «قطع أفضل» or «قطع موصى بها» — the engine recommended ONE of these,
   *   and the rest are what survived the same filters. «صالحة» is the whole of
   *   what is known about them: they work in this build.
   * · NOT a promise that the rest of the proposal stays put. Locking an
   *   alternative re-runs the whole search, and another category's
   *   recommendation, candidate list or availability may genuinely change. A
   *   reader who is not told that reads the next screen as a bug.
   */
  alternatives: {
    /*
     * The disclosure answers the question the reader actually has — «can I
     * change this?» — rather than describing the widget. The panel it opens is
     * titled honestly, so nothing is promised that the list does not deliver,
     * and the count rides on the label so the weight is known before opening.
     */
    show: 'تغيير القطعة',
    title: 'بدائل صالحة لهذا البناء',
    /*
     * The consequence, in one line. This is the sentence that keeps the next
     * screen from looking broken: the engine re-runs on every lock, so a swap
     * here can move a recommendation two cards down.
     */
    note: 'اختيار بديل قد يغيّر اقتراحات قطع أخرى.',
  },

  /*
   * A manual check is a finding the DATA cannot settle. While one is open the
   * build is not «متوافق بالكامل», and this screen never says it is.
   */
  manual: {
    title: 'هناك فحص يدوي قبل اعتماد البناء',
    lead: 'شيء لا تحسمه البيانات وحدها — يحتاج تأكيدًا منك قبل الطيران.',
    labels: {
      'current-headroom':
        'هامش التيار بين المحرك والمنظّم: راجع الرقمين على القطعتين وتأكد أن '
        + 'المنظّم يحتمل ذروة سحب المحرك.',
    } as Record<string, string>,
  },

  /*
   * WHEN THE SCREEN REFUSES.
   *
   * Each of these was once a fallback that printed a database key — an
   * unresolvable part rendered its own id as a product name, a manual check
   * with no copy rendered its finding id. A missing mapping is a developer
   * defect, and showing the reader the key is not graceful degradation.
   *
   * So the proposal is withheld and the reason is named IN KIND, never by id.
   * The ids stay in `data-*` hooks and machine state for whoever is debugging.
   */
  consistency: {
    title: 'لا نستطيع عرض هذا الاقتراح',
    lead: 'وجدنا تعارضًا داخليًا في بيانات الاقتراح، ولا نعرض اقتراحًا ناقصًا أو '
      + 'غير متسق.',
    kinds: {
      'unavailable-required': 'فئة أساسية متعذّرة داخل بناء يُفترض أنه مُثبَت.',
      /*
       * The shelf itself. A decision can name a category the catalogue does
       * not have, and nothing in it would necessarily notice — a decision
       * with no part and no candidates trips none of the id checks, and the
       * card heading would print the key.
       */
      'unknown-category': 'فئة قطع لا وجود لها في الكتالوج الحالي.',
      'unlabelled-category': 'فئة قطع لا تملك الواجهة اسمًا عربيًا لها.',
      'unresolved-part': 'قطعة مختارة غير موجودة في الكتالوج الحالي.',
      'part-mismatch': 'القطعة المعروضة لا تطابق القطعة التي حسمها النظام.',
      'unresolved-candidate': 'أحد الخيارات المتوافقة غير موجود في الكتالوج الحالي.',
      /*
       * «موجودة لكن في فئة أخرى» is a different failure from «غير موجودة»,
       * and the more dangerous one: it resolves, it renders, and it looks like
       * an answer. A frame under «المحركات» is not a missing part.
       */
      'foreign-category': 'قطعة من فئة أخرى وُضعت في غير موضعها.',
      'unlabelled-manual-check': 'هناك فحص يدوي لا تملك الواجهة وصفًا له.',
    },
  },

  /* «رجوع» comes from NAV — the journey's footer is the same on every screen. */
  open: 'اعرض البناء المقترح',
} as const;

/** Navigation. */
export const NAV = {
  back: 'رجوع',
  next: 'التالي',
} as const;

/** The preview banner — this is not the product yet, and says so. */
export const PREVIEW_NOTICE = {
  label: 'معاينة',
  body: 'نسخة قيد التطوير من مسار البناء. النسخة الحالية ما زالت المعتمدة.',
  backToV1: 'العودة إلى مسار البناء الحالي',
} as const;
