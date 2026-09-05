const L = require('./lib.js');
const { C, run, p, gap, pageBreak, partHead, secHead, note, offenseTable, legend } = L;

// The 102 offense texts are NOT written out again here. They are read from
// fil-offenses.json, which is generated from the labelFil fields in the app's
// js/store.js -- the same strings My Portal shows an employee. Writing them twice would
// guarantee the printed Filipino Code and the portal eventually disagreed about what an
// offense says; this way they cannot. Only the section introductions and the explanatory
// notes are authored here, because those exist in the document alone.
const DATA = require('./fil-offenses.json');

const byCategory = {};
DATA.forEach((c) => { byCategory[c.category] = c.offenses; });

// note text keyed by offense code, so a note stays attached to its offense no matter
// where the severity sort moves the row
const NOTES = {
  'excessive-tardiness-count': 'Ang oras na talagang nawala ay ibabawas sa sahod sa karaniwang paraan. Hindi iyon parusa at hindi nito papalitan ang aksyong disiplinaryo.',
  abandonment: 'Kailangang MAY DALAWA: walang katuwirang hindi pagpasok AT malinaw na balak nang hindi na bumalik. Bago ituring na abandonment, magpapadala ang HRD ng sulat sa huling kilalang address mo sa pamamagitan ng registered mail o courier, at bibigyan ka ng buong panahon para sumagot. Ang pagliban lang, gaano man katagal, ay hindi abandonment kung nagpaliwanag ka o sinisikap mong bumalik.',
  'punching-others-timecard': 'Pareho kayong may pananagutan. Kung minsanan lang ito, walang napakinabangan, at kusa ninyong sinabi bago pa matuklasan, puwedeng isaalang-alang ng Panel ang pagpapagaan sa ilalim ng Seksyon 3.5.',
  'benefiting-falsified-timecards': 'Hindi mananagot ang empleyadong agad nag-report ng sobrang bayad at ibinalik ito.',
  'failure-report-accident': 'Ang mabigat na parusa ay pumipigil sa mismong pag-report na layunin ng patakarang ito. Ang mabilis at tapat na pag-report ng insidenteng ikaw mismo ang nagkamali ay ituturing na pampagaan.',
  'concealing-communicable-disease': 'Tingnan ang Seksyon 5.10 tungkol sa hindi pagtatangi sa kalusugan.',
  'prohibited-drugs': 'Susundin ang proseso at proteksyon sa Seksyon 5.8, kasama ang referral sa gamutan kung nararapat.',
  'conviction-crime': 'Ang nakabinbing kaso ay hindi pa hatol. Kung ang mismong gawa ay paglabag na rin sa Code na ito, puwedeng kumilos ang kompanya sa batayang iyon.',
  'phone-unreachable': 'Tingnan ang Seksyon 3.12.',
  'negligence-minor-loss': L.pick('Sa dating edisyon, ₱200 ang simula ng hangganang ito. Hindi na makabuluhang halaga iyon ngayon.', null),
  'gross-habitual-neglect': 'Sa ilalim ng Artikulo 297(b) ng Labor Code, kailangang MALUBHA at PAULIT-ULIT ang kapabayaan bago ito maging dahilan ng pagtanggal. Ang minsanang kapabayaan, gaano man kamahal, ay karaniwang sasailalim sa mas magaang hangganan sa itaas maliban kung sobrang pagpapabaya na ito.',
  insubordination: 'Tatlong bagay ang kailangang mapatunayan: legal at makatuwiran ang utos, ipinaalam ito sa iyo, at may kinalaman ito sa trabahong pinasok mo. Ang pagtanggi sa iligal na utos, o sa trabahong may agarang panganib, ay hindi pagsuway.',
  'undeclared-sideline': 'Ang pagdeklara ay nasa Seksyon 2.3.',
  bullying: 'Ang minsanang malubhang insidente ay puwedeng ituring na pambu-bully kung ganoon din ang bigat ng epekto. Ang tamang pamamahala sa performance, pagwawasto, at disiplina ay hindi pambu-bully.',
  'fighting-on-premises': L.pick(
    'Sa dating edisyon, tanggal agad sa unang beses. Sa edisyong ito, nakalaan ang pagtanggal sa mas mabibigat na anyo sa ibaba. Kung nagtatanggol ka lang talaga sa sarili, walang parusa.',
    // Ang panuntunan sa pagtatanggol sa sarili ay nasa mismong teksto ng paglabag
    // (labelFil), kaya walang mawawala kapag inalis ang tala rito.
    null),
  'physical-injury-work-related': 'Kung magaan ang sugat, minsanan lang ang pangyayari, at may malaking pang-uudyok, puwedeng isaalang-alang ng Panel ang pagpapagaan sa ilalim ng Seksyon 3.5.',
  'immoral-conduct': 'Ang Committee on Decorum and Investigation sa Seksyon 5.9 ang humahawak nito, hindi ang karaniwang Panel. Ang mas magagaang gender-based na gawi sa ilalim ng RA 11313 ay may sariling hagdan ng parusa na nagsisimula sa Katamtaman.',
  gambling: L.pick('Sa dating edisyon, tanggal agad sa unang beses.', null),
  'soliciting-from-subordinates': L.pick(
    'Sa dating edisyon, tanggal agad sa unang beses. Mabigat pa rin ito ngunit naitatama, maliban kung may pamimilit o pang-aabuso ng kapangyarihan — Seksyon 4.8 na ang gagamitin doon.',
    'Kung may pamimilit o pang-aabuso ng kapangyarihan, Seksyon 4.8 na ang gagamitin.'),
  intrigues: L.pick('Sa dating edisyon, 15-araw na suspensyon sa unang beses at tanggal sa ikalawa. Hindi katimbang iyon ng karaniwang pangyayari.', null),
  'gross-discourtesy': 'Ang malubha o paulit-ulit na kawalang-galang na ikinawala ng account ng kliyente ay hiwalay na paglabag sa ibaba.',
};

// The labels come from the app, where caveats are written into the label itself. A note
// that merely restates its own row is noise, so warn at build time rather than let it
// print twice on the page.
const normWords = (s) => new Set(
  String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ')
    .split(' ').filter((w) => w.length > 4));

const rowsFor = (cat) => byCategory[cat].map((o) => {
  const n = NOTES[o.code] || null;
  if (n) {
    const label = normWords(o.labelFil);
    const words = [...normWords(n)];
    const overlap = words.length
      ? words.filter((w) => label.has(w)).length / words.length : 0;
    if (overlap > 0.6) {
      console.warn('  WARNING: note for "' + o.code + '" repeats ' +
        Math.round(overlap * 100) + '% of its own offense text');
    }
  }
  return [o.labelFil, o.klass, n];
});

const part4 = () => [
  ...partHead('BAHAGI IV', 'Talaan ng mga Paglabag'),

  p('Nakalista sa Bahaging ito ang mga paglabag na kinikilala ng TXTAIRE OPC, at ang uri ng bawat isa. Ang parusa sa bawat uri ay nakasaad nang isang beses lamang, sa Seksyon 3.4, at inuulit sa maliit na gabay sa itaas ng bawat talaan. Bago magpataw ng anumang parusa, basahin ang Seksyon 3.5 tungkol sa mga pampagaan at pampabigat na pangyayari, at sundin ang proseso sa Seksyon 3.6.'),
  p('Layunin ng listahang ito na maging kumpleto para sa karaniwang gawain ng kompanya. Kung may gawang talagang hindi saklaw, Seksyon 3.13 ang masusunod.'),

  // ---------------------------------------------------------------- 4.1
  secHead('4.1  Mga Paglabag sa Attendance at Pagiging Maagap'),
  p('Inaasahan sa bawat empleyado ang regular at maagap na pagpasok. Ang leave application ay dapat isumite at maaprubahan dalawang (2) araw ng trabaho bago ang inaasahang pagliban. Kung hindi inaasahan ang pagliban — sakit, aksidente, emergency sa pamilya, kalamidad — dapat ipaalam agad sa supervisor, at hindi lalagpas sa dalawang (2) oras mula sa simula ng shift, sa kahit anong paraan, at i-file ang leave form sa unang araw ng balik.'),
  p('MAY DAHILAN ang pagliban kung nagpaalam ka at totoo ang dahilan, kahit na-late ang pag-file ng leave form. WALANG PAHINTULOT ang pagliban kung wala kang paalam at walang totoong dahilan. Mahalaga ang pagkakaiba, at hindi dapat ituring ng HRD na walang pahintulot ang pagliban na may dahilan dahil lang na-late ang papeles.'),
  legend(),
  offenseTable(rowsFor('Attendance and Punctuality')),
  gap(160),
  note('Tungkol sa grace period at pagiging huli', [
    'Ginawang labinlimang (15) minuto ang grace period mula sa dating sampu (10), bilang pagkilala sa trapiko na hinaharap ng mga empleyadong pumapasok sa Laguna, Maynila, at sa mga site ng kliyente. Ang grace period ay pabor, hindi karapatang mahuli araw-araw. Ang bilang ng pagiging huli ay mula sa opisyal na simula ng shift, hindi mula sa katapusan ng grace period.',
    ...L.hrOnly('Sa dating edisyon, 260 minuto sa isang buwan ang sobrang late, at ang paglagpas sa apat na beses ay parusahan ngunit hindi sinasabi kung ano ang parusa. Sinasabi na ng edisyong ito ang parehong hangganan at ang uri.'),
  ]),

  // ---------------------------------------------------------------- 4.2
  secHead('4.2  Mga Paglabag sa Time Record at Dokumento'),
  p('Ang tumpak na time record at service report ang batayan ng sahod ng bawat empleyado at ng singil sa bawat kliyente. Ang tunay na pagkakamali sa time record ay usaping klerikal. Ang sadyang pagpeke nito ay pandaraya.'),
  legend(),
  offenseTable(rowsFor('Timekeeping and Records')),

  // ---------------------------------------------------------------- 4.3
  secHead('4.3  Mga Paglabag sa Kalusugan, Kaligtasan, at Seguridad'),
  p('Ang trabaho ng kompanya ay may kinalaman sa kuryente, refrigerant na may presyon, umiikot na makina, at mataas na plataporma — kaya ang mga patakaran sa kaligtasan dito ay hindi basta papeles. Sa ilalim ng Republic Act No. 11058 at Department Order No. 198-18, may karapatan ang bawat manggagawang tumanggi sa delikadong trabaho, at walang empleyadong paparusahan sa paggamit ng karapatang iyon nang may magandang loob.'),
  legend(),
  offenseTable(rowsFor('Health, Safety and Security')),

  // ---------------------------------------------------------------- 4.4
  secHead('4.4  Mga Paglabag sa Performance sa Trabaho'),
  p('Magkaiba ang mahinang performance at ang maling asal. Ang tunay na kakulangan sa kakayahan ay tinutugunan sa pamamagitan ng pagtuturo, training, at nakasulat na plano sa pagpapabuti sa ilalim ng Seksyon 6.2 — hindi sa pamamagitan ng Bahaging ito. Ang Seksyong ito ay tungkol sa asal: ang hindi paggawa ng trabahong kaya mong gawin, ang pagpapabaya rito, o ang pagtanggi rito.'),
  legend(),
  offenseTable(rowsFor('Job Performance')),

  // ---------------------------------------------------------------- 4.5
  secHead('4.5  Mga Paglabag sa Ari-arian ng Kompanya at Kliyente'),
  p('Ang mga parusa sa Seksyong ito ay hindi humahadlang sa pagbabayad ng pinsala, na nasa Seksyon 3.12. Ang halaga ng pinsala ay ang tunay at napatunayang gastos sa pagkumpuni o pagpapalit — hindi presyo sa listahan at hindi tantiya na walang inspeksyon. Kung pinagtatalunan ang halaga, ang kompanya ang may pananagutang patunayan ito.'),
  legend(),
  offenseTable(rowsFor('Company and Client Property')),

  // ---------------------------------------------------------------- 4.6
  secHead('4.6  Mga Paglabag sa Katapatan'),
  p('Ipinagkakatiwala ng kompanya sa mga empleyado ang pera, materyales, record ng kliyente, at ang sarili nitong pangalan. Sinisira ng kawalan ng katapatan ang tiwalang pinagsasaligan ng trabaho, kaya ang mga paglabag sa Seksyong ito ay itinuturing na napakabigat. Hindi ito basta-basta: tingnan ang paalala sa dulo ng Seksyong ito.'),
  legend(),
  offenseTable(rowsFor('Honesty and Integrity')),
  gap(160),
  note('Pagiging katimbang sa mga kaso ng kawalan ng katapatan', [
    'Itinuturing na mabigat ang kawalan ng katapatan, at pagtanggal ang karaniwang parusa. Ngunit paulit-ulit nang binawi ng Korte Suprema ang mga pagtanggal kung maliit lamang ang halagang sangkot, mahaba at malinis ang serbisyo ng empleyado, at walang tunay na masamang loob.',
    'Kaya dapat isaalang-alang at itala ng HRD at ng Panel sa Case Evaluation Form: ang halaga o bagay na sangkot; kung ang empleyado ay may posisyon ng tiwala; kung may pagtatago; kung kusang nagbayad bago pa matuklasan; at ang haba at kalidad ng serbisyo niya.',
    'Kung sa palagay ng Panel ay nararapat ang parusang mas mababa sa pagtanggal, kailangang isulat nila ito kasama ang dahilan, at ang May-ari o General Manager ang magdedesisyon. Ito ang eksepsiyon at kailangang may katwiran — ngunit kailangang manatiling posible, kung hindi ay magiging mismong bagay ang Code na ito na hinangad itamang ng edisyong ito.',
  ], { edge: C.blue, fill: 'EEF3FB', labelColor: C.navy }),

  // ---------------------------------------------------------------- 4.7
  secHead('4.7  Mga Paglabag sa Asal at Ugali'),
  p('Magkakasama ang mga empleyado sa masikip na lugar, sa gusali ng mga kliyente, at madalas ay may hinahabol na oras. Ang pamantayang inaasahan ay karaniwang propesyonal na paggalang. Hindi layunin ng Seksyong ito na pakialaman ang ugali ng tao, ang karaniwang hindi pagkakasundo, o ang legal na pagreklamo tungkol sa kalagayan sa trabaho.'),
  legend(),
  offenseTable(rowsFor('Proper Conduct and Behavior')),

  // ---------------------------------------------------------------- 4.8
  secHead('4.8  Pananagutan ng mga Supervisor at Manager'),
  p('Ang mga supervisor at manager ay may hawak na posisyon ng tiwala. Saklaw sila ng parehong pamantayan tulad ng lahat, at ng mga karagdagang ito. Ang supervisor na gumawa ng paglabag sa Seksyon 4.1 hanggang 4.7 ay saklaw ng parehong uri, na ang posisyon niya ay ituturing na pampabigat sa ilalim ng Seksyon 3.5.'),
  legend(),
  offenseTable(rowsFor('Accountability of Supervisors and Managers')),
  gap(160),
  note('Para sa mga supervisor: tatlong bagay na madalas maling gawin', [
    'Una, ang hindi opisyal na parusa. Ang pagpapauwi sa isang tao, pagbawas ng overtime niya, o paglipat sa mas mabigat na assignment dahil sa may ginawa siya ay parusang ipinataw nang walang tamang proseso. I-report ito sa HRD at hayaang tumakbo ang proseso.',
    'Pangalawa, ang pagkaantala. Ang animnapung (60) araw na palugit sa Seksyon 3.11 ay nagsisimula sa sandaling IKAW ay nakaalam. Ang pag-upo sa isang report ay puwedeng mag-alis sa karapatan ng kompanyang kumilos dito.',
    'Pangatlo, ang malabong sulat. Ang "nagpabaya ka sa tungkulin mo" ay hindi Notice to Explain. Isulat ang gawa, ang petsa, ang lugar, at ang patakarang nalabag — kung hindi, babagsak ang buong kaso sa proseso gaano ka man katama sa mga pangyayari.',
  ], { edge: C.blue, fill: 'EEF3FB', labelColor: C.navy }),
];

module.exports = { part4, NOTES };
