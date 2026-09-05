const L = require('./lib.js');
const { d, C, run, p, gap, secHead, subHead, cell, tCell, table, note, CHG } = L;

const markerLegend = () => {
  const LW = [1700, 8046];
  const row = (kind, meaning) => new d.TableRow({
    cantSplit: true,
    children: [
      cell(new d.Paragraph({
        alignment: d.AlignmentType.CENTER, spacing: { after: 0 },
        children: [new d.TextRun({
          text: ' ' + CHG[kind].text + ' ', font: L.F, size: 15, bold: true,
          color: CHG[kind].fg, shading: { type: d.ShadingType.CLEAR, fill: CHG[kind].bg, color: 'auto' },
        })],
      }), { w: LW[0] }),
      tCell(meaning, { w: LW[1], va: d.VerticalAlign.CENTER }),
    ],
  });
  return table([
    new d.TableRow({
      cantSplit: true,
      children: [
        tCell('MARKA', { w: LW[0], bold: true, color: 'FFFFFF', fill: C.blue, size: 18, align: d.AlignmentType.CENTER }),
        tCell('ANO ANG IBIG SABIHIN NITO', { w: LW[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
      ],
    }),
    row('new', 'Wala ang probisyong ito sa Series 1, 2025 Edition. Bago ito sa edisyong ito.'),
    row('rev', 'Umiiral ang probisyong ito sa dating edisyon ngunit malaki ang naging pagbabago — kadalasan ay mas magaan na parusa, naitamang legal na posisyon, o prosesong hindi binanggit ng dating edisyon.'),
    row('rem', 'Umiiral ang probisyong ito sa dating edisyon at inalis na. Kung may legal na kahihinatnan ang pag-alis, nakasaad nang buo ang dahilan sa Seksyon 3.12.'),
  ], LW);
};

const CMP_W = [2050, 3748, 3948];

const cmpHeader = (label) => new d.TableRow({
  cantSplit: true, tableHeader: true,
  children: [
    tCell(label, { w: CMP_W[0], bold: true, color: 'FFFFFF', fill: C.blue, size: 17 }),
    tCell('SERIES 1, 2025 EDITION', { w: CMP_W[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 17 }),
    tCell('SERIES 2, 2026 EDITION', { w: CMP_W[2], bold: true, color: 'FFFFFF', fill: C.blue, size: 17 }),
  ],
});

const cmpRow = (area, before, after, kind) => new d.TableRow({
  cantSplit: true,
  children: [
    cell([
      new d.Paragraph({ spacing: { after: kind ? 40 : 0, line: 240 }, children: [run(area, { size: 18, bold: true, color: C.navy })] }),
      ...(CHG[kind] ? [new d.Paragraph({
        spacing: { after: 0, line: 200 },
        children: [new d.TextRun({
          text: ' ' + CHG[kind].text + ' ', font: L.F, size: 12, bold: true,
          color: CHG[kind].fg, shading: { type: d.ShadingType.CLEAR, fill: CHG[kind].bg, color: 'auto' },
        })],
      })] : []),
    ], { w: CMP_W[0], va: d.VerticalAlign.TOP }),
    tCell(before, { w: CMP_W[1], va: d.VerticalAlign.TOP, size: 17 }),
    tCell(after, { w: CMP_W[2], va: d.VerticalAlign.TOP, size: 17 }),
  ],
});

const cmpTable = (label, rows) => table(
  [cmpHeader(label)].concat(rows.map(r => cmpRow(r[0], r[1], r[2], r[3]))), CMP_W);

const summaryOfChanges = () => [
  secHead('Buod ng mga Pagbabago', 'new'),
  p('Mapa ang seksyong ito ng kung ano ang nagbago sa pagitan ng Series 1, 2025 Edition at nito. Ibinibigay ito para makita ng HR, ng pamunuan, at ng sinumang tagasuri ang mga pagbabago nang hindi kailangang basahin nang magkatabi ang dalawang edisyon, at para makita nang malinaw ng mga empleyado na walang pagbabago rito na nakakasama sa kanila.'),
  p('Sa buong dokumentong ito, lumilitaw ang mga sumusunod na marka sa tabi ng isang Bahagi, ng pamagat ng seksyon, o ng isang paglabag:'),
  gap(60),
  markerLegend(),

  subHead('A.  Mga parusang pinagaan'),
  p('Bawat pagbabago sa pangkat na ito ay nagpapagaan sa empleyado. Wala rito ang nag-aalis sa kakayahan ng kompanyang kumilos; pinapalitan lamang ng bawat isa ang awtomatikong pagtanggal o ang napakahabang suspensyon ng unti-unting tugon.'),
  cmpTable('PAGLABAG', [
    ['Pakikipag-away sa loob ng kompanya', 'Tanggal agad sa unang beses.', 'Uri C — 7-araw na suspensyon, tapos 15 araw, tapos tanggal. Nananatili ang tanggal agad kung may malubhang sugat, may gamit na armas, o ikaw ang nanimula (Sek. 4.7).', 'rev'],
    ['Pagsusugal sa loob', 'Tanggal agad sa unang beses.', 'Uri B — sulat na babala, tapos 3 araw, 7 araw, tanggal (Sek. 4.7).', 'rev'],
    ['Intriga at masamang tsismis', '15-araw na suspensyon, tapos tanggal.', 'Uri B (Sek. 4.7).', 'rev'],
    ['Panghihiram o paghingi sa tauhan mo', 'Tanggal agad sa unang beses.', 'Uri C, maliban kung may pamimilit o pang-aabuso ng kapangyarihan — Sek. 4.8 na ang gagamitin doon (Sek. 4.7).', 'rev'],
    ['Hindi pag-report ng aksidente o delikadong kalagayan', '30-araw na suspensyon, tapos tanggal.', 'Uri B. Ang mabigat na parusa rito ay pumipigil sa mismong pag-report na layunin ng patakaran (Sek. 4.3).', 'rev'],
    ['Sadyang pagsuway sa utos sa kaligtasan', '30-araw na suspensyon, tapos tanggal.', 'Uri D kung inilalagay ang isang tao sa panganib ng kamatayan o malubhang sugat; Uri B kung hindi sinasadya at walang nasaktan (Sek. 4.3).', 'rev'],
    ['Pag-inom ng alak sa loob', '15-araw na suspensyon, tapos tanggal.', 'Uri C; Uri D lamang sa gawaing kritikal sa kaligtasan — pagmamaneho, trabaho sa mataas, may kuryente (Sek. 4.3).', 'rev'],
    ['Malubhang kawalang-galang', '15 araw, 30 araw, tapos tanggal.', 'Uri B sa kawalang-galang sa kliyente; Uri D lamang kung malubhang nasira ang account ng kliyente o ang pangalan ng kompanya (Sek. 4.7).', 'rev'],
    ['Kapabayaang may pinsala', 'Nagsisimula sa ₱200 ang hangganan.', 'Nagsisimula sa ₱5,000 at may hakbang sa ₱30,000. Hindi na makabuluhang halaga ang ₱200 (Sek. 4.4).', 'rev'],
    ['Pagsuway sa utos', '10 araw, 15 araw, tapos tanggal.', 'Uri C, at nakasaad na ngayon ang tatlong bagay na kailangang mapatunayan bago ituring na sinuway ang isang utos (Sek. 4.4).', 'rev'],
    ['Uniform, cellphone, kalinisan, pagiging huli', 'Iba-iba, may umaabot sa tanggal.', 'Lahat Uri A — babala muna ang pagwawasto (Sek. 4.1, 4.3, 4.4).', 'rev'],
    ['Pinakamahabang suspensyon', 'Hanggang 30 araw bilang parusa.', 'Hanggang 15 araw ng trabaho na lamang. Ang 30-araw na parusa ay nag-aanyaya ng constructive dismissal (Sek. 3.2).', 'rev'],
    ['Asal sa labas ng trabaho, malayo sa kompanya', 'Ang away sa labas na walang kinalaman sa trabaho ay 15 araw, tapos tanggal.', 'Wala nang saklaw ang Code dito, maliban kung may kinalaman sa trabaho, ginawa laban sa kompanya, kasamahan, o kliyente, o may nakikitang pinsala sa negosyo (Sek. 1.1).', 'rev'],
  ]),

  subHead('B.  Mga probisyong inalis dahil labag sa batas'),
  p('Bawat isa sa mga sumusunod ay nasa Series 1 Edition at inalis na. Nakasaad ang mga ito nang buo sa Seksyon 3.12 para nakatala ang dahilan.'),
  cmpTable('PROBISYON', [
    ['Hindi pagbabayad sa nakaligtaang time entry', 'Ang nakalimot mag-punch ay "ituturing na absent at walang sahod sa araw na iyon."', 'Inalis. Ang empleyadong talagang nagtrabaho ay dapat bayaran. Itinatama ang entry sa Time Correction Form na pipirmahan ng supervisor, at paglabag na Magaan lamang ito kung mayroon man (Sek. 3.12, Sek. 4.2).', 'rem'],
    ['Ang ₱500 multa at pagkuha ng cellphone', '₱500 multa at kukunin ang unit kung hindi masagot ang telepono ng kompanya.', 'Inalis. Ang multa ay wala sa mga bawas na pinapayagan ng Artikulo 113 ng Labor Code. Nananatili ang paglabag, bilang Uri A, ngunit walang multa (Sek. 3.12, Sek. 4.4).', 'rem'],
    ['Dalawang buwang sahod sa maikling paunawa ng pagbibitiw', 'Ang hindi nakapagbigay ng 30-araw na paunawa ay "mananagot sa liquidated damages na katumbas ng hindi bababa sa dalawang (2) buwang sahod."', 'Inalis. Kailangang patunayan ang tunay na pinsala sa tamang tanggapan. Hindi kailanman puwedeng ipagkait ang huling sahod at ang Certificate of Employment dahil maikli ang paunawa (Sek. 6.4).', 'rem'],
    ['On-the-spot na drug test', 'Puwedeng mag-test ang kompanya batay sa hinala at pilitin ang pagbibigay ng sample sa mismong sandali.', 'Inalis. Dumadaan ang pag-test sa laboratoryong akreditado ng DOH, may confirmatory test at may karapatang kuwestiyunin, ayon sa RA 9165 at DO 53-03 (Sek. 5.8).', 'rem'],
    ['Pagtanggal ng probationary kahit kailan', 'May "ganap na kapangyarihan ang kompanyang magtanggal kahit kailan."', 'Inalis. Kailangan ng malubha o awtorisadong dahilan na may tamang proseso, o ng hindi pag-abot sa pamantayang naipaalam nang nakasulat sa pagpasok, na may 5 araw na paunawa (Sek. 1.4).', 'rem'],
    ['Pagbabayad ng pinsala sa pamamagitan ng bawas', 'Ipinapalagay na puwedeng ibawas sa sahod.', 'Pinapayagan lamang kung may nakasulat na pahintulot ng empleyado, hanggang 20% ng net pay kada sahod, at hindi bababa sa minimum wage. Ang pagtangging pumayag ay hindi paglabag (Sek. 3.12).', 'rev'],
  ]),

  subHead('C.  Ano ang bago sa edisyong ito'),
  cmpTable('IDINAGDAG', [
    ['Bahagi II — Pamantayang Etikal', 'Walang pahayag ng pamantayang etikal ang dating edisyon.', 'Isang buong Bahagi: mga pagpapahalaga sa gawa, pamantayan sa pagnenegosyo, conflict of interest na may tungkuling ideklara, hangganang ₱1,000 sa regalo na bawal hingin, kompidensyalidad at Data Privacy Act, asal sa site ng kliyente, paggalang sa trabaho, social media, at daan ng pag-report na protektado laban sa paghihiganti.', 'new'],
    ['Sek. 3.4 — iisang Talaan ng Parusa', 'Nakasulat ang parusa kada paglabag, walang malinaw na sistema, kaya magkaibang parusa ang magkatulad na paglabag.', 'Apat na uri (A Magaan, B Katamtaman, C Mabigat, D Napakabigat) at iisang talaan ng parusa para sa buong Code. May uri lamang ang bawat paglabag.', 'new'],
    ['Sek. 3.5 — pampagaan at pampabigat', 'Wala. Mekanikal ang paggamit ng talaan.', 'Siyam na pampagaan at siyam na pampabigat, na may kapangyarihang magbago ng isang hakbang, at itatala nang nakasulat sa Case Evaluation Form.', 'new'],
    ['Sek. 3.6 — buong tamang proseso', 'Binanggit ang pagdinig, ngunit hindi ang mga sulat, ang laman nito, o ang panahon.', 'Nakalatag nang hakbang-hakbang ang panuntunan ng dalawang sulat ayon sa Artikulo 292(b) at DO 147-15: kung ano ang dapat nasa NTE, kahit 5 araw ng kalendaryo para sumagot, ang pagdinig, at ang sulat ng desisyon.', 'new'],
    ['Sek. 3.7 — panel na akma sa laki', 'Panel na 3 manager sa bawat kaso — hindi kayang gawin sa dalawampung empleyado.', 'Supervisor at HRD sa Uri A at B; tatlong miyembrong panel sa Uri C, Uri D, at anumang kasong may pagtanggal, na may tuntunin sa diskwalipikasyon.', 'rev'],
    ['Sek. 3.11 — palugit at paglilinis ng record', 'Hindi binanggit.', '60 araw para simulan ang proseso (isang taon sa pandaraya, kawalan ng katapatan, harassment, at karahasan), at nalilinis ang parusa pagkatapos ng 12 buwang malinis.', 'new'],
    ['Sek. 3.13 — karapatan ng empleyado', 'Hindi nakasaad.', 'Walong karapatang hindi puwedeng bawiin ng anumang probisyon ng Code, kasama ang karapatang magdala ng reklamo sa DOLE o NLRC nang walang gantihan.', 'new'],
    ['Sek. 4.8 — pananagutan ng supervisor', 'Dalawang paglabag (hindi pagpapaalam, hindi pag-report).', 'Labing-isa, kasama ang hindi opisyal na parusa sa labas ng Code, maling paggamit ng preventive suspension, pagtatago ng report ng harassment, at paghihiganti.', 'rev'],
    ['Sek. 5.7 hanggang 5.10', 'Hindi binanggit.', 'Kaligtasan at kalusugan sa trabaho (RA 11058), programa sa lugar na walang droga, laban sa sexual harassment at ang CODI (RA 7877 at RA 11313), mental health at hindi pagtatangi sa kalusugan (RA 11036, RA 11166).', 'new'],
    ['Annex A hanggang G', 'Walang form.', 'Notice to Explain, paliwanag ng empleyado, abiso ng pagdinig, case evaluation form, notice of decision, checklist sa pagsunod ayon sa bilang ng tauhan, at pagkilala ng empleyado.', 'new'],
  ]),

  subHead('D.  Mga benepisyong isinunod sa kasalukuyang batas'),
  cmpTable('LARANGAN', [
    ['Maternity leave', 'Basta tumukoy sa "umiiral na batas."', '105 araw na may buong bayad, 120 kung kwalipikadong solo parent, 60 sa nakunan, at 7 araw na puwedeng ilipat (RA 11210).', 'rev'],
    ['Solo parent leave', '7 araw, batay sa batas na pinalitan na.', '7 araw ng trabaho sa ilalim ng RA 11861, at nakasaad ang kailangang ID.', 'rev'],
    ['Leave para sa biktima ng karahasan', 'Wala.', '10 araw na may bayad sa ilalim ng RA 9262, na may tungkuling panatilihing lihim.', 'new'],
    ['Special leave for women', 'Wala.', 'Hanggang dalawang buwan matapos ang gynecological na operasyon (RA 9710).', 'new'],
    ['Bereavement leave', 'Wala.', 'Tatlong araw na may bayad, bilang benepisyong bigay ng kompanya.', 'new'],
    ['Grace period', '10 minuto; sobrang late sa 260 minuto kada buwan.', '15 minuto, bilang pagkilala sa biyahe papuntang Laguna, Maynila, at sa site ng kliyente; sobrang late sa 300 minuto kada buwan.', 'rev'],
    ['Sick leave', 'Kailangan ng medical certificate sa bawat sick leave.', 'Kailangan lamang kung tatlo o higit pang magkakasunod na araw. Ang kawalan nito sa mas maikling pagliban ay hindi na ginagawang walang pahintulot ang pagliban na may dahilan naman.', 'rev'],
    ['Overtime', 'Basta hindi babayaran ang overtime na walang pahintulot.', 'Dapat bayaran ang overtime na alam ng supervisor at pinabayaang magpatuloy; ang kulang na pag-apruba ay usaping Uri A lamang (Sek. 5.2).', 'rev'],
    ['Huling sahod at COE', 'Hindi binanggit.', 'Huling sahod sa loob ng 30 araw (Labor Advisory 06-20); Certificate of Employment sa loob ng 3 araw mula sa paghiling, at hindi kailanman nakadepende sa pagpirma ng quitclaim (Sek. 6.5).', 'new'],
    ['Mahinang performance', 'Pinagsama sa maling asal.', 'Hiwalay na: nakasulat na Performance Improvement Plan na may kahit 60 araw, hindi disiplina (Sek. 6.2).', 'new'],
  ]),
  gap(160),
  note('Walang benepisyong binabawasan ng edisyong ito', [
    'Ipinagbabawal ng Artikulo 100 ng Labor Code ang pag-alis o pagbawas ng benepisyong tinatamasa na ng mga empleyado. Bawat pagbabagong nakalista sa itaas ay nagpapagaan ng parusa, nagdaragdag ng proteksyon, nagdaragdag ng benepisyo, o nagwawasto ng probisyong labag sa batas. Walang karapatang umiiral sa ilalim ng Series 1 Edition ang nabawasan o naalis ng edisyong ito.',
    'Kung may probisyon ng dating edisyon na inalis, inalis ito dahil kinukuha nito sa empleyado ang isang bagay na hindi naman pinapayagan ng batas na kunin ng kompanya.',
  ], { edge: C.newTxt, fill: 'F1F8F1', labelColor: C.newTxt }),
];

module.exports = { summaryOfChanges };
