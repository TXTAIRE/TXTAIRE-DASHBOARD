const L = require('./lib.js');
const { d, C, W, run, p, bullet, gap, pageBreak, partHead, secHead, subHead,
        cell, tCell, table, note } = L;

const B = (t) => run(t, { bold: true });

// =========================================================== BAHAGI I
const part1 = () => [
  ...partHead('BAHAGI I', 'Panimula at Pangkalahatang Patakaran'),

  secHead('1.1  Layunin at Saklaw'),
  p('Ang Code of Discipline na ito ay tipon ng mga patakaran sa tauhan, mga alituntunin sa trabaho, at proseso ng disiplina na ipinapatupad sa TXTAIRE OPC. Layunin nitong sabihin sa bawat empleyado, sa simpleng pananalita, kung ano ang inaasahan ng kompanya, kung ano ang mangyayari kapag hindi ito natupad, at kung anong mga karapatan mayroon ang isang empleyado kapag may reklamo laban sa kanya.'),
  p('Saklaw nito ang lahat ng empleyado ng TXTAIRE OPC — probationary, regular, project-based, fixed-term, at part-time — nakatalaga man sa opisina sa Laguna, sa Maynila, o sa kahit anong site ng kliyente. Ipinapatupad ito sa oras ng trabaho, habang nasa opisyal na gawain o call-out, habang gumagamit ng ari-arian o sasakyan ng kompanya, at habang nasa loob ng kompanya o ng kliyente.'),
  p('Ang mga bagay na ginagawa sa labas ng oras ng trabaho at malayo sa kompanya at sa kliyente ay pribadong usapin at hindi saklaw ng Code na ito — maliban kung ito ay tuwirang may kinalaman sa trabaho mo, ginawa laban sa kompanya, sa kasamahan, o sa kliyente, o nagdulot ng nakikitang pinsala sa negosyo o pangalan ng kompanya.'),

  secHead('1.2  Pananagutan sa Pagpapatupad'),
  p('Ang Human Resources Department (HRD) ang mangangasiwa sa Code na ito. Responsibilidad ng HRD na ipamahagi ito, ipaliwanag ito sa orientation, itago ang record ng disiplina ng lahat ng empleyado, tiyaking may tamang proseso sa bawat kaso, at suriin ang Code na ito kahit isang beses bawat taon.'),
  p('Titiyakin ng mga supervisor at Department Head na nabasa at naintindihan ng mga tauhan nila ang Code na ito, itatama nila agad ang maliliit na pagkakamali kung sapat na iyon, at ire-report nila sa HRD ang mga paglabag sa loob ng limang (5) araw ng trabaho mula nang malaman nila ito. Ang supervisor na umupo lang sa isang paglabag na alam niya ay may sarili ring pananagutan sa ilalim ng Seksyon 4.8.'),
  p('Responsibilidad ng bawat empleyado na basahin ang Code na ito, magtanong sa anumang hindi malinaw, at sundin ito. Hindi depensa ang hindi pagkaalam sa isang probisyon nito, ngunit kailangang mapatunayan ng HRD na talagang naipamahagi at naipaliwanag ang Code.'),

  secHead('1.3  Pantay na Oportunidad at Hindi Pagtatangi'),
  p('Nagbibigay ang TXTAIRE OPC ng pantay na oportunidad sa trabaho. Hindi magtatangi ang kompanya laban sa kahit sinong empleyado o aplikante batay sa kasarian, gender identity o pagpapahayag nito, seksuwal na oryentasyon, edad, katayuang sibil, pagbubuntis, relihiyon, paniniwalang pulitikal, etnisidad, katutubong pinagmulan, kapansanan, katayuan sa kalusugan kasama ang HIV, Hepatitis B, o tuberculosis, o katayuan bilang solo parent.'),
  p('Ipinapatupad ito sa pagkuha ng tauhan, sahod, benepisyo, training, assignment, promotion, transfer, disiplina, at paghihiwalay. Sinusuportahan ito ng Republic Act No. 6725 at Artikulo 133 ng Labor Code (kababaihan), Republic Act No. 10911 (edad), Republic Act No. 7277 na sinusugan (may kapansanan), Republic Act No. 11166 (HIV at AIDS), Republic Act No. 11036 (mental health), at Republic Act No. 11861 (solo parent).'),
  p('Ang empleyadong naniniwalang tinangi siya ay puwedeng magdala nito sa ilalim ng Seksyon 2.10. Ang pagtatangi ng isang supervisor o manager ay napakabigat na paglabag sa ilalim ng Seksyon 4.8.'),

  secHead('1.4  Patakaran sa Probationary na Empleyado'),
  p('Hindi lalagpas sa anim (6) na buwan ang probationary period mula sa araw na talagang nagsimulang magtrabaho ang empleyado, maliban kung mas mahabang panahon ang pinapayagan ng batas o kailangan ng isang apprenticeship o training agreement.'),
  p('Sa oras ng pagkuha, at nakasulat, ipapaalam ng kompanya sa probationary na empleyado ang makatuwirang pamantayang dapat niyang abutin para maging regular. Kung hindi naipaalam ng kompanya ang pamantayang iyon sa simula, ituturing na regular ang empleyado mula pa sa unang araw.'),
  p('Susuriin ng supervisor ang probationary na empleyado nang nakasulat, kahit dalawang beses sa loob ng panahong iyon — sa ikatlong buwan at bago matapos ang ikalimang buwan — at tatalakayin ang bawat evaluation sa empleyado para may panahon pang maitama ang anumang kakulangan.'),
  p('Puwedeng ihiwalay ang probationary na empleyado (a) dahil sa malubha o awtorisadong dahilan, sa proseso ng Seksyon 3.6, o (b) dahil hindi naabot ang naipaalam na pamantayan para sa regularization. Sa pangalawa, magbibigay ang kompanya ng nakasulat na paunawang nagsasaad kung aling pamantayan ang hindi naabot, kahit limang (5) araw bago ang balak na petsa ng paghihiwalay. May karapatan sa tamang proseso ang probationary na empleyado; walang basta-bastang kapangyarihan ang kompanyang magtanggal kahit kailan nito gusto.'),
  p('Ang empleyadong pinayagang magtrabaho lagpas sa anim na buwang probationary period ay nagiging regular sa bisa ng batas.'),

  secHead('1.5  Kahulugan ng mga Termino'),
  ...(() => {
    const DW = [2500, 7246];
    const rows = [
      ['Kompanya', 'Ang TXTAIRE OPC, at anumang entidad na pag-aari o pinamamahalaan nito.'],
      ['Empleyado', 'Sinumang taong nagtatrabaho sa kompanya, anuman ang katayuan o klasipikasyon.'],
      ['Paglabag', 'Gawa o pagkukulang na lumalabag sa Code na ito, sa legal na patakaran o utos ng kompanya, o sa batas.'],
      ['Bibig na Babala (VW)', 'Pasalitang pagwawasto nang pribado ng supervisor, na itatala nang nakasulat at isasampa sa HRD.'],
      ['Sulat na Babala (WW)', 'Pormal na nakasulat na paunawa ng paglabag, na nagsasabing mas mabigat na parusa ang susunod kapag inulit. Isasampa sa 201 file mo.'],
      ['Suspensyon (S)', 'Pansamantalang hindi pagpasok bilang parusa, walang sahod, sa nakatakdang bilang ng araw ng trabaho. Sa Code na ito, "3d", "7d" o "15d".'],
      ['Preventive Suspension', 'Pansamantalang pag-alis sa lugar ng trabaho habang may imbestigasyon. HINDI ito parusa at nasa Seksyon 3.8 ang panuntunan.'],
      ['Pagtanggal (D)', 'Pagwawakas ng trabaho dahil sa malubhang dahilan, na nagtatapos sa relasyong employer-employee.'],
      ['NTE', 'Notice to Explain — ang una sa dalawang nakasulat na paunawang kailangan ng batas (Annex A).'],
      ['Panel', 'Ang Administrative Review Panel na binubuo sa ilalim ng Seksyon 3.7.'],
      ['201 File', 'Ang permanenteng record ng empleyado na iniingatan ng HRD.'],
      ['Araw ng trabaho', 'Araw na nakatakdang pumasok ang empleyado, hindi kasama ang rest day at holiday.'],
    ];
    return [table([
      new d.TableRow({
        cantSplit: true, tableHeader: true,
        children: [
          tCell('TERMINO', { w: DW[0], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
          tCell('KAHULUGAN SA CODE NA ITO', { w: DW[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
        ],
      }),
      ...rows.map((r) => new d.TableRow({
        cantSplit: true,
        children: [
          tCell(r[0], { w: DW[0], bold: true, color: C.navy }),
          tCell(r[1], { w: DW[1] }),
        ],
      })),
    ], DW)];
  })(),

  secHead('1.6  Pagbabago sa Manwal at mga Mungkahi'),
  p('Puwedeng baguhin ng kompanya ang Code na ito kapag nakabuo ito ng mas praktikal o mas mabisang proseso, o kapag kailangan ito ng pagbabago sa batas. Ang mga pagbabago ay ilalabas nang nakasulat, ipapaskil, ipamamahagi sa lahat ng empleyado at sa bawat site, at magkakabisa tatlumpung (30) araw matapos ipamahagi. Walang pagbabagong magbabawas ng benepisyong tinatamasa na ng mga empleyado, at walang pagbabagong ilalapat nang paurong sa paglabag na nagawa na.'),
  p('Hinihikayat ang mga empleyadong magbigay ng mungkahi para mapabuti ang Code na ito. Puwedeng ibigay sa HRD nang nakasulat o sa e-mail, at puwedeng walang pangalan.'),
];

// =========================================================== BAHAGI II
const part2 = () => [
  ...partHead('BAHAGI II', 'Pamantayang Etikal ng Kompanya', 'new'),

  p('Nagsisimula ang disiplina sa magkatulad na pag-unawa sa kung ano ang tama. Nakasaad sa Bahaging ito ang pamantayang etikal na inaasahan ng TXTAIRE OPC sa bawat empleyado, opisyal, at direktor. Saklaw nito ang lahat anuman ang ranggo. Kung ang isang gawang nakasaad dito ay nakalista rin bilang paglabag sa Bahagi IV, ang Bahagi IV ang gagamitin; kung hindi, nananatili itong pamantayang inaasahan sa iyo, at puwedeng tugunan ng supervisor ang kakulangan sa pamamagitan ng pagtuturo.'),

  secHead('2.1  Ang mga Pagpapahalaga Natin sa Gawa', 'new'),
  p('Ang anim na pagpapahalaga ng kompanya ay hindi palamuti. May praktikal na kahulugan ang bawat isa sa trabaho:'),
  ...(() => {
    const VW = [2100, 7646];
    const vals = [
      ['RESPETO', 'Magalang tayo sa bawat kasamahan, kliyente, supplier, at sa publiko — kasama na kapag hindi tayo sang-ayon, kapag mabigat ang pressure, at kapag walang nakatingin.'],
      ['PAGKAKAISA', 'Hindi natin sinisira ang kasamahan. Ibinabahagi natin ang impormasyong kailangan niya sa trabaho, at inaayos natin ang problema sa halip na maghanap ng masisisi.'],
      ['DEDIKASYON', 'Ginagawa natin ang sinabi nating gagawin, sa petsang sinabi nating gagawin. Kung hindi natin kaya, sinasabi natin agad at hindi huli.'],
      ['INOBASYON', 'Naghahanap tayo ng mas magandang paraan ng paggawa, at sinasabi natin ito. Ang mungkahing hindi natanggap ay hindi kailanman ibabaling laban sa nagmungkahi.'],
      ['KATAPATAN SA KOMPANYA', 'Iniingatan natin ang interes, impormasyon, at ari-arian ng kompanya at ng kliyente na para bang sa atin, at hindi natin ginagamit ang posisyon natin para sa sariling pakinabang.'],
      ['KATAPATAN', 'Totoo ang isinusulat natin sa timesheet, service report, liquidation, at expense claim — kahit hindi maganda ang lalabas para sa atin.'],
    ];
    return [table(vals.map((v) => new d.TableRow({
      cantSplit: true,
      children: [
        tCell(v[0], { w: VW[0], bold: true, color: 'FFFFFF', fill: C.blue, align: d.AlignmentType.CENTER }),
        tCell(v[1], { w: VW[1] }),
      ],
    })), VW)];
  })(),

  secHead('2.2  Pamantayan sa Pagnenegosyo', 'new'),
  p('Dapat gawin ng bawat empleyado ang mga sumusunod:'),
  bullet('Sundin ang mga batas ng Republika ng Pilipinas, ang Code na ito, at ang legal na patakaran at utos ng kompanya.'),
  bullet('Gawin ang itinakdang trabaho nang may kakayahan, ligtas, at nasa oras, at mag-report nang totoo tungkol sa nagawa.'),
  bullet('Makitungo nang patas sa kliyente, supplier, contractor, kasamahan, at kakumpitensya. Walang empleyadong gagamit ng pandaraya, pagtatago, pang-aabuso ng confidential na impormasyon, o maling pahayag para makakuha ng di-patas na kalamangan.'),
  bullet('Panatilihing tumpak ang mga record. Walang empleyadong gagawa ng peke o mapanlinlang na tala sa anumang record ng kompanya o kliyente, at walang mag-uutos nito sa iba.'),
  bullet('Tanggihan at i-report ang anumang suhol, kickback, o hindi tamang bayad, ibinibigay man o hinihingi, sa pera, sa bagay, o bilang pabor.'),
  bullet('Sabihin ang alalahanin tungkol sa posibleng paglabag sa halip na manahimik, gamit ang mga daan sa Seksyon 2.10.', { after: 160 }),

  secHead('2.3  Conflict of Interest', 'new'),
  p('May conflict of interest kapag ang pribadong interes ng isang empleyado ay puwedeng makaimpluwensya nang hindi tama — o makitang nakakaimpluwensya — sa paraan ng paggawa niya ng trabaho para sa kompanya.'),
  p('Kailangang ideklara nang nakasulat sa HRD ang mga sumusunod, sa loob ng labinlimang (15) araw mula sa pagpasok, o sa loob ng labinlimang (15) araw mula nang mangyari ang sitwasyon, alinman ang mas huli:'),
  bullet('Anumang interes sa pera o pagmamay-ari sa isang supplier, contractor, kakumpitensya, o kliyente ng kompanya, maliban sa share ng kompanyang nakalista sa stock market na hawak bilang karaniwang investment.'),
  bullet('Anumang trabaho sa labas, consultancy, sideline, o negosyo, may kaugnayan man o wala sa kompanya.'),
  bullet('Anumang malapit na personal na relasyon — asawa, partner, magulang, anak, kapatid, o kamag-anak hanggang ikaapat na antas — sa isang kasamahang pinamumunuan o ineevaluate mo, o sa taong nagtatrabaho sa supplier, contractor, o kliyenteng kinakaharap mo para sa kompanya.'),
  bullet('Anumang posisyon sa organisasyong may transaksyon sa kompanya.', { after: 140 }),
  p('Ang pagdeklara ng conflict ay hindi kailanman paglabag at hindi kailanman dahilan ng parusa. Ang hindi pagdeklara nito ang paglabag. Kapag naideklara na, magkakasundo ang HRD at ang Department Head sa makatuwirang ayos — karaniwan ay ang pag-alis sa empleyado sa desisyon tungkol sa bagay na iyon — at itatala ito nang nakasulat.'),
  note('Bakit mahalaga ito sa laki natin', [
    'Sa kompanyang dalawampu ang tao at papalawak sa isandaan, madalas na kakilala ng empleyado ang isang supplier, at malamang may kamag-anak na mag-a-apply. Walang masama roon. Ang masama ay ang magdesisyon tungkol sa bilihin, sa pagkuha ng tao, o sa kontrata habang may itinatagong pribadong interes sa kalalabasan. Ideklara ito, umalis sa desisyon, at wala nang problema.',
  ], { edge: C.blue, fill: 'EEF3FB', labelColor: C.navy }),

  secHead('2.4  Regalo, Komisyon, at Libre', 'new'),
  p('Walang empleyadong hihingi ng regalo, komisyon, diskwento, utang, serbisyo, o pabor mula sa kliyente, supplier, contractor, o aplikante — anuman ang halaga, kahit kailan. Ang paghingi ay laging bawal.'),
  p('Ang hindi hinging regalo ay puwede lang tanggapin kung lahat ng ito ay totoo: maliit lang ang halaga at hindi hihigit sa Isang Libong Piso (₱1,000.00); hindi ito pera o katumbas ng pera tulad ng gift card, load, o e-wallet; hindi ito ibinigay kaugnay ng nakabinbing bid, quotation, evaluation, o claim; at kaugalian ito, tulad ng token tuwing Pasko.'),
  p('Ang regalong lumalagpas sa hangganang ito, o ibinigay habang may nakabinbing transaksyon, ay magalang na tatanggihan. Kung ang pagtanggi ay makakasakit ng loob o hindi praktikal, tatanggapin ito ng empleyado para sa kompanya, ire-report sa HRD sa loob ng tatlong (3) araw ng trabaho, at isasauli. Magtatago ang HRD ng talaan ng mga regalong natanggap at naisauli.'),
  p('Ang katamtamang pagkain at meryenda sa karaniwang pagbisita sa kliyente ay hindi regalo at hindi na kailangang i-report.'),
  p('Ang pagtanggap ng pera o anumang bagay na may halaga kapalit ng isang gawain sa trabaho ay panunuhol. Napakabigat na paglabag ito sa ilalim ng Seksyon 4.4 at puwede ring krimen.'),

  secHead('2.5  Kompidensyalidad at Data Privacy', 'new'),
  p('Sa paggawa ng trabaho, nalalaman ng mga empleyado ang impormasyong pag-aari ng kompanya o ng mga kliyente nito — presyo at costing, quotation at bid, listahan ng kliyente, imbentaryo ng kagamitan at layout ng site, technical drawing, kasaysayan ng serbisyo, ayos ng seguridad, at personal na datos ng mga kasamahan at ng tauhan ng kliyente.'),
  p('Gagamitin lang ng empleyado ang ganitong impormasyon para sa layuning ibinigay ito sa kanya, hindi niya ito ibubunyag sa sinumang hindi kailangang makaalam para sa trabaho, at hindi niya ito itatago, kokopyahin, o ilalabas ng kompanya kapag umalis siya. Nagpapatuloy ang obligasyong ito kahit tapos na ang trabaho.'),
  p('Pinoproseso ng kompanya ang personal na datos alinsunod sa Republic Act No. 10173, ang Data Privacy Act of 2012. Ang mga empleyadong humahawak ng personal na datos ng kasamahan, aplikante, kliyente, o tauhan ng kliyente ay kukuha lamang ng kailangan, iingatan itong ligtas, at hindi ito ibubunyag nang walang pahintulot. Ang pinaghihinalaang paglabag sa datos — nawalang telepono o laptop, e-mail na napadala sa maling tao, hindi awtorisadong pag-access — ay ire-report agad sa HRD at hindi lalagpas sa dalawampu\'t apat (24) oras, para maabot ng kompanya ang sarili nitong takdang oras ng pag-report sa National Privacy Commission.'),
  p('Ang mga larawan at video na kinukuha sa loob ng gusali ng kliyente ay madalas may kasamang sistema, seguridad, o tauhan ng kliyente. Walang empleyadong kukuha o magpo-post ng ganitong larawan nang walang pahintulot ng kliyente.'),

  secHead('2.6  Ari-arian at Gamit ng Kompanya', 'new'),
  p('Ang mga kasangkapan, instrumento, gauge, refrigerant, spare part, service vehicle, cellphone, laptop, uniform, at PPE ay ibinibigay para sa trabaho ng kompanya at nananatiling pag-aari nito. Gagamitin ito ng mga empleyado nang may ingat, iingatan itong ligtas, isasauli kapag umalis o kapag hiningi, at ire-report agad ang pagkawala o pagkasira.'),
  p('Pinapayagan ang katamtamang personal na paggamit ng cellphone o computer ng kompanya basta makatuwiran ito, hindi nakakasagabal sa trabaho, walang malaking gastos sa kompanya, at walang kinalaman sa iligal o nakakasakit na bagay. Ang sasakyan ng kompanya ay para sa trabaho lamang at hindi puwedeng gamitin sa personal na lakad nang walang nakasulat na pahintulot.'),
  p('Walang inaasahang pagiging pribado ang empleyado sa kagamitan, e-mail account, at sistemang ibinigay ng kompanya. Puwedeng suriin ito ng kompanya para sa lehitimong layuning pangnegosyo, alinsunod sa Data Privacy Act.'),

  secHead('2.7  Pakikitungo sa Kliyente at sa Publiko', 'new'),
  p('Karamihan sa mga empleyado ng TXTAIRE ay nagtatrabaho sa loob ng gusali ng kliyente. Para sa kliyente, ang empleyadong nasa site ang mismong kompanya. Kaya ang bawat empleyadong nasa site ng kliyente ay dapat:'),
  bullet('Sumunod sa mga panuntunan, proseso sa seguridad, at kinakailangan sa kaligtasan ng kliyente, bukod pa sa mga sarili nating patakaran.'),
  bullet('Nakasuot ng itinakdang uniform na nakikita ang company ID.'),
  bullet('Manatili sa lugar ng trabaho at sa daanang kailangan papunta rito, at hindi papasok sa mga restricted na lugar nang walang pahintulot ng kliyente.'),
  bullet('Hindi manghihingi ng trabaho, tip, komisyon, utang, o rakets sa kliyente, sa tauhan nito, o sa mga tenant nito.'),
  bullet('Hindi magkukuwento sa kliyente tungkol sa presyo ng kompanya, sa panloob na problema nito, o sa usapin ng ibang kliyente.'),
  bullet('Iuulat sa supervisor ang anumang reklamo o kahilingan ng kliyente na wala sa saklaw ng job order, sa halip na pumayag agad.', { after: 160 }),

  secHead('2.8  Paggalang sa Lugar ng Trabaho', 'new'),
  p('May karapatan ang bawat empleyadong magtrabaho nang walang harassment, pambu-bully, at pananakot. Hindi papayagan ng kompanya ang sexual harassment sa anumang anyo, ang gender-based na harassment personal man o online, ang pambu-bully, ang hazing, ang panlalait sa kasarian, relihiyon, etnisidad, edad, katayuan sa kalusugan o kapansanan ng isang tao, o ang sadyang pagpapahiya sa isang tauhan.'),
  p('Ang karapatang mag-utos, magtakda ng pamantayan, magwasto ng mahinang trabaho, at magpataw ng disiplina sa ilalim ng Code na ito ay hindi harassment. Ang harassment ay asal na nakatutok sa tao at hindi sa trabaho, at makikita ng sinumang makatuwirang tao bilang nakakatakot, magulo, nakakasakit, o nakakababa ng dangal.'),
  p('Ang partikular na proseso para sa reklamo ng sexual harassment at gender-based na harassment ay nasa Seksyon 5.9. Hiwalay ito at mas mataas kaysa sa karaniwang proseso sa Bahagi III.'),

  secHead('2.9  Social Media at Pampublikong Pahayag', 'new'),
  p('Malaya ang mga empleyadong gumamit ng social media sa pribadong kakayahan nila. Hindi minomonitor ng kompanya ang personal na account at hindi nito pinipigilan ang legal na personal na pagpapahayag, kasama ang pagpuna sa mga usaping panggawa, na protektadong gawain.'),
  p('Ang hindi puwedeng gawin ng mga empleyado ay: mag-post ng confidential na impormasyon ng kompanya o kliyente; mag-post ng larawan o video na kinuha sa loob ng gusali ng kliyente nang walang pahintulot; mag-post ng materyal na tumutukoy sa isang kliyente at sumisira rito; magpanggap na kompanya o magmukhang nagsasalita para rito nang walang pahintulot; o mag-post ng materyal na nanliligalig, nagbabanta, o naninira sa kasamahan, kliyente, o sa kompanya.'),
  p('Ang May-ari, ang General Manager, o ang taong nakasulat nilang itinalaga lamang ang puwedeng magsalita para sa TXTAIRE OPC sa media, sa ahensya ng gobyerno sa opisyal na paglilitis, o sa opisyal na account ng kompanya.'),

  secHead('2.10  Pag-report ng Alalahanin at Proteksyon Laban sa Paghihiganti', 'new'),
  p('Ang empleyadong nakakaalam ng paglabag sa Code na ito, sa patakaran ng kompanya, o sa batas ay dapat mag-report nito. Puwedeng gawin ang report sa alinman sa mga sumusunod, at puwede kang pumili kung saan ka mas komportable:'),
  bullet([B('ang supervisor mo'), run(' — para sa karaniwang usapin sa alituntunin at kaligtasan;')]),
  bullet([B('ang Human Resources Department'), run(' — para sa kahit anong usapin, kasama na ang tungkol sa supervisor mo mismo;')]),
  bullet([B('ang May-ari o General Manager'), run(' — kung ang report ay tungkol sa HRD mismo o sa isang miyembro ng pamunuan;')]),
  bullet([B('ang Committee on Decorum and Investigation'), run(' — para sa sexual harassment at gender-based na harassment, sa ilalim ng Seksyon 5.9.')], { after: 140 }),
  p('Puwedeng gawin ang report nang nakasulat, sa e-mail, o pasalita. Puwede rin itong walang pangalan, bagaman mas mahirap kumilos sa report na walang pangalan dahil hindi makakapagtanong ang kompanya ng follow-up.'),
  p('Ang pagkakakilanlan ng taong nag-report nang may magandang loob ay pananatilihing lihim at ibubunyag lamang sa mga kailangang makaalam para makapag-imbestiga, o kung hinihingi ng batas o ng tamang proseso na nararapat sa taong inirereklamo.'),
  note('Walang paghihiganti', [
    'Walang empleyadong tatanggalin, sususpindihin, ibababa ang posisyon, ililipat, babawasan ng benepisyo, bibigyan ng mababang evaluation, aalisan ng overtime, o pahihirapan sa anumang paraan dahil nag-report siya ng posibleng paglabag nang may magandang loob, naghain ng reklamo, o sumali sa imbestigasyon.',
    'Ang paghihiganti mismo ay napakabigat na paglabag na may parusang pagtanggal sa ilalim ng Seksyon 4.7 at 4.8. Paglabag pa rin ito kahit magkamali ang orihinal na report, basta ginawa ito nang may magandang loob.',
    'Ang report na alam mismo ng nag-report na hindi totoo ay hindi ginawa nang may magandang loob, at paglabag din ito.',
  ], { edge: C.Dtxt, fill: 'FDF0F0', labelColor: C.Dtxt }),
];

module.exports = { part1, part2 };
