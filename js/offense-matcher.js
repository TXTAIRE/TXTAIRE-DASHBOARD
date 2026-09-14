// Suggests which Code of Discipline offense an incident report describes.
//
// HR writes what happened in their own words; this ranks the offenses in the catalog
// against that narrative so HR picks from a short, reasoned list instead of scrolling a
// hundred-odd rows. It NEVER chooses. The NTE form shows the suggestions and HR confirms
// one -- the charge on a Notice to Explain is HR's decision, and it is the charge the
// employee answers, so it has to be a person's.
//
// Two things are done, in this order:
//
//   1. Subject. Words in the narrative are matched against each offense's own wording
//      (English and Filipino), after mapping the words HR actually writes -- "drunk",
//      "lasing", "no-show", "shabu" -- onto the vocabulary the Code uses. Rare words
//      count for more than common ones, and a recognised subject counts for more than a
//      word that merely sets the scene: "harness" outweighs "rooftop".
//
//   2. Tier. Much of the Code is written as one subject in two to four severity tiers
//      that share almost all their wording: an absence of 1 day, of 2-4 days, of 5 or
//      more; a loss under P5,000, up to P30,000, above that. Word matching alone ranks
//      those identically. So the narrative's facts -- numbers of days, minutes, times and
//      pesos, and cues like a weapon, a serious injury, property recovered -- are read
//      and used to pick the tier the Code actually describes.
//
//      Where the fact that decides the tier is missing, the BASE tier is listed first and
//      the suggestion says which fact to add. Not the harshest, and not simply the lowest
//      class: the base is the tier that applies to the core conduct alone. A Notice to
//      Explain may only charge what it alleges, so an aggravated form -- a weapon, a
//      serious injury, a loss above P30,000 -- cannot be charged on a narrative that does
//      not state the aggravating fact. If that fact exists, HR adds it and the tier moves.
//
// Where the Code sets a threshold -- late 4 or more times a month, undertime twice or
// more, a missed log 3 or more times -- and the narrative is under it, the suggestion is
// marked BELOW THRESHOLD: on those facts there is no offense yet, and an NTE should not
// issue for one.
//
// Everything runs in the browser against the catalog passed in. No incident text leaves
// the device, which matters: these narratives name employees and describe allegations
// that have not been answered yet.
//
// Offenses HR adds or edits in the catalog are matched on their wording like any other.
// Only the tier logic is keyed to the built-in offense codes, since it encodes thresholds
// written into those specific rows of the printed Code.
//
// tools/nte/matcher.test.js measures this against written incident reports and fails
// under an accuracy floor; tools/nte/explain.js shows why a narrative ranked as it did.
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- text
  // Function words in English and Filipino, plus words so common across the Code that
  // matching on them says nothing about WHICH offense ("company", "work", "without").
  const STOP = new Set((
    'a an the and or but if of to in on at by for from with within without into onto ' +
    'as is was were be been being are am do does did done has have had having will would ' +
    'shall should may might can could must not no nor so than that this these those ' +
    'there their them they he she him her his hers it its we our you your i me my ' +
    'who whom which what when where why how all any each every some such other another ' +
    'one two three four five six seven eight nine ten also only just very more most ' +
    'after before then later again while about around upon over under still even ' +
    'company client clients work working worker employee employees co coemployee ' +
    'superior superiors premises person persons third party duty duties hour hours ' +
    'during day days time times month months calendar week weeks year years ' +
    'got get gets made make making went go going came come coming told tell said say ' +
    'ang ng mga sa na at ay si ni kay nang ko mo ka siya kami kayo sila ito iyon ' +
    'para pero kung o lang ba po ho nga pa din rin kanyang kaniyang aking ' +
    'araw buwan beses oras trabaho kompanya empleyado'
  ).split(/\s+/));

  // Words that say where or when something happened, not what. Counted, but lightly --
  // otherwise "fell asleep in the service vehicle" matches housekeeping, whose label
  // happens to list "service vehicle" among the places to keep tidy.
  const SCENE = new Set((
    'jobsite site office warehouse stockroom building room area floor machine lunch break ' +
    'shift morning afternoon evening night front back inside outside near team group ' +
    'service vehicle van car truck home province gate parking street road client'
  ).split(/\s+/).map((w) => stemWord(w)));

  function stemWord(w) {
    if (w.length <= 3) return w;
    const rules = [
      ['ational', 'ate'], ['ization', 'ize'], ['iveness', 'ive'], ['fulness', 'ful'],
      ['ousness', 'ous'], ['nesses', ''], ['ness', ''], ['ments', ''], ['ment', ''],
      ['ings', ''], ['ing', ''], ['edly', ''], ['ied', 'y'], ['ies', 'y'],
      ['ations', 'ate'], ['ation', 'ate'], ['ions', ''], ['ion', ''],
      ['ers', ''], ['er', ''], ['ed', ''], ['ly', ''], ['es', ''], ['s', ''],
    ];
    for (const [suf, rep] of rules) {
      if (w.endsWith(suf) && w.length - suf.length >= 3) return w.slice(0, w.length - suf.length) + rep;
    }
    return w;
  }

  function words(text) {
    return String(text || '').toLowerCase()
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/-/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  const stems = (text) => words(text).filter(w => !STOP.has(w) && !/^\d+$/.test(w)).map(stemWord);

  // Phrases that would otherwise be read as something else. "Broken nose" is an injury,
  // not broken property -- left alone, "broken" pulls in every offense about a LOSS. Run
  // before both the vocabulary and the facts see the narrative.
  function canonicalize(text) {
    return String(text || '')
      .replace(/\b(?:broken|fractured|cracked)\s+(?:nose|arm|arms|leg|legs|rib|ribs|jaw|bone|bones|finger|fingers|toe|toes|wrist|ankle|skull|tooth|teeth|collarbone)\b/gi, ' seriously injured ')
      .replace(/\b(?:needed|required|got)\s+stitches\b/gi, ' seriously injured ')
      .replace(/\bnabalian\b/gi, ' seriously injured ');
  }

  // ---------------------------------------------------------------- vocabulary
  // The words HR writes, on the left; the Code's own words, on the right. Matched as
  // phrases against the lower-cased narrative, so "no show" and "did not report" work.
  // Filipino and Taglish forms sit alongside the English, because reports come in both.
  const LEXICON = [
    [['late', 'tardy', 'tardiness', 'lateness', 'huli', 'nahuli', 'nahuhuli', 'naglate'], 'tardiness late'],
    [['absent', 'absence', 'awol', 'no show', 'no-show', 'did not report for work', "didn't report for work",
      'did not come to work', "didn't come to work", 'did not come in', 'hindi pumasok', 'di pumasok',
      'lumiban', 'pagliban', 'liban', 'absent without leave'], 'absence'],
    [['leave form', 'leave application', 'file a leave', 'filed a leave', 'file the leave'], 'leave form'],
    [['undertime', 'went home early', 'left early', 'before the end of shift', 'before end of shift',
      'before the end of the shift', 'maagang umuwi', 'umuwi nang maaga'], 'undertime leaving shift'],
    [['left the jobsite', 'left the site', 'left the job site', 'left the office', 'left his post',
      'left her post', 'left work', 'left the premises', 'umalis sa site', 'umalis sa jobsite'],
      'leaving jobsite assigned permission'],
    [['wrong site', 'different site', 'another site', 'did not go to the site', "didn't go to the site"],
      'site assigned report'],
    [['overtime', 'call out', 'callout', 'call-out', 'weekend service', 'saturday', 'sunday duty'],
      'overtime call-out scheduled accepted'],
    [['biometric', 'biometrics', 'punch in', 'punch out', 'punched in', 'punched out', 'time in', 'time out',
      'log in', 'log out', 'login', 'logout', 'dtr', 'timecard', 'time card', 'timesheet', 'bundy'],
      'log biometric timesheet'],
    [['on behalf', 'for him', 'for her', 'someone else punch', 'punch for', 'punched for', 'buddy punch'],
      'behalf another'],
    [['altered', 'tampered', 'edited the', 'changed the time', 'falsified', 'falsify', 'fake', 'faked',
      'forged', 'forgery', 'fabricated', 'ghost', 'dinaya', 'pineke'], 'falsifying tampering forgery'],
    [['lied', 'false reason', 'fake excuse', 'made up', 'not true', 'was seen at', 'nagsinungaling'],
      'false reason'],
    [['receipt', 'receipts', 'invoice', 'invoices', 'official receipt', 'liquidation'],
      'receipts invoices records'],
    [['messy', 'dirty', 'untidy', 'housekeeping', 'cleanliness', 'clean up', 'makalat'],
      'housekeeping orderliness'],
    [['smoke', 'smoked', 'smoking', 'cigarette', 'vape', 'vaping', 'yosi', 'nagyosi', 'naninigarilyo'],
      'smoking vaping'],
    [['harness', 'helmet', 'hard hat', 'ppe', 'safety shoes', 'safety boots', 'gloves', 'goggles',
      'safety gear', 'face shield', 'earplugs'], 'protective equipment helmet'],
    [['safety rule', 'safety instruction', 'safety procedure', 'lockout', 'lock out', 'tag out',
      'unsafe', 'dangerous act'], 'safety instruction'],
    [['accident', 'near miss', 'naaksidente'], 'accident report'],
    [['id card', 'access card', 'gate pass', 'lent his id', 'lent her id', 'borrowed his id', 'used his id'],
      'identification card'],
    [['contagious', 'communicable', 'tuberculosis', 'hid his illness', 'hid her illness'],
      'communicable disease concealing'],
    [['forced entry', 'broke into', 'broke in', 'forced open', 'sneaked in', 'after hours'],
      'forcing entry'],
    [['knife', 'gun', 'firearm', 'pistol', 'bolo', 'weapon', 'blade', 'patalim', 'baril', 'balisong', 'ice pick'],
      'weapon possession deadly firearm'],
    [['drug', 'drugs', 'shabu', 'marijuana', 'weed', 'meth', 'methamphetamine', 'cocaine', 'positive for',
      'drug test', 'illegal substance', 'droga', 'nagdroga'], 'drugs dangerous'],
    [['drunk', 'intoxicated', 'alcohol', 'liquor', 'beer', 'whisky', 'tipsy', 'smelled of alcohol',
      'lasing', 'nakainom', 'alak', 'lango'], 'alcohol influence'],
    [['convicted', 'conviction', 'sentenced', 'final judgment', 'nahatulan'], 'conviction crime'],
    [['loafing', 'idle', 'idling', 'games', 'mobile games', 'facebook', 'tiktok', 'youtube',
      'browsing', 'tambay', 'nakatambay', 'nagcellphone'],
      'loafing idling personal activities wasting'],
    [['uniform', 'not in uniform', 'grooming', 'unshaven', 'improper attire', 'dress code'], 'uniform grooming'],
    [['phone', 'cellphone', 'mobile phone', 'radio', 'switched off', 'turned off', 'unreachable',
      'not answering', 'did not answer', "didn't answer", 'naka off'], 'phone reachable'],
    [['sleep', 'slept', 'asleep', 'sleeping', 'dozed', 'nap', 'napped', 'tulog', 'nakatulog', 'natutulog'],
      'sleeping'],
    [['evaded', 'avoided work', 'hiding from work', 'dodged'], 'evading'],
    [['negligence', 'negligent', 'careless', 'carelessly', 'mistake', 'wrong installation', 'installed wrong',
      'installed the wrong', 'overlooked', 'failed to check', 'did not check', 'nagkamali', 'kapabayaan'],
      'negligence careless'],
    [['damage', 'damaged', 'broke', 'broken', 'burned', 'burnt', 'destroyed', 'dented', 'cracked', 'leak',
      'leaked', 'sira', 'nasira', 'sinira'], 'damage loss'],
    [['refused', 'refuse', 'refusal', 'disobey', 'disobeyed', 'defied', 'ignored the instruction',
      'did not follow the instruction', "didn't follow", 'walked away', 'would not comply', 'ayaw sumunod',
      'hindi sumunod', 'tumanggi'], 'disobedience refusal instruction'],
    [['slowdown', 'slow down', 'slowed down', 'held back work', 'work stoppage', 'encouraged others to stop'],
      'output slowing'],
    [['kickback', 'bribe', 'bribery', 'lagay', 'in exchange for', 'accepted money', 'received money from',
      'commission from', 'gift from the supplier', 'gift from a supplier'], 'commission money accepting soliciting gift'],
    [['trade secret', 'pricing', 'costing', 'confidential', 'leaked', 'disclosed', 'client list',
      'competitor'], 'secrets disclosing trade'],
    [['sabotage', 'sabotaged', 'deliberately damaged', 'intentionally damaged'], 'sabotage deliberate'],
    [['vandal', 'vandalism', 'graffiti', 'defaced', 'spray painted', 'wrote on the wall'], 'vandalism defaces'],
    [['vehicle', 'service van', 'company van', 'van', 'company car', 'truck', 'multicab', 'motorcycle', 'sasakyan'],
      'vehicle'],
    [['reckless', 'recklessly', 'speeding', 'overspeeding', 'counterflow', 'beating the red light',
      'hit a post', 'hit a wall', 'bumped', 'sideswiped', 'no license', 'without a license',
      'expired license'], 'reckless driving imprudent'],
    [['personal use', 'personal errand', 'without permission', 'unauthorized use', 'used for personal'],
      'unauthorized personal use'],
    [['took home', 'take home', 'brought home', 'carried out', 'without a gate pass', 'without gate pass',
      'smuggled', 'sneaked out', 'iniuwi', 'inuwi'], 'removal authorization'],
    [['steal', 'stole', 'stolen', 'theft', 'pilfer', 'pilfered', 'pilferage', 'nakaw', 'nagnakaw',
      'ninakaw', 'kinuha nang walang paalam'], 'theft pilferage'],
    [['embezzle', 'embezzled', 'embezzlement', 'misappropriated', 'misappropriation', 'malversation',
      'pocketed', 'kept the money'], 'misappropriation embezzlement'],
    [['did not remit', "didn't remit", 'not remitted', 'short remittance', 'kept the payment',
      'kept the collection', 'collected payment', 'remit'], 'withholding funds remittance'],
    [['sideline', 'side business', 'raket', 'own business', 'own aircon business', 'moonlighting',
      'freelance', 'private job', 'private client', 'private clients'], 'sideline business outside competes'],
    [['conflict of interest', 'relative supplier', 'related supplier', 'undeclared'], 'conflict interest declare'],
    [['resume', 'false statement', 'fake diploma', 'fake certificate', 'job application'],
      'application false statement'],
    [['conspired', 'conspiracy', 'connived', 'in cahoots', 'instigated another'],
      'conspiring conniving'],
    [['horseplay', 'horsing around', 'playing around', 'prank', 'pranked', 'kulitan', 'harutan'],
      'horseplay unruly'],
    [['bulletin', 'notice board', 'memo board', 'tore the memo', 'removed the notice'], 'bulletin notice'],
    [['rude', 'rudeness', 'shouted at the client', 'yelled at the client', 'discourteous', 'impolite',
      'bastos sa kliyente', 'sinigawan ang kliyente', 'building admin', 'tenant'], 'discourtesy rudeness client'],
    [['cursed', 'cursing', 'swore at', 'foul language', 'called him names', 'called her names', 'insulted',
      'disrespectful', 'disrespect', 'talked back', 'mura', 'minura', 'pinagmumura'],
      'disrespect foul abusive insulting'],
    [['shouted', 'yelled', 'sigaw', 'sinigawan'], 'disrespect'],
    [['rumor', 'rumour', 'rumors', 'rumours', 'gossip', 'chismis', 'tsismis', 'spreading stories',
      'spreading lies', 'intriga'], 'rumours malicious intrigues'],
    [['threat', 'threaten', 'threatened', 'threatening', 'will hurt', 'would hurt', 'going to hurt',
      'banta', 'binantaan', 'pinagbantaan'], 'threat harm'],
    [['bully', 'bullied', 'bullying', 'mocking', 'mocked', 'humiliating', 'humiliated', 'ridiculed',
      'ganging up', 'group chat', 'excluded him', 'excluded her'], 'bullying'],
    [['fight', 'fought', 'fighting', 'fist fight', 'fistfight', 'brawl', 'punched', 'punch', 'hit him',
      'hit her', 'slapped', 'kicked', 'nakipag away', 'nakipagaway', 'away', 'sinuntok', 'suntukan',
      'sapak', 'sinapak'], 'fighting fight'],
    [['seriously injured', 'injured', 'injury', 'wounded', 'assaulted', 'beat up', 'mauled', 'sinaktan'],
      'physical injury serious inflicting'],
    [['sexual', 'harass', 'harassed', 'harassment', 'groped', 'touched her', 'touched him',
      'touched a female', 'touched a male', 'inappropriately', 'malicious remarks', 'catcall', 'catcalled',
      'lewd', 'hinipuan', 'manyak'], 'sexual harassment'],
    [['indecent', 'immoral', 'sexual activity', 'caught having sex', 'exposed himself'], 'indecent immoral'],
    [['gamble', 'gambling', 'gambled', 'cards', 'card game', 'bet', 'bets', 'betting', 'tong its',
      'tongits', 'pusoy', 'mahjong', 'sabong', 'e sabong', 'sugal', 'nagsugal', 'for money'], 'gambling bets'],
    [['selling', 'sold', 'sell', 'sells', 'vending', 'tinda', 'nagtitinda', 'nagbebenta', 'paluwagan'],
      'selling business private goods'],
    [['borrowed money from the client', 'borrowed from the client', 'utang sa kliyente'], 'borrowing client'],
    [['borrowed money from his subordinate', 'borrowed from his technician', 'borrowed from a subordinate',
      'lent money at interest', '5-6', 'five six'], 'borrowing subordinate'],
    [['obscene', 'pornographic', 'defamatory post', 'posted on facebook', 'social media post'],
      'obscene publishing social media'],
    [['planted', 'framed', 'false complaint', 'fabricated evidence'], 'planting fabricating evidence false complaint'],
    [['refused to cooperate', 'obstructed', 'did not cooperate with the investigation', 'destroyed evidence',
      'coached the witness'], 'obstructing investigation cooperate'],
    [['retaliated', 'retaliation', 'got back at', 'revenge', 'punished him for reporting',
      'punished her for reporting', 'ganti', 'gumanti'], 'retaliating retaliation'],
    [['fined', 'fine of', 'charged a fine', 'deducted from his pay', 'deducted from her pay',
      'informal punishment', 'punished outside', 'outside the code'], 'fine penalty informal sanction'],
    [['favoritism', 'favouritism', 'favored', 'favoured', 'biased', 'palakasan'],
      'favouritism partiality'],
    [['did not evaluate', 'no evaluation', 'performance review'], 'performance evaluations'],
    [['did not supervise', 'failed to supervise', 'poor supervision'], 'supervise'],
    [['did not tell the team', 'did not disseminate', 'did not inform the team', 'did not brief'],
      'disseminate subordinates'],
    [['preventive suspension'], 'preventive suspension'],
    [['ordered him to', 'ordered her to', 'instructed him to', 'told his technician to'], 'directing subordinate'],
  ];

  // Offenses about how a SUPERVISOR handled something only apply where the narrative is
  // about a supervisor. Without this, "touched a co-worker and made sexual remarks" ranks
  // "concealing a report of sexual harassment" first -- it shares every distinctive word.
  const SUPERVISOR_CATEGORY = 'Accountability of Supervisors and Managers';
  const SUPERVISOR_CUE = /supervisor|manager|team leader|foreman|lead tech|head of|his technician|her technician|subordinate|failed to act|did not act|ignored the report|covered up|concealed the report|as supervisor/i;

  // ---------------------------------------------------------------- facts
  const NUMBER_WORDS = {
    one: 1, once: 1, two: 2, twice: 2, three: 3, thrice: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30,
    isa: 1, dalawa: 2, tatlo: 3, apat: 4, lima: 5, anim: 6, pito: 7, walo: 8, siyam: 9, sampu: 10,
  };

  function numberBefore(text, unitPattern) {
    let best = null;
    const numRe = new RegExp('(\\d[\\d,]*(?:\\.\\d+)?|\\b(?:' + Object.keys(NUMBER_WORDS).join('|') + ')\\b)\\s*(?:\\(\\d+\\)\\s*)?' +
      '(?:na\\s+|ng\\s+|consecutive\\s+|straight\\s+|working\\s+|calendar\\s+|whole\\s+|full\\s+)*' + unitPattern, 'gi');
    let m;
    while ((m = numRe.exec(text))) {
      const raw = m[1].toLowerCase();
      const n = NUMBER_WORDS[raw] !== undefined ? NUMBER_WORDS[raw] : parseFloat(raw.replace(/,/g, ''));
      if (!isNaN(n) && (best === null || n > best)) best = n;
    }
    return best;
  }

  function pesoAmount(text) {
    let best = null;
    const res = [
      /(?:₱|php|\bp)\s?(\d[\d,]*(?:\.\d+)?)(?:\s?(k|thousand))?/gi,
      /(\d[\d,]*(?:\.\d+)?)\s?(k|thousand)?\s*(?:pesos|peso|piso)/gi,
      /(?:worth|amounting to|costing|cost of|loss of|damage of|repair cost|halagang)\s*(?:₱|php|p)?\s?(\d[\d,]*(?:\.\d+)?)(?:\s?(k|thousand))?/gi,
    ];
    for (const re of res) {
      let m;
      while ((m = re.exec(text))) {
        let n = parseFloat(m[1].replace(/,/g, ''));
        if (m[2]) n *= 1000;
        if (!isNaN(n) && (best === null || n > best)) best = n;
      }
    }
    return best;
  }

  function extractFacts(text) {
    const t = canonicalize(text).toLowerCase();
    const has = (re) => re.test(t);
    const times = (() => {
      const n = numberBefore(t, '(?:times|beses|occasions|instances|x)\\b');
      if (n !== null) return n;
      if (/\bthrice\b/.test(t)) return 3;
      if (/\btwice\b/.test(t)) return 2;
      if (/\bonce\b/.test(t)) return 1;
      return null;
    })();
    // Negation first: "no one was seriously hurt" must not read as a serious injury.
    const noSeriousInjury = has(/no one was (?:seriously )?(?:hurt|injured)|nobody was (?:seriously )?(?:hurt|injured)|no (?:serious )?injur|not seriously (?:hurt|injured)|without (?:serious )?injur|walang nasugatan|walang nasaktan|minor (?:scratch|bruise)/);
    const noDamage = has(/no damage|without (?:any )?damage|not damaged|undamaged|walang nasira|nothing was damaged/);
    return {
      days: numberBefore(t, '(?:days?|araw)\\b'),
      minutes: numberBefore(t, '(?:minutes?|mins?|minuto)\\b'),
      times: times,
      pesos: pesoAmount(t),
      consecutive: has(/consecutive|straight|in a row|magkakasunod|sunod-sunod/),
      noNotice: has(/without (?:any )?(?:notice|calling|informing|telling)|no (?:notice|call|text)|gave no notice|did not (?:call|inform|text|notify|tell)|didn't (?:call|inform|text|notify|tell)|walang paalam|hindi nagpaalam|no call,? no show|no-show/),
      gaveNotice: has(/(?:informed|notified|called|texted|messaged) (?:his |her |the )?(?:supervisor|hr|office|manager)|gave (?:prior |advance |timely )?notice|nagpaalam|called in sick|called in on time/),
      legitReason: has(/\bsick\b|\bill\b|illness|emergency|hospital|valid reason|legitimate reason|fever|nagkasakit|may sakit/),
      leaveFormNotFiled: has(/(?:did not|didn't|failed to|forgot to|never) file (?:the |a |his |her )?leave|no leave form|hindi nag-?file|without filing (?:a |the )?leave/),
      cannotContact: has(/(?:cannot|can't|could not|couldn't|unable to) (?:be )?(?:reach|contact)|unreachable|cannot be located|hindi (?:makontak|ma-?contact)|no response to (?:calls|messages)/),
      notReturning: has(/went home to (?:the|his|her) province|no intention|not coming back|will not return|won't return|did not return after (?:his|her) leave|didn't return after|abandon/),
      weapon: has(/knife|\bgun\b|firearm|pistol|\bbolo\b|weapon|blade|patalim|baril|balisong|ice pick/),
      fearOfHarm: has(/in (?:immediate )?fear|feared for (?:his|her|their) (?:life|safety)|afraid for (?:his|her|their) (?:life|safety)|terrified|natakot/),
      seriousInjury: !noSeriousInjury && has(/seriously injured|fracture|hospitali[sz]ed|confined|serious(?:ly)? (?:injur|hurt|wound)|lost consciousness|unconscious|surgery/),
      injury: !noSeriousInjury && has(/injur|hurt|wound|bleed|bruise|sugat|nasugatan|nasaktan/),
      noSeriousInjury: noSeriousInjury,
      instigator: has(/started the (?:fight|argument)|instigat|provoked|aggressor|threw the first punch|hit (?:him|her) first|he started it|she started it|attacked first|nagsimula ng away/),
      damage: !noDamage && has(/damag|broke|broken|\bdent|hit a (?:post|wall|car|vehicle)|crash|collid|burn|destroy|cracked|nasira|sinira|bumped|sideswip/),
      noDamage: noDamage,
      recovered: has(/recovered|stopped (?:him|her|them) at the gate|caught at the gate|returned (?:it|them|the)|was returned|were returned|nabawi|ibinalik/),
      takenAway: has(/took (?:it|them) home|brought (?:it|them) home|never recovered|not recovered|still missing|was lost|were lost|sold (?:it|them)|nawala/),
      afterWarning: has(/after (?:a |being given a |receiving a |being issued a )?(?:written )?warning|already (?:been )?warned|despite (?:a |the |his |her )?(?:written )?warning|previously warned/),
      unintentional: has(/forgot|forgotten|unintentional|by mistake|accidentally|nakalimutan|hindi sinasadya/),
      habitual: has(/habitual|repeatedly|again and again|several times|many times|numerous times|paulit-?ulit|always late/),
      safetyCritical: has(/while driving|at height|rooftop|roof top|scaffold|ladder|energi[sz]ed|live wire|high voltage|pressuri[sz]ed/),
      clientLost: has(/client (?:cancel|terminat|pulled out|ended the contract|left)|lost the (?:account|client|contract)|contract (?:was )?(?:cancel|terminat)|nawalan ng kliyente/),
    };
  }

  // ---------------------------------------------------------------- tiers
  // Each family is one subject the Code grades by severity. `decide` returns the code the
  // facts point to, 'below' where the facts fall under the Code's threshold, or null where
  // the deciding fact is missing. `base` is the tier for the core conduct alone, listed
  // first when undecided; `ask` is the fact that would decide it.
  const peso = (n) => '₱' + Number(n).toLocaleString('en-PH');
  const TIERS = [
    {
      members: ['late-leave-filing', 'simple-absence', 'excessive-absence', 'abandonment'],
      base: 'simple-absence',
      decide(f) {
        if ((f.days !== null && f.days >= 5) || (f.cannotContact && f.notReturning)) {
          return ['abandonment', f.days !== null && f.days >= 5
            ? f.days + ' days absent is 5 or more — the abandonment tier. Abandonment also requires a clear intention not to return, so the NTE must allege that as well.'
            : 'Cannot be contacted, with indications of not returning — the abandonment tier.'];
        }
        if (f.days !== null && f.days >= 2) return ['excessive-absence', f.days + ' days absent falls in the 2 to 4 consecutive working days tier.'];
        if (f.gaveNotice && f.legitReason && f.leaveFormNotFiled) {
          return ['late-leave-filing', 'Notice was given and there was a legitimate reason; only the leave form was missed — the lightest absence tier.'];
        }
        if (f.days === 1 || f.noNotice) return ['simple-absence', 'One working day without approved leave and without notice.'];
        return null;
      },
      ask: 'State how many consecutive working days the employee was absent, and whether they gave notice — the Code grades absence by both.',
    },
    {
      members: ['excessive-tardiness-count', 'excessive-tardiness'],
      base: 'excessive-tardiness-count',
      decide(f) {
        if (f.minutes !== null && f.minutes >= 300) return ['excessive-tardiness', f.minutes + ' minutes of tardiness in the month meets the 300-minute threshold.'];
        if (f.times !== null && f.times >= 4) return ['excessive-tardiness-count', 'Late ' + f.times + ' times meets the threshold of 4 or more times in a calendar month.'];
        if ((f.times !== null && f.times < 4) || (f.minutes !== null && f.minutes < 300)) {
          return ['below', 'Below the Code’s threshold: tardiness is an offense only at 4 or more times, or 300 or more minutes, in one calendar month. Record it, but on these facts there is nothing to charge yet.'];
        }
        return null;
      },
      ask: 'State how many times the employee was late this calendar month, or the total minutes — tardiness is only an offense at 4 or more times, or 300 or more minutes.',
    },
    {
      members: ['undertime'],
      base: 'undertime',
      decide(f) {
        if (f.times !== null && f.times >= 2) return ['undertime', 'Undertime ' + f.times + ' times meets the threshold of twice or more in a month.'];
        if (f.times === 1) return ['below', 'Below the Code’s threshold: undertime is an offense only when it happens twice or more in one calendar month.'];
        return null;
      },
      ask: 'State how many times this happened in the calendar month — undertime is only an offense at twice or more.',
    },
    {
      members: ['repeated-failure-punch', 'refusal-punch'],
      base: 'repeated-failure-punch',
      decide(f) {
        if (f.afterWarning) return ['refusal-punch', 'Continued after a written warning for the same conduct.'];
        if (f.times !== null && f.times >= 3) return ['repeated-failure-punch', 'Missed ' + f.times + ' times meets the threshold of 3 or more times in a month.'];
        if (f.times !== null && f.times < 3) return ['below', 'Below the Code’s threshold: an unintentional missed log is an offense only at 3 or more times in one calendar month. The hours actually worked must still be paid through a Time Correction Form.'];
        return null;
      },
      ask: 'State how many times the log was missed this month, and whether a written warning was already given for it.',
    },
    {
      members: ['negligence-minor-loss', 'negligence-major-loss', 'gross-habitual-neglect'],
      base: 'negligence-minor-loss',
      decide(f) {
        if (f.seriousInjury) return ['gross-habitual-neglect', 'Negligence that caused a serious physical injury is in the gravest tier regardless of amount.'];
        if (f.pesos !== null && f.pesos > 30000) return ['gross-habitual-neglect', 'A loss of ' + peso(f.pesos) + ' is above ₱30,000.'];
        if (f.habitual) return ['gross-habitual-neglect', 'Described as habitual — gross and habitual neglect. The NTE should set out each of the repeated instances.'];
        if (f.pesos !== null && f.pesos > 5000) return ['negligence-major-loss', 'A loss of ' + peso(f.pesos) + ' is above ₱5,000 and not above ₱30,000.'];
        if (f.pesos !== null || f.noDamage) return ['negligence-minor-loss', f.pesos !== null ? 'A loss of ' + peso(f.pesos) + ' is not above ₱5,000.' : 'No loss resulted.'];
        return null;
      },
      ask: 'State the amount of the loss in pesos, or that there was none — negligence is graded at ₱5,000 and ₱30,000.',
    },
    {
      members: ['carelessness-minor-loss', 'carelessness-major-loss', 'carelessness-severe-loss'],
      base: 'carelessness-minor-loss',
      decide(f) {
        if (f.pesos !== null && f.pesos > 30000) return ['carelessness-severe-loss', 'A loss of ' + peso(f.pesos) + ' is above ₱30,000.'];
        if (f.pesos !== null && f.pesos > 5000) return ['carelessness-major-loss', 'A loss of ' + peso(f.pesos) + ' is above ₱5,000 and not above ₱30,000.'];
        if (f.pesos !== null || f.noDamage) return ['carelessness-minor-loss', f.pesos !== null ? 'A loss of ' + peso(f.pesos) + ' is not above ₱5,000.' : 'No loss resulted.'];
        return null;
      },
      ask: 'State the amount of the loss in pesos, or that there was none — misuse of property is graded at ₱5,000 and ₱30,000.',
    },
    {
      members: ['unauthorized-vehicle-no-damage', 'unauthorized-vehicle-with-damage'],
      base: 'unauthorized-vehicle-no-damage',
      decide(f) {
        if (f.damage || f.injury) return ['unauthorized-vehicle-with-damage', 'Damage or injury resulted.'];
        if (f.noDamage) return ['unauthorized-vehicle-no-damage', 'No damage or injury resulted.'];
        return null;
      },
      ask: 'State whether the vehicle was damaged or anyone was injured.',
    },
    {
      members: ['reckless-driving-no-damage', 'reckless-driving-with-damage'],
      base: 'reckless-driving-no-damage',
      decide(f) {
        if (f.damage || f.injury) return ['reckless-driving-with-damage', 'Damage or injury resulted.'];
        if (f.noDamage) return ['reckless-driving-no-damage', 'No damage or injury resulted.'];
        return null;
      },
      ask: 'State whether the vehicle was damaged or anyone was injured.',
    },
    {
      members: ['attempted-removal-no-loss', 'attempted-removal-with-loss'],
      base: 'attempted-removal-no-loss',
      decide(f) {
        if (f.recovered) return ['attempted-removal-no-loss', 'The property was recovered and no loss resulted.'];
        if (f.takenAway) return ['attempted-removal-with-loss', 'The property was taken away or lost.'];
        return null;
      },
      ask: 'State whether the property was recovered, or taken away and lost.',
    },
    {
      members: ['fighting-on-premises', 'fighting-aggravated'],
      base: 'fighting-on-premises',
      decide(f) {
        const why = [f.seriousInjury && 'a serious injury resulted', f.weapon && 'a weapon was used', f.instigator && 'the employee started it'].filter(Boolean);
        if (why.length) return ['fighting-aggravated', 'Aggravated because ' + why.join(', ') + '.'];
        if (f.noSeriousInjury && !f.weapon) return ['fighting-on-premises', 'No serious injury and no weapon. If the employee started the fight, it is Class D instead — state who started it.'];
        return null;
      },
      ask: 'State whether anyone was seriously injured, whether a weapon was used, and who started the fight — any one of those makes it Class D.',
    },
    {
      members: ['threat-of-harm', 'threat-with-weapon'],
      base: 'threat-of-harm',
      decide(f) {
        if (f.weapon) return ['threat-with-weapon', 'A weapon was carried or brandished.'];
        if (f.fearOfHarm) return ['threat-with-weapon', 'Made in a manner that placed the person in immediate fear of serious harm.'];
        return null;
      },
      ask: 'State whether the employee carried or showed a weapon, or made the threat in a way that put the person in immediate fear of serious harm — either makes it Class D.',
    },
    {
      members: ['horseplay-no-loss', 'horseplay-with-loss'],
      base: 'horseplay-no-loss',
      decide(f) {
        if (f.damage || f.injury) return ['horseplay-with-loss', 'Loss, damage or injury resulted.'];
        return ['horseplay-no-loss', 'No loss, damage or injury is described.'];
      },
      ask: '',
    },
    {
      members: ['gross-discourtesy', 'gross-discourtesy-client-loss'],
      base: 'gross-discourtesy',
      decide(f) {
        if (f.clientLost) return ['gross-discourtesy-client-loss', 'The client account was lost or seriously damaged.'];
        return ['gross-discourtesy', 'No loss of the client account is described.'];
      },
      ask: '',
    },
  ];

  // A family's tier logic only runs when the narrative is actually about that subject.
  // Without the gate, the word "knife" in a report about bringing one to site sets the
  // weapon fact, and the aggravated-FIGHTING tier gets pulled up with nothing about a fight.
  const FAMILY_RELEVANCE = 0.45;

  // ---------------------------------------------------------------- index
  const cache = new WeakMap();

  function buildIndex(catalog) {
    if (cache.has(catalog)) return cache.get(catalog);
    const docs = [];
    for (const cat of catalog || []) {
      for (const o of cat.offenses || []) {
        const set = new Set(stems(o.label + ' ' + (o.labelFil || '')));
        docs.push({ offense: o, category: cat.category, categoryFil: cat.categoryFil || '', stems: set });
      }
    }
    const df = new Map();
    docs.forEach(d => d.stems.forEach(s => df.set(s, (df.get(s) || 0) + 1)));
    const N = docs.length || 1;
    const idf = (s) => Math.log(1 + N / (df.get(s) || N));
    const avgLen = docs.reduce((a, d) => a + d.stems.size, 0) / N;
    const idx = { docs, idf, avgLen, byCode: new Map(docs.map(d => [d.offense.code, d])) };
    cache.set(catalog, idx);
    return idx;
  }

  // The narrative's own words, and the Code vocabulary they map to. Each carries the
  // phrase that produced it -- so a suggestion can say why -- and a weight: a subject
  // recognised through the vocabulary counts fully, a raw word less, a scene word least.
  function expandNarrative(text) {
    const canon = canonicalize(text);
    const lower = ' ' + canon.toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ') + ' ';
    const out = new Map();
    const put = (s, src, w) => {
      const prev = out.get(s);
      if (!prev || w > prev.w) out.set(s, { src: src, w: w });
    };
    for (const w of words(canon)) {
      if (STOP.has(w) || /^\d+$/.test(w)) continue;
      const s = stemWord(w);
      put(s, w, SCENE.has(s) ? 0.2 : 0.6);
    }
    for (const [triggers, adds] of LEXICON) {
      for (const trig of triggers) {
        const esc = trig.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s-]+/g, '[\\s-]+');
        if (new RegExp('(?:^|[^a-z0-9])' + esc + '(?:[^a-z0-9]|$)').test(lower)) {
          for (const a of stems(adds)) put(a, trig, 1.0);
          break;
        }
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- suggest
  function suggest(catalog, text, opts) {
    opts = opts || {};
    const limit = opts.limit || 5;
    const idx = buildIndex(catalog);
    const facts = extractFacts(text);
    const narrative = expandNarrative(text);
    if (!narrative.size) return { suggestions: [], facts: facts, multiple: false };
    const aboutSupervisor = SUPERVISOR_CUE.test(text);

    const scored = idx.docs.map((d) => {
      let score = 0;
      let subject = false;
      const matched = new Set();
      d.stems.forEach((s) => {
        const hit = narrative.get(s);
        if (hit) {
          score += idx.idf(s) * hit.w;
          matched.add(hit.src);
          if (hit.w >= 1) subject = true;
        }
      });
      score = score / (0.6 + 0.4 * (d.stems.size / idx.avgLen));
      if (d.category === SUPERVISOR_CATEGORY && !aboutSupervisor) score *= 0.55;
      return { d, score, matched: [...matched], subject };
    }).filter(x => x.score > 0);

    const topRaw = scored.reduce((m, x) => Math.max(m, x.score), 0);
    const notes = new Map();

    for (const fam of TIERS) {
      const present = scored.filter(x => fam.members.indexOf(x.d.offense.code) !== -1);
      if (!present.length) continue;
      const best = present.reduce((a, b) => (b.score > a.score ? b : a));
      if (best.score < FAMILY_RELEVANCE * topRaw) continue;

      const promote = (code) => {
        let target = present.find(x => x.d.offense.code === code);
        if (!target && idx.byCode.has(code)) {
          target = { d: idx.byCode.get(code), score: 0, matched: best.matched.slice() };
          scored.push(target);
          present.push(target);
        }
        if (!target) return null;
        target.score = best.score + 0.01;
        if (!target.matched.length) target.matched = best.matched.slice();
        return target;
      };

      const decision = fam.decide(facts);
      if (decision && decision[0] === 'below') {
        const target = promote(fam.base) || best;
        notes.set(target.d.offense.code, { belowThreshold: decision[1] });
        present.forEach((x) => { if (x !== target) x.score *= 0.6; });
      } else if (decision) {
        const target = promote(decision[0]);
        if (target) {
          notes.set(decision[0], { tierReason: decision[1] });
          present.forEach((x) => { if (x !== target) x.score *= 0.35; });
        }
      } else {
        const target = promote(fam.base) || best;
        if (fam.ask) notes.set(target.d.offense.code, { needsFact: fam.ask });
        present.forEach((x) => { if (x !== target) x.score *= 0.6; });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.length ? scored[0].score : 0;

    const suggestions = scored.slice(0, limit).map((x, i) => {
      const o = x.d.offense;
      const n = notes.get(o.code) || {};
      // Sleeping on duty is Class B, but the Code itself treats it as Grave where the
      // employee is driving, at height, or monitoring energised or pressurised equipment.
      let klass = o.klass;
      let classNote = '';
      if (o.code === 'sleeping-on-duty' && facts.safetyCritical) {
        klass = 'C';
        classNote = 'Treated as Grave (Class C): the Code raises sleeping on duty where the employee is driving, at height, or monitoring energised or pressurised equipment.';
      }
      // Confidence has to be EARNED by a recognised subject -- a match through the Code
      // vocabulary, not a stray word. Measured on reports the matcher was never tuned
      // against, matches built only from raw overlap ("reported the missing tools" ->
      // failure to report a loss) were wrong far more often than right. Those are still
      // listed, but as low confidence, so HR is not handed a guess dressed as an answer.
      const rel = top ? x.score / top : 0;
      let confidence = 'low';
      if (x.subject) {
        if (i === 0 && x.score >= 1.6 && (x.matched.length >= 2 || n.tierReason || x.score >= 3)) confidence = 'high';
        else if (rel >= 0.6 && x.score >= 1.0) confidence = 'medium';
      }
      return {
        code: o.code, label: o.label, labelFil: o.labelFil || '', klass: klass, baseClass: o.klass,
        category: x.d.category, categoryFil: x.d.categoryFil,
        score: Math.round(x.score * 100) / 100, confidence: confidence, matched: x.matched.slice(0, 6),
        tierReason: n.tierReason || '', needsFact: n.needsFact || '', belowThreshold: n.belowThreshold || '',
        classNote: classNote,
      };
    });

    // Sec. 3.4: where one act violates more than one provision, only the highest penalty
    // is imposed. Flag it when the narrative strongly matches two different subjects.
    const strong = suggestions.filter(s => s.confidence !== 'low');
    const familyOf = (code) => TIERS.findIndex(f => f.members.indexOf(code) !== -1);
    const subjects = new Set(strong.map(s => { const fi = familyOf(s.code); return fi === -1 ? s.code : 'fam' + fi; }));
    const multiple = subjects.size >= 2 && strong.length >= 2 && strong[1].score >= 0.75 * strong[0].score;

    return { suggestions: suggestions, facts: facts, multiple: multiple };
  }

  const api = { suggest, extractFacts, _stem: stemWord, _expand: expandNarrative };
  root.OffenseMatcher = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
