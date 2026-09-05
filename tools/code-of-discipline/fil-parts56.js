const L = require('./lib.js');
const { d, C, W, run, p, bullet, gap, partHead, secHead, subHead,
        cell, tCell, table, note, benefitRun, benefitCell } = L;

const B = (t) => run(t, { bold: true });

const simpleTable = (header, rows, widths, opts) => {
  const left = new Set((opts && opts.left) || []);
  const alignFor = (i) => (i === 0 || left.has(i)) ? undefined : d.AlignmentType.CENTER;
  const PILL = /^@(mandatory|company)@$/;
  return table([
    new d.TableRow({
      cantSplit: true, tableHeader: true,
      children: header.map((h, i) => tCell(h, {
        w: widths[i], bold: true, color: 'FFFFFF', fill: C.blue, size: 18, align: alignFor(i),
      })),
    }),
    ...rows.map((r) => new d.TableRow({
      cantSplit: true,
      children: r.map((v, i) => {
        const m = PILL.exec(String(v));
        if (m) return benefitCell(m[1], widths[i]);
        return tCell(v, {
          w: widths[i], va: d.VerticalAlign.TOP,
          bold: i === 0, color: i === 0 ? C.navy : undefined, align: alignFor(i),
        });
      }),
    })),
  ], widths);
};

// =========================================================== BAHAGI V
const part5 = () => [
  ...partHead('BAHAGI V', 'Pamantayan at Benepisyo sa Trabaho'),
  p('Nakasaad sa Bahaging ito ang mga pamantayan at benepisyong ipinapatupad sa lahat ng empleyado. May isa sa dalawang label ang bawat benepisyo, para makita agad ng empleyado kung saan nanggagaling ang karapatang iyon:'),
  gap(60),
  ...(() => {
    const LW = [2600, 7146];
    const row = (kind, meaning) => new d.TableRow({
      cantSplit: true,
      children: [benefitCell(kind, LW[0]), tCell(meaning, { w: LW[1], va: d.VerticalAlign.CENTER, size: 19 })],
    });
    return [table([
      new d.TableRow({
        cantSplit: true,
        children: [
          tCell('LABEL', { w: LW[0], bold: true, color: 'FFFFFF', fill: C.blue, size: 18, align: d.AlignmentType.CENTER }),
          tCell('ANO ANG IBIG SABIHIN', { w: LW[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
        ],
      }),
      row('mandatory', 'Kailangan ng batas. Dapat itong ibigay ng kompanya anuman ang patakaran nito, at hindi ito puwedeng bawasan, isuko, o ipagpalit — hindi ng Code na ito, hindi ng personal na kasunduan, at hindi kahit pumayag pa ang empleyado.'),
      row('company', 'Bigay ng kompanya nang higit sa hinihingi ng batas. Malaya ang kompanyang hindi ito ibigay. Ngunit kapag naibigay na ito nang regular at sinadya, hindi na ito puwedeng bawiin o bawasan nang basta-basta (Artikulo 100, Labor Code).'),
    ], LW)];
  })(),
  gap(160),
  p('Kung susugan ang batas at magbigay ng higit sa nakasaad sa Bahaging ito, ang batas ang masusunod at ituturing na nabago nang naaayon ang Bahaging ito.'),

  secHead('5.1  Oras ng Trabaho, Attendance, at Pagiging Maagap'),
  p('Ang karaniwang araw ng trabaho ay walong (8) oras kasama ang meal break na hindi bababa sa animnapung (60) minuto, na hindi binabayaran. Ang karaniwang oras sa opisina sa Laguna at Maynila ay 8:00 N.U. hanggang 5:00 N.H., Lunes hanggang Biyernes, at may trabaho sa Sabado ayon sa iskedyul. Ang mga nakatalaga sa site ng kliyente ay susunod sa iskedyul na napagkasunduan sa kliyente, na ipapaalam nang nakasulat.'),
  p('May grace period na labinlimang (15) minuto matapos ang opisyal na simula ng shift. Ang oras na nawala dahil sa pagiging huli o undertime ay ibabawas sa sahod batay sa tunay na minutong nawala. Ang pagbawas ng oras na hindi pinasukan ay hindi parusang disiplinaryo; hiwalay ang aksyong disiplinaryo sa pagiging huli at nasa Seksyon 4.1 ito.'),
  p('May karapatan ang bawat empleyado sa pahingang hindi bababa sa dalawampu\'t apat (24) na magkakasunod na oras matapos ang bawat anim (6) na magkakasunod na araw ng trabaho. Kung kailangan ng kliyente ng trabaho sa nakatakdang rest day, ipapatupad ang dagdag-bayad sa Seksyon 5.2.'),
  p('Ang night shift differential na hindi bababa sa sampung porsyento (10%) ng basic hourly rate ay ibinibigay sa bawat oras na pinasukan mula 10:00 N.G. hanggang 6:00 N.U.'),

  secHead('5.2  Overtime, Undertime, at Rest Day', 'rev'),
  p('Ang overtime ay dapat aprubahan nang nakasulat ng supervisor BAGO ito gawin, at itatala ang pag-apruba sa timesheet. Umiiral ang panuntunang ito para makontrol ng kompanya ang gastos at tauhan; hindi ito paraan para makaiwas sa pagbabayad.'),
  note('Dapat bayaran ang overtime na talagang ginawa at alam ng kompanya', [
    'Kung may ginawang overtime ang empleyado nang walang paunang nakasulat na pag-apruba, ngunit kailangan ang trabaho at alam ito ng supervisor at pinabayaang magpatuloy, dapat bayaran ang overtime. Ang kakulangan sa paunang pag-apruba ay tatratuhin, kung mayroon man, bilang paglabag na Magaan.',
    'Ang panuntunang basta hindi babayaran ang overtime na walang pahintulot ay hindi puwedeng ipatupad sa mga oras na alam ng kompanya at pinakinabangan nito.',
  ]),
  gap(160),
  p('Mga dagdag-bayad. Ito ang pinakamababang rate ayon sa batas. Kung mas mataas ang ibinibigay ng kontrata sa kliyente o ng kaugalian ng kompanya, ang mas mataas ang masusunod.'),
  ...(() => {
    const OW = [5546, 4200];
    return [simpleTable(['TRABAHONG GINAWA', 'RATE'], [
      ['Overtime sa karaniwang araw ng trabaho', 'Hourly rate + 25%'],
      ['Trabaho sa rest day o special non-working day', 'Daily rate + 30%'],
      ['Overtime sa rest day o special non-working day', 'Hourly rate ng araw na iyon + 30%'],
      ['Trabaho sa regular holiday', '200% ng daily rate'],
      ['Overtime sa regular holiday', 'Hourly rate ng araw na iyon + 30%'],
      ['Trabaho sa regular holiday na rest day rin', '200% + 30% ng halagang iyon'],
      ['Night shift differential (10:00 N.G. – 6:00 N.U.)', 'Hourly rate + 10%'],
    ], OW)];
  })(),
  gap(160),
  p('Undertime. Bawal ang undertime maliban sa emergency o sa pangyayaring wala sa kontrol ng empleyado, at kailangan ang pag-apruba ng supervisor. Ang undertime sa isang araw ay hindi puwedeng ipambawas sa overtime sa ibang araw. Ang undertime na mahigit isang (1) oras ay dapat may leave application. Ang paulit-ulit na undertime ay sasailalim sa Seksyon 4.1.'),

  secHead('5.3  Mga Leave', 'rev'),
  new d.Paragraph({
    heading: d.HeadingLevel.HEADING_3, spacing: { before: 180, after: 80 }, keepNext: true,
    children: [run('Service Incentive Leave (SIL)', { size: 21, bold: true, color: C.green }),
               run('   ', { size: 21 })].concat(benefitRun('mandatory')),
  }),
  p('Ang bawat empleyadong nakapagtrabaho nang hindi bababa sa isang (1) taon ay may karapatan sa limang (5) araw na service incentive leave na may bayad kada taon. Ang taon ay binibilang mula sa araw na nagsimula siyang magtrabaho, at kasama rito ang mga aprubadong pagliban, bayad na regular holiday, at rest day.'),
  p('Puwedeng gamitin ang SIL para sa bakasyon o sa sakit. Ang hindi nagamit na SIL ay puwedeng gawing pera sa katapusan ng taon, o kapag umalis, batay sa sahod sa petsa ng pagpapalit. Ang aplikasyon para sa planadong leave ay isusumite kahit limang (5) araw ng trabaho bago ito; kung dalawang linggo o higit pa ang pagliban, kahit dalawang (2) linggo bago ito.'),
  new d.Paragraph({
    heading: d.HeadingLevel.HEADING_3, spacing: { before: 180, after: 80 }, keepNext: true,
    children: [run('Sick leave', { size: 21, bold: true, color: C.green }),
               run('   ', { size: 21 })].concat(benefitRun('mandatory')),
  }),
  p('Walang hiwalay na bayad na sick leave ang kompanya bukod sa SIL. Puwedeng gamitin ng empleyado ang SIL credits para sa pagliban dahil sa sakit. Kailangan ng medical certificate mula sa lisensyadong doktor kung tatlo (3) o higit pang magkakasunod na araw ang pagliban. Sa mas maikling pagliban, puwedeng humingi ng medical certificate ngunit hindi ito dapat hilinging walang katuwiran, at ang kawalan nito lamang ay hindi gagawing walang pahintulot ang pagliban na may dahilan naman.'),
  p('Kung naubos na ang SIL credits, o hindi pa umaabot sa isang taon ang serbisyo ng empleyado, puwedeng kunin ang pagliban dahil sa sakit bilang leave na walang bayad sa ilalim ng mga tuntunin sa ibaba, at puwedeng mag-claim ang empleyado ng SSS sickness benefit kung kwalipikado.'),
  subHead('Mga leave ayon sa batas', 'rev'),
  ...(() => {
    const SW = [2500, 1150, 2150, 3946];
    return [simpleTable(['LEAVE', 'ARAW', 'BATAYAN', 'KARAPATAN AT KONDISYON'], [
      ['Maternity Leave\n(RA 11210)', '105 / 120 / 60', '@mandatory@', 'Isandaan at limang (105) araw na may buong bayad sa buhay na panganganak, normal man o caesarean, anuman ang katayuang sibil o pagiging lehitimo ng anak; dagdag na labinlimang (15) araw kung kwalipikadong solo parent; animnapung (60) araw sa nakunan o emergency na pagtatapos. Hanggang pitong (7) araw ang puwedeng ilipat sa ama ng bata o, kung wala siya, sa ibang tagapag-alaga. May opsyon ding palawigin nang tatlumpung (30) araw na walang bayad, basta may abiso.'],
      ['Paternity Leave\n(RA 8187)', '7', '@mandatory@', 'Pitong (7) araw na may buong bayad para sa kasal na lalaking empleyado, sa bawat isa sa unang apat (4) na panganganak ng lehitimong asawang kasama niyang naninirahan.'],
      ['Solo Parent Leave\n(RA 11861)', '7', '@mandatory@', 'Pitong (7) araw ng trabaho na may bayad kada taon para sa empleyadong nakapagtrabaho nang hindi bababa sa anim (6) na buwan at may balidong Solo Parent ID mula sa lokal na social welfare office. Hindi puwedeng gawing pera at hindi nadadala sa susunod na taon.'],
      ['Special Leave for Women\n(RA 9710)', 'hanggang 60', '@mandatory@', 'Hanggang dalawang (2) buwan na may buong bayad matapos ang operasyong dulot ng gynecological na karamdaman, para sa empleyadong nakapagtrabaho nang hindi bababa sa anim (6) na buwan sa loob ng nakaraang labindalawang (12) buwan.'],
      ['Leave para sa Biktima ng\nKarahasan (RA 9262)', '10', '@mandatory@', 'Sampung (10) araw na may bayad, puwedeng palawigin, para sa babaeng empleyadong biktima ng karahasan laban sa kababaihan at kanilang mga anak, kapag nagpakita ng protection order o sertipikasyon mula sa barangay, piskal, o clerk of court. Panatilihing lihim ito ng kompanya.'],
      ['Bereavement Leave', '3', '@company@', 'Tatlong (3) araw na may bayad kapag namatay ang asawa, anak, magulang, kapatid, lolo o lola, o biyenan. Magpaalam nang maaga hangga\'t kaya; magsumite ng patunay ng pagkamatay pagbalik.'],
    ], SW, { left: [3] })];
  })(),
  gap(160),
  new d.Paragraph({
    heading: d.HeadingLevel.HEADING_3, spacing: { before: 180, after: 80 }, keepNext: true,
    children: [run('Leave na walang bayad (LWOP)', { size: 21, bold: true, color: C.green }),
               run('   ', { size: 21 })].concat(benefitRun('company')),
  }),
  p('Ang empleyadong wala nang natitirang leave credits ay puwedeng mag-apply ng leave na walang bayad. Kailangan nito ang pag-apruba ng supervisor at ng HRD, at kung apektado ang site ng kliyente, ang pakikipag-ugnayan sa kliyente. Isumite ang kahilingan kahit dalawang (2) linggo bago ito kung inaasahan ang pangangailangan. Hindi karapatan ang LWOP; gayunman, hindi dapat basta tanggihan ang pag-apruba kung mabigat ang dahilan.'),
  p('Ang aprubadong LWOP ay hindi pumuputol sa pagpapatuloy ng serbisyo, ngunit hindi kasama ang mga araw na iyon sa pagbilang ng benepisyong nakabatay sa haba ng serbisyo.'),

  secHead('5.4  Payroll at Timekeeping'),
  bullet([B('Araw ng sahod. '), run('Sahod tuwing kinsenas — sa ika-15 at sa huling araw ng buwan. Kung ang araw ng sahod ay rest day o holiday, ibibigay ito sa nakaraang araw ng trabaho. Hindi lalagpas sa labing-anim (16) na araw ang pagitan ng bayaran.')]),
  bullet([B('Direktang deposito. '), run('Idinideposito ang sahod nang diretso sa bank account ng empleyado. Hindi sisingilin ang empleyado sa pagpapanatili ng payroll account.')]),
  bullet([B('Payslip. '), run('Bawat empleyado ay tatanggap ng payslip kada sahod na nagsasaad ng panahong sakop, oras na pinasukan, overtime, dagdag-bayad, gross pay, bawat bawas nang hiwa-hiwalay, at net pay. Ibibigay ito nakalimbag man o elektroniko.')]),
  bullet([B('Legal na bawas lamang. '), run('Ang bawas lamang na pinapayagan ng batas — SSS, PhilHealth, Pag-IBIG, withholding tax — o ang bawas na may nakasulat na pahintulot ng empleyado para sa sarili niyang pakinabang ang gagawin. Walang bawas na gagawin bilang multa, bilang parusa, o sa oras na talagang pinasukan. Tingnan ang Seksyon 3.12.')]),
  bullet([B('Tanong sa sahod. '), run('Ang empleyadong naniniwalang may mali sa sahod niya ay dapat magsabi sa supervisor o sa HRD. Kapag napatunayang may mali, itatama ito sa susunod na regular na payroll, o mas maaga kung malaki ang halaga.')], { after: 160 }),

  secHead('5.5  Panuntunan sa Holiday Pay'),
  p('Saklaw ng panuntunan sa holiday pay ang lahat ng empleyado, maliban sa mga tahasang hindi kasama ayon sa batas (managerial na empleyado, field personnel na hindi matiyak ang oras, at ang iba pang kategoryang nasa Artikulo 82 ng Labor Code). Kung ang isang empleyado ba ay "field personnel" ay nakabatay sa tunay na pangyayari sa pamamahala at pag-uulat, hindi sa titulo ng trabaho.'),
  subHead('Mga regular holiday'),
  p('May karapatan ang empleyado sa isandaang porsyento (100%) ng basic wage sa regular holiday na hindi pinasukan, basta pumasok siya o nasa bayad na leave sa araw ng trabaho bago nito. Ang pumasok sa regular holiday ay may karapatan sa dalawang daang porsyento (200%).'),
  ...(() => {
    const HW = [4873, 4873];
    return [simpleTable(['REGULAR HOLIDAY', 'PETSA'], [
      ['Bagong Taon', 'Enero 1'], ['Araw ng Kagitingan', 'Abril 9'],
      ['Huwebes Santo', 'Nagbabago'], ['Biyernes Santo', 'Nagbabago'],
      ['Araw ng Paggawa', 'Mayo 1'], ['Araw ng Kalayaan', 'Hunyo 12'],
      ['Araw ng mga Bayani', 'Huling Lunes ng Agosto'], ['Araw ni Bonifacio', 'Nobyembre 30'],
      ['Araw ng Pasko', 'Disyembre 25'], ['Araw ni Rizal', 'Disyembre 30'],
      ['Eid al-Fitr', 'Nagbabago'], ['Eid al-Adha', 'Nagbabago'],
      ['Araw na itinakda ng batas para sa halalan', 'Ayon sa proklamasyon'],
    ], HW)];
  })(),
  gap(160),
  subHead('Mga special (non-working) day'),
  p('Ipinapatupad ang prinsipyong "walang pasok, walang sahod". Ang pumasok sa special non-working day ay may karapatan sa dagdag na tatlumpung porsyento (30%) ng basic daily rate.'),
  ...(() => {
    const HW = [4873, 4873];
    return [simpleTable(['SPECIAL (NON-WORKING) DAY', 'PETSA'], [
      ['Bagong Taon ng mga Tsino', 'Nagbabago'], ['Anibersaryo ng EDSA People Power', 'Pebrero 25'],
      ['Sabado de Gloria', 'Nagbabago'], ['Araw ni Ninoy Aquino', 'Agosto 21'],
      ['Araw ng mga Santo', 'Nobyembre 1'], ['Araw ng mga Kaluluwa', 'Nobyembre 2'],
      ['Bisperas ng Pasko', 'Disyembre 24'], ['Huling araw ng taon', 'Disyembre 31'],
    ], HW)];
  })(),
  gap(140),
  p('Ipinapatupad ng kompanya ang mga holiday sa itaas maliban kung ito ay suspindihin, ilipat, o baguhin ng proklamasyon ng Pangulo o ng batas, at ipapatupad din ang anumang karagdagang araw na ipahayag. Ang opisyal na holiday pay advisory ng DOLE bawat taon ang masusunod kaysa sa listahang ito.'),

  secHead('5.6  Mga Benepisyo Ayon sa Batas'),
  p([run('Ang bawat benepisyo sa Seksyong ito ay '), ...benefitRun('mandatory', 17), run(' — kailangan ng batas ang bawat isa, at wala rito ang puwedeng bawasan, isuko, o ipagpalit. Makukuha ito ng lahat ng empleyado, probationary man o regular, maliban kung diskwalipikado sa ilalim mismo ng batas:')]),
  bullet('Social Security System (SSS) — kasama ang benepisyo sa sakit, panganganak, kapansanan, pagreretiro, kamatayan, at libing, at ang Employees\' Compensation Program.'),
  bullet('PhilHealth — pambansang segurong pangkalusugan.'),
  bullet('Pag-IBIG Fund (HDMF) — ipon at pautang sa pabahay.'),
  bullet('13th month pay — hindi bababa sa ikalabindalawang bahagi (1/12) ng basic salary na kinita sa loob ng taon, ibibigay hindi lalampas ng ika-24 ng Disyembre, sa lahat ng rank-and-file na empleyadong nakapagtrabaho nang kahit isang buwan sa taon, anuman ang katayuan at paraan ng pagbabayad ng sahod. Ang umalis bago ang bayaran ay may karapatan sa katumbas na bahagi.'),
  bullet('Service Incentive Leave at ang mga leave ayon sa batas na nasa Seksyon 5.3.'),
  bullet('Retirement pay sa ilalim ng Republic Act No. 7641 para sa empleyadong umabot sa animnapung (60) taong gulang, o sa sapilitang edad na animnapu\'t lima (65), na may kahit limang (5) taong serbisyo.', { after: 160 }),
  p('Ipinapasa ng kompanya ang lahat ng kontribusyon at bayad sa utang na ibinawas sa sahod sa kaukulang ahensya sa loob ng takdang panahon. Puwedeng tingnan mismo ng mga empleyado ang naitalang kontribusyon nila sa bawat ahensya, at tutulungan sila ng HRD dito.'),
  gap(60),
  note('Mga benepisyong bigay ng kompanya nang higit sa batas', [
    [run('Puwedeng magbigay ang kompanya ng benepisyong higit sa hinihingi ng batas. Ang ganoong benepisyo ay may markang '), ...benefitRun('company', 17), run(' saan man ito lumitaw sa Bahaging ito. Sa petsa ng edisyong ito, ito ang mga iyon: bereavement leave (Seksyon 5.3), leave na walang bayad (Seksyon 5.3), at anumang dagdag-bayad na higit sa pinakamababang itinakda ng batas sa ilalim ng kontrata sa kliyente o ng naitatag nang kaugalian (Seksyon 5.2).')],
    'Ang benepisyong bigay ng kompanya ay kusang-loob lamang hanggang sa maging nakagawian ito. Kapag naibigay na ito ng kompanya nang regular at sinadya sa paglipas ng panahon, pinipigilan ng Artikulo 100 ng Labor Code ang pagbawi o pagbawas dito nang basta-basta — kasingtibay na ito ng benepisyong hinihingi ng batas. Kaya dapat ituring ng HRD ang pagbibigay ng bagong benepisyo bilang pangmatagalang pangako, at itala ang batayan ng pagkakaloob nito.',
  ], { edge: C.volTxt, fill: 'EEF7F6', labelColor: C.volTxt }),

  secHead('5.7  Kaligtasan at Kalusugan sa Trabaho', 'new'),
  p('Sumusunod ang kompanya sa Republic Act No. 11058 at Department Order No. 198-18. Sa ilalim ng mga ito, may karapatan ang bawat manggagawang malaman ang panganib sa trabaho niya, mabigyan ng PPE nang libre, mag-report ng aksidente o delikadong kalagayan, at tumanggi sa trabahong may agarang panganib sa buhay o kalusugan.'),
  p('Ang empleyadong may magandang loob na tumanggi sa trabaho dahil sa agarang panganib, o nag-report ng delikadong kalagayan, ay hindi tatanggalin, sususpindihin, ililipat, o pahihirapan dahil dito. Ang ganoong gawa ay napakabigat na paglabag sa ilalim ng Seksyon 4.8.'),
  bullet('Ang PPE na angkop sa gawain ay ibinibigay ng kompanya nang libre. Hindi kailanman sisingilin o ibabawas sa sahod ng kahit sinong empleyado ang halaga nito.'),
  bullet(L.pick(
    'Magpapanatili ang kompanya ng first aid at magkakaroon ng sanay na first-aider, safety officer, at health and safety committee ayon sa bilang ng tauhan. Nasa Annex F kung paano nagbabago ang mga kailangang ito habang lumalaki ang kompanya.',
    'Magpapanatili ang kompanya ng first aid at magkakaroon ng sanay na first-aider, safety officer, at health and safety committee ayon sa bilang ng tauhan.')),
  bullet('Kukumpletuhin ng lahat ng empleyado ang sapilitang walong (8) oras na seminar sa kaligtasan at kalusugan, at ang mga nakalantad sa partikular na panganib ay tatanggap ng training para roon.'),
  bullet('Ang aksidente, sugat, at sakit na may kinalaman sa trabaho ay ire-report agad sa loob ng kompanya at sa DOLE sa takdang panahon, at itatala sa logbook ng kompanya.'),
  bullet('Nagsasagawa ang kompanya ng pre-employment at taunang medical exam sa sarili nitong gastos. Ang resulta ay confidential na impormasyong medikal, hawak ng HRD nang hiwalay sa 201 file, at ibubunyag lamang kung papayagan ng empleyado o hihingin ng batas.', { after: 160 }),

  secHead('5.8  Lugar ng Trabahong Walang Droga', 'rev'),
  p('Nagpapanatili ang kompanya ng lugar ng trabahong walang droga alinsunod sa Republic Act No. 9165 at Department Order No. 53-03. May apat na bahagi ang programa: adbokasiya at edukasyon; drug testing; gamutan at rehabilitasyon; at, kung nararapat, disiplina.'),
  bullet([B('Pag-test. '), run('Ang random drug testing ay isasagawa ng laboratoryong akreditado ng Department of Health, gamit ang itinakdang proseso nito. Ang mga piniling empleyado ay pipiliin sa paraang talagang random at may dokumento. Ang kompanya ang magbabayad.')]),
  bullet([B('Confirmatory test. '), run('Ang positibong screening ay HINDI pa patunay ng paggamit ng droga. Kailangan itong kumpirmahin ng confirmatory test sa laboratoryong akreditado ng DOH bago ang anumang aksyon. May karapatan ang empleyadong kuwestiyunin ang positibong confirmatory result sa loob ng labinlimang (15) araw sa pamamagitan ng paghiling ng re-test sa sarili niyang gastos.')]),
  bullet([B('Walang on-the-spot na pag-test. '), run(L.pick(
    'Sa dating edisyon, puwedeng mag-test ang kompanya batay sa hinala at pilitin ang pagbibigay ng sample sa mismong sandali. Hindi ito pinapayagan. Kung may makatuwirang dahilan ang kompanyang maniwalang lasing sa droga ang isang empleyado sa trabaho, aalisin muna siya sa anumang gawaing kritikal sa kaligtasan, at ipapadala ang usapin para sa pag-test sa akreditadong laboratoryo sa ilalim ng mga proteksyong nasa itaas.',
    'Hindi mag-te-test ang kompanya sa mismong sandali, at hindi ka pipiliting magbigay ng ihi o dugo batay lamang sa hinala. Kung may makatuwirang dahilan ang kompanyang maniwalang lasing sa droga ang isang empleyado sa trabaho, aalisin muna siya sa anumang gawaing kritikal sa kaligtasan, at ipapadala ang usapin para sa pag-test sa akreditadong laboratoryo sa ilalim ng mga proteksyong nasa itaas.'))]),
  bullet([B('Kompidensyalidad. '), run('Lahat ng resulta ng test ay confidential na impormasyong medikal. Ang pagbubunyag nito nang walang pahintulot ay paglabag sa ilalim ng Seksyon 4.6 at paglabag din sa Data Privacy Act.')]),
  bullet([B('Gamutan muna sa paggamit. '), run('Ang opisyal o empleyadong napatunayang positibo sa PAGGAMIT ng droga, sa kumpirmadong test, ay ipapadala sa gamutan at rehabilitasyon sa sentrong akreditado ng DOH. Ipapatupad ang pagtanggal sa ilalim ng Code na ito kung tatanggi ang empleyado sa referral, hindi niya matapos ang programa, muling maging positibo pagkatapos nito, o kung ang gawa ay may kinalaman sa pagdadala, pagbebenta, pamimigay, o pagiging lasing sa droga habang gumagawa ng gawaing kritikal sa kaligtasan.')], { after: 160 }),

  secHead('5.9  Laban sa Sexual Harassment at Ligtas na Espasyo', 'new'),
  p('Ipinapatupad ng kompanya ang Republic Act No. 7877 (Anti-Sexual Harassment Act) at ang Republic Act No. 11313 (Safe Spaces Act). Inaatasan ng dalawang batas ang employer na pigilan ang harassment, magbigay ng proseso para sa reklamo, at kumilos dito.'),
  subHead('Committee on Decorum and Investigation (CODI)'),
  p('Bubuo ang kompanya ng Committee on Decorum and Investigation na binubuo ng kahit tig-isang kinatawan mula sa pamunuan, sa mga empleyado, at, kung mayroon, sa hanay ng supervisor — na may balanseng representasyon ng kasarian. Tatanggap ang mga miyembro ng training sa gender sensitivity at sa paghawak ng reklamo. Ang CODI, hindi ang Administrative Review Panel, ang humahawak ng reklamo sa sexual harassment at gender-based na sexual harassment.'),
  subHead('Ano ang bawal'),
  bullet('Ang paghingi o pag-atas ng pabor na seksuwal kapalit ng pagkuha sa trabaho, pagpapatuloy ng trabaho, promotion, magandang evaluation, assignment, o kahit anong benepisyo — tinanggap man ang hiling o hindi.'),
  bullet('Ang hindi ginustong seksuwal na panunuyo, komento, biro, kilos, o pagpapakita ng malaswang materyal.'),
  bullet('Ang gender-based na harassment sa ilalim ng RA 11313, kasama ang catcalling, wolf-whistling, paulit-ulit na hindi ginustong komento sa hitsura ng tao, panlalait sa kasarian o sa pagkatao, paulit-ulit na malaswang biro, hindi ginustong paanyaya, at pagsunod-sunod — kasama na kung ginawa online o sa mensahe.'),
  bullet('Ang pag-upload, pag-share, o pagbabantang i-share ang malalaswang larawan o pribadong impormasyon ng isang kasamahan.', { after: 140 }),
  p('Puwedeng gawin ng kahit sino laban sa kahit sino ang harassment, anuman ang kasarian o ranggo, at hindi mahalaga kung may relasyon ba ng awtoridad sa pagitan nila.'),
  subHead('Paano magreklamo'),
  p('Puwedeng gawin ang reklamo sa kahit sinong miyembro ng CODI, sa HRD, o sa May-ari o General Manager, nakasulat man o pasalita. Kung pasalita, isusulat ito ng tumanggap at pipirmahan ng nagreklamo bilang pagkumpirma. Kikilusan ang reklamo sa loob ng sampung (10) araw mula sa paghahain, at tatapusin ang imbestigasyon sa makatuwirang panahon.'),
  p('Ang pagkakakilanlan ng nagreklamo at ang detalye ng reklamo ay pananatilihing lihim at ibubunyag lamang sa mga kailangang makaalam para makapag-imbestiga, o hanggang sa hinihingi ng karapatan sa tamang proseso ng inirereklamo. May karapatan ang inirereklamo sa parehong tamang proseso sa Seksyon 3.6, kasama ang nakasulat na paunawa ng mismong gawang inirereklamo.'),
  p('Puwedeng gumawa ng pansamantalang hakbang — paghiwalay sa dalawang panig, pagpapalit ng assignment o reporting line, pag-aayos ng iskedyul — para protektahan ang nagreklamo habang may imbestigasyon. Hindi dapat makasama sa nagreklamo ang mga hakbang na ito, gaya ng paglipat sa mas mabigat na assignment o mas mababang rate.'),
  p('Walang anuman sa prosesong ito ang humahadlang sa nagreklamong maghain din ng kasong kriminal o sibil, o ng reklamo sa DOLE, sa Commission on Human Rights, o sa Philippine Commission on Women. Hindi pipiliting pumili ng nagreklamo sa pagitan ng panloob at panlabas na remedyo.'),
  note('Paghihiganti laban sa nagreklamo', [
    'Ang paghihiganti sa taong naghain ng reklamo sa harassment nang may magandang loob, o nagbigay ng ebidensya rito, ay paglabag na Napakabigat na may parusang pagtanggal — matuloy man o hindi ang orihinal na reklamo.',
  ], { edge: C.Dtxt, fill: 'FDF0F0', labelColor: C.Dtxt }),

  secHead('5.10  Mental Health at Hindi Pagtatangi sa Kalusugan', 'new'),
  p('Sa ilalim ng Republic Act No. 11036, magpapalaganap ang kompanya ng kamalayan tungkol sa mental health, magbibigay ng daan sa serbisyo, at ituturing ang kondisyong pangkaisipan bilang usaping pangkalusugan at hindi usaping disiplinaryo. Ang empleyadong humihingi ng tulong para sa kondisyong pangkaisipan ay hindi paparusahan, at lihim ang impormasyon tungkol dito.'),
  p('Sa ilalim ng Republic Act No. 11166 (HIV at AIDS), Department Order No. 73-05 (tuberculosis), at Department Order No. 05-10 (Hepatitis B), walang empleyado o aplikanteng pipilitin ipaalam ang kanyang katayuan, sasailalim sa sapilitang pag-test bilang kondisyon sa trabaho, tatanggalin, tatanggihan ng benepisyo, o tatangihan dahil sa tunay o pinaghihinalaang katayuan. Mahigpit na lihim ang impormasyong ito.'),
  p('Kung ang isang kondisyon sa kalusugan ay talagang nakakaapekto sa kakayahan ng empleyadong gawin nang ligtas ang isang gawain, isasaalang-alang muna ng kompanya ang makatuwirang pag-aayos — pagpapalit ng gawain, ng iskedyul, o ng assignment — bago ang anumang ibang aksyon. Ang paghihiwalay dahil sa sakit ay nangangailangan ng sertipikasyon mula sa kinauukulang public health authority na ang sakit ay hindi magagamot sa loob ng anim (6) na buwan kahit may tamang paggamot, at may kaakibat itong separation pay ayon sa batas.'),
];

// =========================================================== BAHAGI VI
const part6 = () => [
  ...partHead('BAHAGI VI', 'Mga Aksyon sa Trabaho at Paghihiwalay'),

  secHead('6.1  Promotion, Transfer, at Muling Pag-uuri'),
  p('Sinusuportahan ng kompanya ang paglago ng kwalipikadong empleyado. Ang bakanteng posisyon ay ipapaalam sa loob ng kompanya bago o kasabay ng pag-anunsyo nito sa labas, para may patas na pagkakataong mag-apply ang mga kasalukuyang empleyado.'),
  bullet([B('Lateral transfer. '), run('Paglipat sa ibang posisyon na pareho ang salary range. Puwedeng ilipat ng kompanya ang empleyado kung kailangan ng negosyo, basta hindi ito pagbaba ng ranggo, hindi nababawasan ang sahod o benepisyo, hindi ito walang katuwiran, abala, o nakakasama sa empleyado, at hindi ito ginagamit bilang parusa.')]),
  bullet([B('Promotion. '), run('Paglipat sa posisyong mas mataas ang pay grade. Nakabatay ito sa record ng performance, sa napatunayang kakayahan, at sa pangangailangan ng posisyon. Ang bagong na-promote ay puwedeng ilagay sa promotional probation na hanggang anim (6) na buwan; kung hindi maabot ang pamantayan ng bagong posisyon, babalik siya sa dating posisyon sa dating rate — at hindi kailanman tatanggalin.')]),
  bullet([B('Muling pag-uuri. '), run('Pagbabago sa tungkuling nakakabit sa isang posisyon. Kung malaki ang pagbabago, kailangan ang pahintulot ng empleyado, at kung karapat-dapat ang pagbabago ng pay grade, aayusin ang sahod.')], { after: 160 }),

  secHead('6.2  Pagsusuri ng Performance', 'rev'),
  p('Ang pormal na performance evaluation ay ginagawa dalawang beses sa isang taon para sa regular na empleyado, at sa ikatlo at ikalimang buwan para sa probationary. Ire-rate ng supervisor ang empleyado laban sa pamantayan ng posisyon at tatalakayin ang rating sa kanya. May karapatan ang empleyadong makita ang natapos na evaluation, magsulat ng komento rito, at makakuha ng kopya.'),
  p('Kung mababa sa pamantayan ang performance, ang tugon ay nakasulat na Performance Improvement Plan (PIP), hindi disiplina. Dapat nakasaad sa PIP ang mismong kakulangan, ang pamantayang dapat abutin, ang suporta at training na ibibigay ng kompanya, at ang panahong susuriin na hindi bababa sa animnapung (60) araw. Kung hindi lamang naabot ng empleyado ang pamantayan matapos ang tunay na PIP saka puwedeng isaalang-alang ng kompanya ang paghihiwalay dahil sa malubha at paulit-ulit na kapabayaan o kawalan ng kakayahan, sa proseso ng Seksyon 3.6.'),
  note('Ang mahinang performance ay hindi maling asal', [
    'Ang empleyadong nagsisikap ngunit hindi maabot ang pamantayan ay kailangan ng training. Ang empleyadong may kakayahan ngunit ayaw gumawa ay kailangan ng disiplina. Ang pagtrato sa una na parang pangalawa ang pinakamadalas at pinakamahal na pagkakamali ng isang employer.',
  ], { edge: C.blue, fill: 'EEF3FB', labelColor: C.navy }),

  secHead('6.3  Pagtatapos ng Trabaho ng Employer'),
  p('Puwedeng tapusin ng kompanya ang trabaho dahil lamang sa malubha o awtorisadong dahilan, at pagkatapos lamang sundin ang naaangkop na proseso.'),
  subHead('Malubhang dahilan (Artikulo 297) — walang separation pay'),
  bullet('Malubhang maling asal, o sadyang pagsuway sa legal na utos ng employer kaugnay ng trabaho ng empleyado.'),
  bullet('Malubha at paulit-ulit na kapabayaan sa tungkulin.'),
  bullet('Pandaraya, o sadyang pagsira sa tiwalang ipinagkaloob ng employer sa empleyado.'),
  bullet('Paggawa ng krimen laban sa employer, sa kapamilya nito, o sa awtorisadong kinatawan nito.'),
  bullet('Iba pang dahilang katulad ng mga nabanggit.', { after: 140 }),
  p('Proseso: ang panuntunan ng dalawang sulat sa Seksyon 3.6 — Notice to Explain, kahit limang araw ng kalendaryo para sumagot, pagkakataong marinig, at Notice of Decision.'),
  subHead('Awtorisadong dahilan (Artikulo 298 at 299) — may separation pay'),
  ...(() => {
    const AW = [3900, 2200, 3646];
    return [simpleTable(['AWTORISADONG DAHILAN', 'SEPARATION PAY', 'PROSESO'], [
      ['Paglalagay ng makinang papalit sa tao', '1 buwang sahod o 1 buwan kada taon ng serbisyo, alinman ang mas mataas', 'Nakasulat na paunawa sa empleyado AT sa DOLE kahit 30 araw bago ang petsa ng bisa'],
      ['Redundancy', '1 buwang sahod o 1 buwan kada taon ng serbisyo, alinman ang mas mataas', 'Ganoon ding 30-araw na dalawahang paunawa; dapat ipakita ng kompanya ang patas na batayan ng pagpili'],
      ['Retrenchment para maiwasan ang lugi', '1 buwang sahod o 1/2 buwan kada taon ng serbisyo, alinman ang mas mataas', 'Ganoon ding 30-araw na paunawa; dapat patunayan ng kompanya ang malaki at nalalapit na lugi'],
      ['Pagsasara na hindi dahil sa malubhang lugi', '1 buwang sahod o 1/2 buwan kada taon ng serbisyo, alinman ang mas mataas', 'Ganoon ding 30-araw na paunawa'],
      ['Pagsasara dahil sa malubhang lugi', 'Wala', 'Ganoon ding 30-araw na paunawa; dapat patunayan ang lugi'],
      ['Sakit (Artikulo 299)', '1 buwang sahod o 1/2 buwan kada taon ng serbisyo, alinman ang mas mataas', 'Sertipikasyon ng kinauukulang public health authority na hindi magagamot ang sakit sa loob ng 6 na buwan; 30-araw na paunawa'],
    ], AW, { left: [2] })];
  })(),
  gap(140),
  p('Ang bahaging hindi bababa sa anim (6) na buwan ng serbisyo ay bibilangin bilang isang (1) buong taon sa pagkuwenta ng separation pay.'),
  p('Ang empleyadong tinanggal dahil sa malubhang dahilan ay walang karapatan sa separation pay. Gayunman, puwedeng magbigay ang kompanya ng tulong pinansyal bilang awa kung ang dahilan ay walang kinalaman sa malubhang maling asal o sa gawang sumisira sa moral na pagkatao.'),

  secHead('6.4  Pagbibitiw', 'rev'),
  p('Ang empleyadong balak magbitiw ay magbibigay ng nakasulat na paunawa kahit tatlumpung (30) araw ng kalendaryo bago ang balak na petsa, para makapag-ayos ang kompanya ng maayos na turnover at, kung may kinalaman ang site ng kliyente, maipaalam ito sa kliyente. Puwedeng bawasan o alisin ng kompanya ang panahong ito.'),
  p('Puwedeng magbitiw ang empleyado nang walang tatlumpung araw na paunawa, at walang pananagutan, sa alinman sa mga malubhang dahilan sa Artikulo 300(b) ng Labor Code: malubhang insulto ng employer o ng kinatawan nito sa dangal at pagkatao ng empleyado; hindi makataong pagtrato; paggawa ng krimen laban sa empleyado o sa malapit niyang pamilya ng employer o ng kinatawan nito; at iba pang dahilang katulad nito.'),
  note('Inaalis ang dalawang buwang liquidated damages', [
    L.pick(
      'Sa dating edisyon, ang empleyadong hindi nakapagbigay ng tatlumpung araw na paunawa ay "mananagot sa liquidated damages na katumbas ng hindi bababa sa dalawang (2) buwang sahod". Inaalis ang probisyong ito.',
      'Hindi naniningil ang kompanya ng liquidated damages sa empleyadong hindi nakapagbigay ng tatlumpung (30) araw na paunawa ng pagbibitiw.'),
    'Ang employer na talagang napinsala ng biglaang pagbibitiw ay puwedeng habulin ang pinsalang iyon sa tamang tanggapan, ngunit kailangan niyang patunayan ito. Ang HINDI puwedeng gawin ng kompanya ay ipagkait ang huling sahod, ipagkait ang Certificate of Employment, o magbawas ng parusa sa sahod dahil maikli ang paunawa. Ang mga gawang iyon ay naglalagay sa kompanya sa panganib ng money claim at ng natuklasang iligal na bawas.',
  ], { edge: C.Dtxt, fill: 'FDF0F0', labelColor: C.Dtxt }),
  gap(160),
  p('Ang pagbibitiw na tinanggap na ay puwedeng bawiin lamang kung papayag ang kompanya. Hindi pipiliting magbitiw ang empleyado kapalit ng pagharap sa prosesong disiplinaryo; ang pagbibitiw na nakuha sa ganoong paraan ay hindi kusang-loob.'),

  secHead('6.5  Huling Sahod, Clearance, at Certificate of Employment', 'new'),
  p('Ibibigay ang huling sahod sa loob ng tatlumpung (30) araw ng kalendaryo mula sa petsa ng paghihiwalay, alinsunod sa DOLE Labor Advisory No. 06-20, maliban kung mas maaga ang itinatakda ng patakaran o kasunduan ng kompanya. Kasama sa huling sahod ang:'),
  bullet('hindi pa nababayarang sahod hanggang sa huling araw na talagang pinasukan;'),
  bullet('katumbas na bahagi ng 13th month pay;'),
  bullet('pagpapalit sa pera ng hindi nagamit na Service Incentive Leave;'),
  bullet('separation pay, kung ang paghihiwalay ay dahil sa awtorisadong dahilan o kung kailangan ito;'),
  bullet('retirement pay, kung naaangkop;'),
  bullet('anumang halagang nararapat sa ilalim ng patakaran ng kompanya, ng personal na kasunduan, o ng collective agreement.', { after: 140 }),
  p('Clearance. Isasauli ng empleyado ang lahat ng ari-arian ng kompanya — kasangkapan, instrumento, ID, uniform, telepono, laptop, susi, dokumento — at aayusin ang mga pananagutan. Ang clearance ay ipoproseso agad at hindi gagamitin para maantala ang huling sahod lagpas sa tatlumpung araw. Kung pinagtatalunan ang isang partikular na pananagutan, ilalabas ng kompanya sa takdang panahon ang bahaging hindi pinagtatalunan.'),
  p('Certificate of Employment. Ang Certificate of Employment na nagsasaad ng petsa ng pagpasok at paglabas at ng posisyong hinawakan ay ibibigay sa loob ng tatlong (3) araw mula sa paghiling, kahit kailan, nagbitiw man o natanggal, at natapos man o hindi ang clearance. Hindi kailanman gagawing kondisyon ang pagpirma ng quitclaim bago ito ibigay.'),
  p('Quitclaim. Kusang-loob ang quitclaim. May karapatan ang empleyadong basahin ito, iuwi muna, at humingi ng payo bago pumirma. Ang quitclaim na pinirmahan para sa halagang malinaw na mas mababa sa nararapat, o pinirmahan sa ilalim ng pamimilit, ay hindi humahadlang sa paghahabol sa bandang huli.'),
  p('Exit interview. Inaanyayahan ang umaalis na empleyado sa exit interview. Kusang-loob ito. Layunin nitong mangalap ng impormasyon para mapabuti ang patakaran ng kompanya, at ang sinabi rito ay hindi makakaapekto sa huling sahod, sa Certificate of Employment, o sa pagiging kwalipikadong muling matanggap sa trabaho.'),
];

module.exports = { part5, part6 };
