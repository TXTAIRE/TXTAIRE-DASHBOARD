const L = require('./lib.js');
const { d, C, W, run, p, bullet, gap, partHead, secHead, subHead,
        cell, tCell, table, note } = L;

const B = (t) => run(t, { bold: true });

const part3 = () => [
  ...partHead('BAHAGI III', 'Ang Proseso ng Disiplina'),

  secHead('3.1  Mga Prinsipyo ng Nagwawastong Disiplina', 'new'),
  p('Ang layunin ng disiplina sa TXTAIRE OPC ay itama ang asal, hindi parusahan ang tao. Limang prinsipyo ang gumagabay sa bawat kaso:'),
  bullet([B('Pagwawasto muna. '), run('Kung magaan ang pagkakamali at handang magwasto ang empleyado, magtuturo at magbababala muna ang kompanya bago magsuspinde. Ang suspensyon at pagtanggal ay para sa asal na hindi naitama ng babala, o sapat nang mabigat sa sarili nito.')]),
  bullet([B('Pagiging katimbang. '), run('Dapat bagay ang parusa sa paglabag — sa bigat nito, sa pinsala o panganib na idinulot, kung sinadya ba ito, at sa record ng empleyado. Ang parusang lubhang hindi katimbang ng paglabag ay hindi legal na disiplina.')]),
  bullet([B('Pagkakapareho. '), run('Dalawang empleyadong gumawa ng parehong paglabag sa parehong sitwasyon ay tatanggap ng parehong parusa. Kung iba ang pagtrato ng kompanya sa isang kaso, kailangang itala nang nakasulat ang dahilan.')]),
  bullet([B('Tamang proseso. '), run('Walang parusang ipapataw hangga\'t hindi nasasabihan nang nakasulat ang empleyado kung ano ang ibinibintang sa kanya at hindi siya nabibigyan ng tunay na pagkakataong sumagot.')]),
  bullet([B('Dokumentasyon. '), run('Bawat aksyong disiplinaryo, kasama ang bibig na babala, ay itatala nang nakasulat at isasampa sa HRD. Ang aksyong walang dokumento ay parang hindi nangyari, at hindi puwedeng bilangin sa bandang huli bilang naunang paglabag.')], { after: 160 }),

  secHead('3.2  Kahulugan ng mga Aksyong Disiplinaryo', 'rev'),
  ...(() => {
    const AW = [2200, 7546];
    const rows = [
      ['Bibig na Babala (VW)', 'Kakausapin ka ng supervisor nang pribado, ipapaliwanag kung ano ang mali at kung ano ang inaasahan, at itatala ito sa maikling sulat na pipirmahan ninyong dalawa at ipapadala sa HRD. Walang bawas sa sahod.'],
      ['Sulat na Babala (WW)', 'Maglalabas ang HRD ng pormal na memorandum na nagsasaad ng paglabag, ng pagwawastong kailangan, at na mas mabigat na parusa ang susunod kapag inulit. Pipirmahan mo ang resibo. Ang pagtangging pumirma ay itatala ng isang saksi at hindi nagpapawalang-bisa sa paunawa. Walang bawas sa sahod.'],
      ['Suspensyon (3d / 7d / 15d)', 'Hindi ka papasok sa nakatakdang bilang ng araw ng trabaho at walang sahod sa mga araw na iyon. Hindi lalagpas sa labinlimang (15) araw ng trabaho ang parusa para sa isang paglabag. Ang HRD, kasama ang Department Head, ang magtatakda ng petsa, sa loob ng tatlumpung (30) araw mula sa paunawa ng desisyon, at aayusin ito para walang maiwang site ng kliyente na walang tao.'],
      ['Pagtanggal (D)', 'Pagwawakas ng trabaho dahil sa malubhang dahilan sa ilalim ng Artikulo 297 ng Labor Code. Nakalaan ito sa mga paglabag na Napakabigat at sa huling hakbang ng Katamtaman at Mabigat.'],
    ];
    return [table([
      new d.TableRow({
        cantSplit: true, tableHeader: true,
        children: [
          tCell('AKSYON', { w: AW[0], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
          tCell('ANO ANG IBIG SABIHIN NITO', { w: AW[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
        ],
      }),
      ...rows.map((r) => new d.TableRow({
        cantSplit: true,
        children: [
          tCell(r[0], { w: AW[0], bold: true, color: C.navy, va: d.VerticalAlign.TOP }),
          tCell(r[1], { w: AW[1], va: d.VerticalAlign.TOP }),
        ],
      })),
    ], AW)];
  })(),
  gap(160),
  note('Hindi kailanman lalagpas sa labinlimang araw ang suspensyon', [
    L.pick(
      'Sa dating edisyon, pinapayagan ang tatlumpung (30) araw na suspensyon bilang karaniwang parusa. Mahirap ipagtanggol ang ganoon kahabang suspensyon bilang parusa, at may panganib itong ituring na constructive dismissal. Sa edisyong ito, labinlimang (15) araw ng trabaho ang pinakamahabang parusa bago ang pagtanggal.',
      'Labinlimang (15) araw ng trabaho ang pinakamahabang parusa bago ang pagtanggal. Walang suspensyong mas mahaba pa rito ang ipapataw ng kompanya bilang parusa.'),
    'Hiwalay ito sa PREVENTIVE na suspensyon sa Seksyon 3.8, na hindi parusa at hiwalay na nilimitahan ng batas sa tatlumpung (30) araw.',
  ]),

  secHead('3.3  Pag-uuri ng mga Paglabag', 'new'),
  p('Bawat paglabag na nakalista sa Bahagi IV ay nasa isa sa apat na uri. Ang uri ang nagtatakda ng parusa; ang record ng empleyado ang nagtatakda kung aling hakbang ang gagamitin.'),
  ...(() => {
    const KW = [1500, 8246];
    const rows = [
      ['A', 'Magaan', C.A, C.Atxt, 'Pagkakamali sa alituntunin o gawain na walang pinsala at walang panganib sa kaninuman. Naitatama sa pamamagitan ng babala. Halimbawa: pagiging huli, kulang na uniform, magulong lugar ng trabaho, huling report.'],
      ['B', 'Katamtaman', C.B, C.Btxt, 'Paglabag na nakakagulo sa trabaho, nagdudulot ng maliit na pinsala, o nagpapakita ng pagwawalang-bahala sa patakarang mahalaga. Halimbawa: pagliban nang walang paalam, hindi pagsuot ng PPE, kawalang-galang sa kliyente, pagsusugal sa loob.'],
      ['C', 'Mabigat', C.Cc, C.Ctxt, 'Paglabag na nagdudulot ng malaking pinsala o panganib, o tumatama sa relasyon sa trabaho, ngunit hindi naman tuluyang sumisira sa tiwala. Halimbawa: sadyang pagsuway, pakikipag-away, kapabayaang may pinsalang lampas ₱5,000, pambu-bully.'],
      ['D', 'Napakabigat', C.D, C.Dtxt, 'Asal na umaabot sa malubhang dahilan ng pagtanggal sa ilalim ng Artikulo 297 ng Labor Code — malubhang maling asal, sadyang pagsuway sa mabigat na utos, malubha at paulit-ulit na kapabayaan, pandaraya o sadyang pagsira ng tiwala, o krimen laban sa kompanya o sa mga tao nito. Halimbawa: pagnanakaw, pamemeke, sexual harassment, panunuhol, droga sa loob.'],
    ];
    return [table([
      new d.TableRow({
        cantSplit: true, tableHeader: true,
        children: [
          tCell('URI', { w: KW[0], bold: true, color: 'FFFFFF', fill: C.blue, align: d.AlignmentType.CENTER, size: 18 }),
          tCell('ANO ANG KASAMA SA URING ITO', { w: KW[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
        ],
      }),
      ...rows.map((r) => new d.TableRow({
        cantSplit: true,
        children: [
          cell([
            new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { after: 20 }, children: [run(r[0], { size: 32, bold: true, color: r[3] })] }),
            new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { after: 0 }, children: [run(r[1], { size: 17, bold: true, color: r[3] })] }),
          ], { w: KW[0], fill: r[2] }),
          tCell(r[4], { w: KW[1], va: d.VerticalAlign.TOP }),
        ],
      })),
    ], KW)];
  })(),

  secHead('3.4  Talaan ng mga Parusa', 'new'),
  p('Ang talaang ito ang iisang talaan ng parusa para sa buong Code. Ang mga paglabag ay binibilang sa loob ng labindalawang (12) buwan mula sa petsa ng unang paglabag, at ang magkakaparehong uri lamang ang pinagsasama sa pagbibilang.'),
  ...(() => {
    const PW = [1450, 2096, 1550, 1550, 1550, 1550];
    const hdr = ['URI', 'BIGAT', 'UNA', 'PANGALAWA', 'PANGATLO', 'PANG-APAT'];
    const rows = [
      ['A', 'Magaan', C.A, C.Atxt, ['Bibig na Babala', 'Sulat na Babala', '3-araw na suspensyon', '7-araw na suspensyon']],
      ['B', 'Katamtaman', C.B, C.Btxt, ['Sulat na Babala', '3-araw na suspensyon', '7-araw na suspensyon', 'PAGTANGGAL']],
      ['C', 'Mabigat', C.Cc, C.Ctxt, ['7-araw na suspensyon', '15-araw na suspensyon', 'PAGTANGGAL', '—']],
      ['D', 'Napakabigat', C.D, C.Dtxt, ['PAGTANGGAL', '—', '—', '—']],
    ];
    return [table([
      new d.TableRow({
        cantSplit: true, tableHeader: true,
        children: hdr.map((h, i) => tCell(h, {
          w: PW[i], bold: true, color: 'FFFFFF', fill: C.blue,
          align: d.AlignmentType.CENTER, size: 17,
        })),
      }),
      ...rows.map((r) => new d.TableRow({
        cantSplit: true,
        children: [
          tCell(r[0], { w: PW[0], bold: true, size: 28, color: r[3], fill: r[2], align: d.AlignmentType.CENTER }),
          tCell(r[1], { w: PW[1], bold: true, color: r[3], fill: r[2], align: d.AlignmentType.CENTER, size: 18 }),
          ...r[4].map((v, i) => tCell(v, {
            w: PW[i + 2], align: d.AlignmentType.CENTER, size: 18,
            bold: v === 'PAGTANGGAL', color: v === 'PAGTANGGAL' ? C.Dtxt : undefined,
          })),
        ],
      })),
    ], PW)];
  })(),
  gap(140),
  p('Mga paalala tungkol sa talaan:'),
  bullet('Ang suspensyon ay binibilang sa araw ng trabaho, hindi sa araw ng kalendaryo.'),
  bullet('Ang ikalimang paglabag na Magaan sa loob ng parehong labindalawang buwan ay sasailalim sa Seksyon 3.10 (Paulit-ulit na Paglabag).'),
  bullet('Ang mga paglabag na magkaiba ang uri ay hindi pinagsasama sa pagbibilang, ngunit mahalaga pa rin ang record sa lahat ng uri sa ilalim ng Seksyon 3.5 at 3.10.'),
  bullet('Kapag ang isang gawa ay lumabag sa higit sa isang probisyon ng Code na ito, ang pinakamataas na parusa lamang ang ipapataw. Hindi pinaparusahan nang dalawang beses ang empleyado sa iisang gawa.'),
  bullet('Kapag ang isang paglabag ay nangyari sa parehong pangyayari kasama ang ibang kaugnay na paglabag, ituturing itong isang paglabag lamang sa pagbibilang.', { after: 160 }),

  secHead('3.5  Mga Pampagaan at Pampabigat na Pangyayari', 'new'),
  p('Ang talaan sa Seksyon 3.4 ang karaniwang parusa. Hindi ito makina. Bago magpataw ng parusa, isasaalang-alang ng Panel at ng HRD kung may pangyayaring nagbibigay-katwiran sa pagbaba o pagtaas ng isang hakbang, at itatala ang dahilan sa Case Evaluation Form.'),
  ...(() => {
    const MW = [4873, 4873];
    const mit = [
      'Ito ang unang paglabag ng empleyado sa kahit anong uri.',
      'Haba ng malinis na serbisyo sa kompanya.',
      'Kusang isinumbong ng empleyado ang sarili niyang paglabag bago pa ito matuklasan.',
      'Nagbayad o nagwasto agad ang empleyado ng pagkakamali.',
      'Tunay na pagkakamali sa pagpapasya, hindi sinadyang gawa.',
      'Sumusunod lang ang empleyado sa utos ng superyor, o may tunay na hindi pagkakaintindihan sa patakaran.',
      'Walang pinsala, walang nasaktan, at walang reklamo ang kliyente.',
      'Hindi naipaalam nang malinaw o hindi pantay na ipinatupad noon ang patakaran.',
      'Mabigat na personal na dahilan (malubhang sakit ng empleyado o ng malapit na kamag-anak, kalamidad, pagkamatay sa pamilya).',
    ];
    const agg = [
      'Sinadya, binalak, o inulit ang gawa.',
      'May hawak na posisyon ng tiwala ang empleyado, o supervisor o manager siya.',
      'Nagdulot ang paglabag ng tunay na pinsala, sugat, o pagkawala ng account ng kliyente.',
      'Sinubukang itago ng empleyado ang gawa, sinira ang ebidensya, o nagsinungaling sa imbestigasyon.',
      'Ginawa ang paglabag laban sa kasamahang mas mababa ang ranggo, o laban sa kliyente.',
      'Ginawa ang paglabag habang may sinusunod nang parusa o nasa preventive suspension.',
      'Isinama o inudyukan ng empleyado ang iba na makilahok.',
      'Naglagay sa panganib ang paglabag sa buhay o kaligtasan ng kahit sino.',
      'Nabalaan na noon ang empleyado tungkol sa parehong asal.',
    ];
    return [table([
      new d.TableRow({
        cantSplit: true, tableHeader: true,
        children: [
          tCell('PAMPAGAAN  —  puwedeng magpagaan ng parusa', { w: MW[0], bold: true, color: 'FFFFFF', fill: '4C8C2B', size: 18 }),
          tCell('PAMPABIGAT  —  puwedeng magpabigat ng parusa', { w: MW[1], bold: true, color: 'FFFFFF', fill: 'A8342A', size: 18 }),
        ],
      }),
      new d.TableRow({
        cantSplit: true,
        children: [
          cell(mit.map((t, i) => new d.Paragraph({
            numbering: { reference: 'bullets', level: 0 },
            spacing: { after: i === mit.length - 1 ? 0 : 60, line: 250 },
            children: [run(t, { size: 18 })],
          })), { w: MW[0], va: d.VerticalAlign.TOP, fill: 'F4FAF0' }),
          cell(agg.map((t, i) => new d.Paragraph({
            numbering: { reference: 'bullets', level: 0 },
            spacing: { after: i === agg.length - 1 ? 0 : 60, line: 250 },
            children: [run(t, { size: 18 })],
          })), { w: MW[1], va: d.VerticalAlign.TOP, fill: 'FDF4F3' }),
        ],
      }),
    ], MW)];
  })(),
  gap(140),
  p('Dalawang hangganan ang ipinapatupad. Una, puwedeng magpagaan ng isang hakbang ang mga pampagaan na pangyayari, ngunit hindi nito puwedeng gawing basta babala ang paglabag na Napakabigat na may kinalaman sa pagnanakaw, pandaraya, sexual harassment, o karahasan; kung sa palagay ng Panel ay nararapat ang mas mababa sa pagtanggal, kailangang isulat nila ito at ang May-ari o General Manager ang magdedesisyon. Pangalawa, puwedeng magpabigat ng isang hakbang ang mga pampabigat, ngunit ang unang paglabag na Magaan ay hindi kailanman puwedeng gawing pagtanggal agad.'),

  secHead('3.6  Tamang Proseso: Ang Dalawang Sulat', 'new'),
  p('Walang empleyadong sususpindihin o tatanggalin nang walang sumusunod na proseso, na alinsunod sa Artikulo 292(b) ng Labor Code at sa Department Order No. 147-15. Ang kompanya ang may pananagutang patunayan na may tamang dahilan AT na sinunod ang prosesong ito.'),

  subHead('Hakbang 1 — Report at unang pagsusuri'),
  p('Ire-report ng supervisor ang pangyayari sa HRD nang nakasulat sa loob ng limang (5) araw ng trabaho mula nang malaman niya ito. Susuriin muna ng HRD kung ang mga inireport na pangyayari, kung totoo, ay bumubuo ng paglabag sa Code na ito. Kung hindi, isasara ng HRD ang usapin at ipapaalam ito nang nakasulat sa supervisor. Kung oo, magpapatuloy sa Hakbang 2.'),

  subHead('Hakbang 2 — Unang sulat: Notice to Explain (Annex A)'),
  p('Magbibigay ang HRD sa empleyado ng nakasulat na Notice to Explain. Dapat nakasaad dito:'),
  bullet('ang mismong gawa o pagkukulang na inirereklamo, kasama ang petsa, oras, at lugar ng bawat isa;'),
  bullet('ang mismong probisyon ng Code na ito o ng patakaran ng kompanya na sinasabing nalabag;'),
  bullet('na binibigyan ang empleyado ng pagkakataong magpaliwanag at magharap ng ebidensya at testigo;'),
  bullet('na isinasaalang-alang ang pagtanggal, kung ganoon nga ang usapin; at'),
  bullet('ang huling araw ng pagsusumite ng nakasulat na paliwanag, na hindi bababa sa limang (5) araw ng kalendaryo mula sa pagtanggap.', { after: 140 }),
  p('Ibibigay ang NTE nang personal at may pirma ng resibo. Kung tumanggi ang empleyadong tanggapin o pumirma, itatala ito sa harap ng isang saksi at magpapadala ng kopya sa huling kilalang address ng empleyado sa pamamagitan ng registered mail o courier. Ang pangkalahatang pahayag na tulad ng "lumabag ka sa patakaran ng kompanya" ay hindi wastong NTE.'),

  subHead('Hakbang 3 — Nakasulat na paliwanag ng empleyado'),
  p('May kahit limang (5) araw ng kalendaryo ang empleyado para magsumite ng nakasulat na paliwanag (Annex B), at puwede siyang maglakip ng dokumento at magsabi ng testigo. Magbibigay ang HRD ng makatuwirang palugit kapag hiniling, lalo na kung kailangan pa ng empleyado ng panahon para mangalap ng ebidensya, nasa aprubadong leave siya, o may sakit. Puwedeng humingi ng tulong ang empleyado sa kinatawan o abogadong siya mismo ang pumili, sa sarili niyang gastos.'),

  subHead('Hakbang 4 — Administrative conference'),
  p('Magkakaroon ng administrative conference kapag hiniling ito ng empleyado, kapag pinagtatalunan ang mga pangyayari, o kapag isinasaalang-alang ang pagtanggal. Pagpupulong ito, hindi paglilitis: hindi ipinapatupad dito ang teknikal na alituntunin sa ebidensya. Layunin nitong bigyan ang empleyado ng pagkakataong harapin ang bintang, magpaliwanag, magharap ng testigo, at sumagot sa mga tanong. Magbibigay ang HRD ng nakasulat na abiso ng iskedyul kahit tatlong (3) araw ng trabaho bago ito, at magtatala ng minutes na pipirmahan ng mga naroon.'),
  p('Kung matapos maabisuhan nang maayos ay hindi dumating ang empleyado at walang ibinigay na dahilan, ipapasya ang kaso batay sa mga record. Hindi ituturing ng kompanya ang hindi pagdating bilang pag-amin ng kasalanan.'),

  subHead('Hakbang 5 — Pagsusuri at pagpapasya'),
  p('Susuriin ng Panel o ng HRD, ayon sa Seksyon 3.7, ang ebidensya, kukumpletuhin ang Case Evaluation Form (Annex D), at isasaad ang natuklasang pangyayari, ang probisyong nalabag, ang mga pampagaan at pampabigat na isinaalang-alang, at ang inirerekomendang parusa. Ang rekomendasyon ay aaprubahan ng May-ari o General Manager.'),

  subHead('Hakbang 6 — Pangalawang sulat: Notice of Decision (Annex E)'),
  p('Magbibigay ang HRD ng nakasulat na Notice of Decision na nagsasaad ng natuklasan, ng mismong batayan na ginamit, ng dahilan kung bakit tinanggap o hindi ang paliwanag ng empleyado, ng parusang ipinapataw, at ng petsa ng pagkakabisa nito. Kung pagtanggal ang parusa, isasaad ang petsa ng paghihiwalay at ibibigay ito sa empleyado; magpapadala rin ng kopya sa DOLE Regional Office na may hurisdiksyon, kung kinakailangan.'),
  p('Dapat matapos ang buong proseso mula NTE hanggang Notice of Decision sa loob ng tatlumpung (30) araw ng kalendaryo, na puwedeng palawigin sa makatuwirang dahilang itatala nang nakasulat.'),
  note('Dalawang sulat ang pinakamababa, hindi ang pinakamataas', [
    'Ang paglaktaw sa alinman sa dalawang sulat, o ang pagbibigay sa empleyado ng wala pang limang araw ng kalendaryo para magpaliwanag, ay hindi lang nagpapahina sa kaso — inilalagay nito ang kompanya sa panganib ng nominal damages kahit tama naman ang dahilan ng pagtanggal. Ang pinakamurang oras na gugugulin ng HRD ay ang oras na ginugol sa maayos na NTE.',
  ], { edge: C.blue, fill: 'EEF3FB', labelColor: C.navy }),

  secHead('3.7  Ang Administrative Review Panel', 'rev'),
  p(L.pick(
    'Sa dating edisyon, kailangan ang panel na tatlong manager sa bawat kaso. Hindi kayang gawin iyon sa kasalukuyang laki ng kompanya, at nagpapabagal ito sa simpleng kaso. Ito ang gagamitin, at kasama na rito ang paglaki ng kompanya:',
    'Nakadepende sa bigat ng kaso kung sino ang susuri nito. Ito ang gagamitin, at kasama na rito ang paglaki ng kompanya:')),
  ...(() => {
    const RW = [2400, 3400, 3946];
    const rows = [
      ['Mga paglabag na Magaan', 'Supervisor, na may kopya sa HRD', 'Susuriin ng HRD ang record para sa pagkakapareho. Walang panel na kailangan.'],
      ['Mga paglabag na Katamtaman', 'HRD, kasama ang Department Head', 'Walang panel na kailangan. Ang May-ari o General Manager ang aaprubahan ng anumang suspensyon.'],
      ['Mga paglabag na Mabigat', 'Administrative Review Panel', 'Panel na tatlo (3): ang HR Head bilang chair, isang Department Head na walang kinalaman sa kaso, at isang empleyadong kapantay man lang ng ranggo ng inirereklamo.'],
      ['Napakabigat, at anumang kasong pinag-iisipan ang pagtanggal', 'Administrative Review Panel', 'Ganoon din ang komposisyon. Magrerekomenda ang Panel; ang May-ari o General Manager ang magpapasya.'],
      ['Sexual harassment at gender-based na harassment', 'Committee on Decorum and Investigation', 'Binubuo sa ilalim ng Seksyon 5.9. Mas mataas ito kaysa sa Panel.'],
    ];
    return [table([
      new d.TableRow({
        cantSplit: true, tableHeader: true,
        children: [
          tCell('KASO', { w: RW[0], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
          tCell('SINO ANG MAGPAPASYA', { w: RW[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
          tCell('KOMPOSISYON AT PAALALA', { w: RW[2], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
        ],
      }),
      ...rows.map((r) => new d.TableRow({
        cantSplit: true,
        children: [
          tCell(r[0], { w: RW[0], bold: true, color: C.navy, va: d.VerticalAlign.TOP }),
          tCell(r[1], { w: RW[1], va: d.VerticalAlign.TOP }),
          tCell(r[2], { w: RW[2], va: d.VerticalAlign.TOP }),
        ],
      })),
    ], RW)];
  })(),
  gap(140),
  p('Walang uupo sa Panel na siyang nagreklamo, testigo, ang supervisor na nag-report ng kaso, kamag-anak ng alinmang panig hanggang ikaapat na antas, o may anumang interes sa kalalabasan. Kung hindi makabuo ang kompanya ng Panel na tumutugon dito mula sa sariling tauhan, puwedeng magtalaga ang May-ari o General Manager ng panlabas na HR practitioner o abogado bilang miyembro.'),
  p('Lihim ang lahat ng pag-uusap ng Panel. Hindi tatalakayin ng mga miyembro ang kaso sa labas ng proseso.'),

  secHead('3.8  Preventive Suspension', 'rev'),
  p('Ang preventive suspension ay hindi parusa. Pansamantalang pag-alis ito sa empleyado sa lugar ng trabaho habang may imbestigasyon, at puwede lamang itong gamitin kung ang patuloy na presensya ng empleyado ay malubha at agarang banta sa buhay o ari-arian ng kompanya, ng kliyente, o ng mga kasamahan — halimbawa, kung ang bintang ay may kinalaman sa karahasan, armas, droga, o kung nasa posisyon ang empleyadong sirain ang ebidensya o takutin ang mga testigo.'),
  bullet('Puwede lang itong ipataw matapos maibigay ang NTE, at isusulat ito kasama ang dahilan.'),
  bullet('Hindi ito lalagpas sa tatlumpung (30) araw ng kalendaryo.'),
  bullet('Kung hindi matapos ang imbestigasyon sa loob ng tatlumpung (30) araw, ibabalik ng kompanya sa trabaho ang empleyado o palalawigin ang suspensyon — at kung palalawigin, babayaran ng kompanya ang sahod at benepisyo ng empleyado sa panahon ng palugit.'),
  bullet('Kung mapatunayang walang pananagutan ang empleyado, o may pananagutan sa paglabag na walang suspensyon, babayaran ang sahod niya para sa buong panahon ng preventive suspension.'),
  bullet('Kung may pananagutan at sususpindihin bilang parusa, ibabawas sa parusa ang panahong nagawa nang preventive suspension.'),
  bullet('Hindi gagamitin ang preventive suspension bilang kaginhawaan, bilang paraan para iwasan ang pagdinig, o bilang hindi opisyal na parusa. Ang paggawa nito ay paglabag sa ilalim ng Seksyon 4.8.', { after: 160 }),

  secHead('3.9  Apela'),
  p('Puwedeng humingi ang empleyado ng muling pagsusuri sa anumang desisyon sa pamamagitan ng nakasulat na Letter of Appeal sa HRD sa loob ng limang (5) araw ng kalendaryo mula sa pagtanggap ng Notice of Decision. Dapat nakasaad dito ang mga dahilan at puwedeng may kalakip na bagong ebidensya.'),
  p('Susuriin ang apela ng May-ari o General Manager, o, kung sila ang nagpasya sa una, ng taong itatalaga nilang walang kinalaman sa orihinal na desisyon. Maglalabas ng nakasulat na resolusyon sa loob ng labinlimang (15) araw ng kalendaryo mula sa pagtanggap ng apela. Ang resolusyong ito ang huli sa loob ng kompanya.'),
  p('Ang paghahain ng apela ay hindi mismo humihinto sa parusa, ngunit puwedeng ipagpaliban muna ito ng tagasuri habang hinihintay ang resolusyon. Walang anuman sa Code na ito ang naglilimita sa karapatan ng empleyadong dalhin ang usapin sa Department of Labor and Employment, sa National Labor Relations Commission, o sa kahit anong tanggapang may hurisdiksyon, at walang empleyadong paparusahan sa paggawa nito.'),

  secHead('3.10  Paulit-ulit na Paglabag', 'rev'),
  p('Ituturing na paulit-ulit na lumalabag ang isang empleyado kung, sa loob ng labindalawang (12) buwan mula sa petsa ng unang paglabag, naipon niya ang alinman sa mga sumusunod:'),
  bullet('Limang (5) paglabag na Magaan; o'),
  bullet('Tatlong (3) Sulat na Babala mula sa magkakahiwalay na pangyayari; o'),
  bullet('Tatlong (3) suspensyon mula sa magkakahiwalay na pangyayari; o'),
  bullet('Anumang kombinasyon ng apat (4) na parusang Sulat na Babala pataas mula sa magkakahiwalay na pangyayari.', { after: 140 }),
  p('Ang paulit-ulit na paglabag ay ituturing na paglabag na Mabigat sa sarili nito at sasailalim sa buong proseso ng Seksyon 3.6, kasama ang hiwalay na NTE. Hindi ito automatic na pagtanggal: susuriin ng Panel kung ang pattern ay nagpapakita ng tunay na ayaw magwasto, at kung nabigyan ba ang empleyado ng tunay na suporta para gumanda.'),
  p('Kung ang mga pinag-ugatang paglabag ay pawang Magaan at walang pinsala, karaniwang dapat magpataw ang Panel ng suspensyon at maglagay sa empleyado sa nakasulat na plano sa pagpapabuti, sa halip na magrekomenda ng pagtanggal.'),

  secHead('3.11  Palugit at Paglilinis ng Record', 'new'),
  p('Palugit ng mga paglabag. Walang prosesong disiplinaryo na sisimulan lampas sa animnapung (60) araw ng kalendaryo mula nang malaman ang paglabag ng supervisor o ng HRD, alinman ang mas maaga — maliban sa mga paglabag na may kinalaman sa pandaraya, kawalan ng katapatan, pagnanakaw, pamemeke, sexual harassment, o karahasan, na isang (1) taon mula sa pagkatuklas. Hindi dapat magtago ang kompanya ng lumang bintang bilang reserba.'),
  p('Paglilinis ng record. Titigil sa pagbibilang ang parusa sa ilalim ng Seksyon 3.4 pagkatapos ng labindalawang (12) buwan mula nang lubusang maserbisyuhan ito, basta walang bagong paglabag ang empleyado sa parehong uri sa panahong iyon. Mananatili sa 201 file ang nalinis na parusa bilang record, ngunit hindi na ito gagamitin para pabigatin ang parusa sa susunod na paglabag.'),
  p('Epekto sa benepisyo at promotion. Ang nalinis na parusa ay hindi gagamiting dahilan para tanggihan ang promotion, transfer, training, o kahit anong benepisyo.'),

  secHead('3.12  Pagbabayad ng Pinsala at ang Bawal na Multa', 'new'),
  note(L.pick('Pinapalitan ng Seksyong ito ang mga probisyon ng dating edisyon na labag sa batas',
              'Bawal ang multa at ang pagpigil sa sahod na kinita mo na'), [
    [L.pick(
      'Hindi magpapataw ng multa ang kompanya. Sa dating edisyon, may "₱500 multa / kukunin ang unit". Ang multang ibinabawas sa sahod ay wala sa mga bawas na pinapayagan ng Artikulo 113 ng Labor Code at hindi na ipapataw.',
      'Hindi magpapataw ng multa ang kompanya. Ang multang ibinabawas sa sahod ay wala sa mga bawas na pinapayagan ng Artikulo 113 ng Labor Code, at walang unit o kagamitan mo ang kukunin bilang parusa.')],
    [L.pick(
      'Hindi ipagkakait ng kompanya ang bayad sa oras na talagang pinasukan. Sa dating edisyon, ang empleyadong nakalimot mag-punch ay "ituturing na absent at walang sahod sa araw na iyon". Ang empleyadong talagang nagtrabaho ay dapat bayaran. Ang nakaligtaang time entry ay itinatama sa Time Correction Form na pipirmahan ng supervisor, at tatratuhin, kung mayroon man, bilang paglabag na Magaan sa ilalim ng Seksyon 4.2.',
      'Hindi ipagkakait ng kompanya ang bayad sa oras na talagang pinasukan. Kung talagang nagtrabaho ka, dapat kang bayaran, kahit nakalimutan mong mag-punch. Ang nakaligtaang time entry ay itinatama sa Time Correction Form na pipirmahan ng supervisor mo, at tatratuhin, kung mayroon man, bilang paglabag na Magaan sa ilalim ng Seksyon 4.2.')],
    ['Hindi magpapataw ang kompanya ng liquidated damages na katumbas ng dalawang buwang sahod dahil sa hindi pagbibigay ng abiso ng resignation. Tingnan ang Seksyon 6.4.'],
  ], { edge: C.Dtxt, fill: 'FDF0F0', labelColor: C.Dtxt }),
  gap(160),
  p('Kapag ang empleyado ay nagdulot ng pinsala sa ari-arian ng kompanya o ng kliyente, puwedeng gawin ng kompanya ang mga sumusunod:'),
  bullet('hilingin ang pagbabayad o pagkumpuni bilang kondisyong nakatala sa Notice of Decision, kung pumapayag ang empleyado;'),
  bullet('ibawas ang halaga sa sahod LAMANG kung nagbigay ang empleyado ng nakasulat na pahintulot sa bawas, nang malaya at walang pamimilit, at kung ang bawas ay hindi magpapababa sa sahod niya sa ilalim ng minimum wage. Ikakalat ang bawas para walang isang pay period na mababawasan ng higit sa dalawampung porsyento (20%) ng net pay;'),
  bullet('bawiin ang halaga sa huling sahod kapag umalis, sa parehong kondisyon; o'),
  bullet('maghain ng sibil na aksyon sa tamang tanggapan.', { after: 140 }),
  p('Kung hindi pumayag ang empleyado sa pagbabayad, ang remedyo ng kompanya ay sibil na paghahabol, hindi ang bawas na walang pahintulot. Ang pagtangging pumayag sa bawas ay hindi paglabag at hindi ituturing na pagsuway.'),
  p('Para sa mga bawas na may kinalaman sa pagkawala o pagkasira ng kasangkapan, materyales, o kagamitan, susundin din ng kompanya ang Artikulo 114 ng Labor Code at ang implementing rules nito, na nag-aatas na marinig muna ang empleyado tungkol sa pananagutan niya, na malinaw na maipakitang siya ang may pananagutan, at na hindi lalagpas ang bawas sa dalawampung porsyento (20%) ng sahod niya sa isang linggo.'),

  secHead('3.13  Karapatan ng Pamunuan at ng Empleyado', 'new'),
  p('Nananatili sa kompanya ang karapatang maglabas, magbago, at magpatupad ng alituntunin sa trabaho at magdisiplina ng empleyado, sa loob ng hangganang itinakda ng Konstitusyon, ng Labor Code, at ng batas. Kung may gawang lubhang nakasasama sa kompanya na wala sa Bahagi IV, puwedeng kumilos ang kompanya rito, ngunit sa pamamagitan lamang ng paggamit ng uri ng pinakamalapit na katulad na nakalistang paglabag, at pagkatapos lamang ng buong proseso sa Seksyon 3.6.'),
  p('Nananatili sa bawat empleyado ang mga sumusunod na karapatan, na walang probisyon ng Code na ito ang makakabawi:'),
  bullet('malaman nang nakasulat ang anumang bintang, at mabigyan ng tunay na pagkakataong sumagot;'),
  bullet('matulungan ng kinatawan o abogadong siya mismo ang pumili sa anumang pagdinig;'),
  bullet('makita at makakuha ng kopya ng mga dokumentong ginamit laban sa kanya, at ng sarili niyang 201 file;'),
  bullet('sa seguridad ng trabaho, at hindi matanggal maliban sa malubha o awtorisadong dahilan at may tamang proseso;'),
  bullet('matanggap ang lahat ng sahod at benepisyong nakalaan sa batas, at hindi ito babawasan bilang parusa;'),
  bullet('sa pag-oorganisa at sa legal na sama-samang pagkilos;'),
  bullet('sa lugar ng trabahong walang harassment, diskriminasyon, at paghihiganti;'),
  bullet('magdala ng anumang reklamo sa DOLE, sa NLRC, o sa kahit anong tanggapang may kakayahan, nang walang takot na gantihan.', { after: 160 }),
];

module.exports = { part3 };
