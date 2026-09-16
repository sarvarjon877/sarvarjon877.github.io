// Buxgalteriya savollari bazasi — o'yin uchun.
// Format: { q: savol, o: [4 variant], a: to'g'ri javob indeksi (0-3) }
// Ko'p savol => har o'yinda tasodifiy 10 tasi => har doim har xil.
export const QUESTIONS = [
  // --- Asoslar: debet / kredit / balans ---
  { q: "Aktiv hisoblarda qoldiq odatda qaysi tomonda bo'ladi?", o: ["Debet", "Kredit", "Ikkisida ham", "Hech qaysida"], a: 0 },
  { q: "Passiv hisoblarda qoldiq odatda qaysi tomonda bo'ladi?", o: ["Debet", "Kredit", "O'rtada", "Aniqlanmagan"], a: 1 },
  { q: "Buxgalteriya balansining asosiy tenglamasi qaysi?", o: ["Aktiv = Passiv", "Daromad = Xarajat", "Debet > Kredit", "Foyda = Kapital"], a: 0 },
  { q: "Ikki tomonlama yozuv nimani anglatadi?", o: ["Har amal debet va kreditga yoziladi", "Ikki marta yoziladi", "Ikki buxgalter tekshiradi", "Ikki hujjat kerak"], a: 0 },
  { q: "Aktiv hisob debet bo'yicha...", o: ["oshadi", "kamayadi", "o'zgarmaydi", "yopiladi"], a: 0 },
  { q: "Passiv hisob kredit bo'yicha...", o: ["oshadi", "kamayadi", "o'zgarmaydi", "nol bo'ladi"], a: 0 },
  { q: "Balansning chap tomoni nima deb ataladi?", o: ["Aktiv", "Passiv", "Debet aylanma", "Saldo"], a: 0 },
  { q: "Balansning o'ng tomoni nima deb ataladi?", o: ["Passiv", "Aktiv", "Kredit aylanma", "Jami"], a: 0 },
  { q: "Quyidagilardan qaysi biri AKTIV?", o: ["Kassadagi pul", "Ustav kapitali", "Bank krediti", "Yetkazib beruvchiga qarz"], a: 0 },
  { q: "Quyidagilardan qaysi biri PASSIV?", o: ["Bank krediti", "Tovarlar", "Debitor qarz", "Asosiy vosita"], a: 0 },
  { q: "Saldo (qoldiq) nima?", o: ["Hisobdagi qoldiq summa", "Umumiy daromad", "Xarajatlar yig'indisi", "Soliq summasi"], a: 0 },
  { q: "Debet aylanma nima?", o: ["Hisob debeti bo'yicha operatsiyalar yig'indisi", "Oxirgi qoldiq", "Foyda", "Zarar"], a: 0 },
  { q: "Balans qachon 'teng' hisoblanadi?", o: ["Aktiv jami = Passiv jami bo'lganda", "Foyda bo'lganda", "Kassa to'lganda", "Soliq to'langanda"], a: 0 },

  // --- Hisoblar rejasi / hisob raqamlari ---
  { q: "'Kassa' hisobi qaysi raqam bilan yuritiladi (NSBU)?", o: ["5010", "5110", "4010", "6710"], a: 0 },
  { q: "'Hisob-kitob (bank) hisobvarag'i' qaysi raqam?", o: ["5110", "5010", "8330", "9010"], a: 0 },
  { q: "Ustav kapitali qaysi hisobda yuritiladi?", o: ["8330", "5010", "4010", "6010"], a: 0 },
  { q: "Xaridorlar (debitorlar) bilan hisob-kitob qaysi hisob?", o: ["4010", "6010", "5010", "8710"], a: 0 },
  { q: "Mol yetkazib beruvchilar (kreditorlar) bilan hisob-kitob?", o: ["6010", "4010", "5110", "0100"], a: 0 },
  { q: "Ish haqi bo'yicha xodimlar bilan hisob-kitob qaysi hisob?", o: ["6710", "5010", "4010", "8330"], a: 0 },
  { q: "Asosiy vositalar qaysi hisobda hisobga olinadi?", o: ["0100", "5010", "6010", "9010"], a: 0 },
  { q: "Kassa hisobi qanday hisob turi?", o: ["Aktiv", "Passiv", "Aktiv-passiv", "Vaqtinchalik"], a: 0 },
  { q: "Ustav kapitali hisobi qanday turdagi hisob?", o: ["Passiv", "Aktiv", "Aralash", "Yopiq"], a: 0 },

  // --- Provodkalar ---
  { q: "Kassaga bankdan pul olindi. Provodka: Debet 5010 — Kredit ...?", o: ["5110", "6010", "8330", "4010"], a: 0 },
  { q: "Xaridordan kassaga to'lov keldi. Provodka: Debet 5010 — Kredit ...?", o: ["4010", "6010", "5110", "6710"], a: 0 },
  { q: "Ish haqi hisoblandi. Provodka odatda: Debet xarajat — Kredit ...?", o: ["6710", "5010", "4010", "5110"], a: 0 },
  { q: "Yetkazib beruvchiga bankdan to'lov qilindi: Debet 6010 — Kredit ...?", o: ["5110", "5010", "4010", "8330"], a: 0 },
  { q: "Ta'sischi ustav kapitaliga pul kiritdi: Debet 5110 — Kredit ...?", o: ["8330", "6010", "4010", "9010"], a: 0 },
  { q: "Xodimga kassadan ish haqi berildi: Debet 6710 — Kredit ...?", o: ["5010", "5110", "4010", "6010"], a: 0 },
  { q: "Bir provodkada debet va kredit summalari qanday bo'lishi kerak?", o: ["Teng", "Debet katta", "Kredit katta", "Har xil"], a: 0 },
  { q: "Tovar sotib olindi (naqd emas, qarzga). Kredit tomonda qaysi hisob?", o: ["6010 (yetkazib beruvchi)", "5010 (kassa)", "8330", "4010"], a: 0 },

  // --- Hujjatlar ---
  { q: "Kassaga pul kirimini rasmiylashtiruvchi hujjat?", o: ["Kirim kassa orderi", "Chiqim kassa orderi", "Hisob-faktura", "Ish haqi vedomosti"], a: 0 },
  { q: "Kassadan pul chiqimini rasmiylashtiruvchi hujjat?", o: ["Chiqim kassa orderi", "Kirim kassa orderi", "Kvitansiya", "Akt"], a: 0 },
  { q: "Tovar sotilganda QQS bilan beriladigan asosiy hujjat?", o: ["Hisob-faktura (schyot-faktura)", "Kassa orderi", "Buyruq", "Shartnoma"], a: 0 },
  { q: "Ishga qabul qilish qaysi hujjat bilan rasmiylashtiriladi?", o: ["Buyruq", "Hisob-faktura", "Kassa orderi", "Balans"], a: 0 },
  { q: "Elektron hisob-fakturalar O'zbekistonda qaysi tizimda?", o: ["Didox / soliq.uz", "Telegram", "1C bulut", "Excel"], a: 0 },
  { q: "Tovarni qabul qilishni tasdiqlovchi hujjat?", o: ["Yuk xati / qabul akti", "Kassa kitobi", "Bank vedomosti", "Buyruq"], a: 0 },

  // --- Soliqlar ---
  { q: "O'zbekistonda QQS (NDS)ning umumiy stavkasi hozir necha foiz?", o: ["12%", "15%", "20%", "7%"], a: 0 },
  { q: "QQS qanday soliq turi?", o: ["Bilvosita (egri) soliq", "To'g'ridan-to'g'ri soliq", "Mahalliy yig'im", "Bojxona to'lovi"], a: 0 },
  { q: "Jismoniy shaxs daromadidan olinadigan soliq (YaTT emas)?", o: ["Daromad solig'i (JShDS)", "QQS", "Aksiz", "Yer solig'i"], a: 0 },
  { q: "Aylanmadan soliq (oborot solig'i) kimlar uchun mo'ljallangan?", o: ["Kichik biznes / cheklangan aylanmali", "Yirik korxonalar", "Davlat idoralari", "Banklar"], a: 0 },
  { q: "Foyda solig'i nimadan olinadi?", o: ["Korxona foydasidan", "Aylanmadan", "Ish haqidan", "Mol-mulkdan"], a: 0 },
  { q: "QQS hisob-fakturasiz to'lovda nima ko'rsatiladi?", o: ["QQS ajratilmaydi", "QQS 2 barobar", "Aksiz", "Boj"], a: 0 },

  // --- Ish haqi ---
  { q: "Ish haqidan qanday soliq/ajratma ushlab qolinadi?", o: ["JShDS va INPS", "QQS", "Aksiz", "Yer solig'i"], a: 0 },
  { q: "'Naqd' ish haqi berish qaysi hisobdan chiqadi?", o: ["Kassa (5010)", "Bank (5110)", "Debitor", "Kapital"], a: 0 },
  { q: "Ish haqi hisoblanishi qaysi tomonда aks etadi (6710)?", o: ["Kredit", "Debet", "Ikkisida", "Hech qaysida"], a: 0 },
  { q: "INPS to'lovi nimaga bog'liq?", o: ["Jamg'arib boriladigan pensiya", "QQS", "Foyda solig'i", "Boj"], a: 0 },
  { q: "Avans nima?", o: ["Ish haqining oldindan berilgan qismi", "Jarima", "Bonus", "Chegirma"], a: 0 },

  // --- Amortizatsiya / asosiy vositalar ---
  { q: "Amortizatsiya nima?", o: ["Asosiy vosita qiymatining asta-sekin xarajatga o'tishi", "Foyda", "Soliq", "Kredit"], a: 0 },
  { q: "Amortizatsiya hisoblanganda nima oshadi?", o: ["Jamg'arilgan amortizatsiya (Kredit)", "Kassa", "Foyda", "Ustav kapitali"], a: 0 },
  { q: "Asosiy vosita deb nimaga aytiladi?", o: ["Uzoq muddat ishlatiladigan mulk", "Bir martalik xarajat", "Tovar zaxirasi", "Pul"], a: 0 },
  { q: "Asosiy vositaning 'qoldiq qiymati' qanday topiladi?", o: ["Boshlang'ich qiymat − amortizatsiya", "Bozor narxi + soliq", "Faqat amortizatsiya", "QQS bilan"], a: 0 },
  { q: "Amortizatsiyaning to'g'ri chiziqli usulida har yili summa qanday?", o: ["Teng (bir xil)", "Har yili oshadi", "Har yili kamayadi", "Tasodifiy"], a: 0 },

  // --- Pul mablag'lari / zaxiralar ---
  { q: "Kassadagi naqd pul limiti kim tomonidan belgilanadi?", o: ["Korxona / bank tartibi", "Xodim", "Xaridor", "Soliq inspektori har kuni"], a: 0 },
  { q: "Tovar-moddiy zaxiralar (TMZ)ga nima kiradi?", o: ["Material, tovar, tayyor mahsulot", "Asosiy vositalar", "Pul", "Kapital"], a: 0 },
  { q: "Zaxiralarni baholashning keng tarqalgan usuli (birinchi kirgan birinchi chiqadi)?", o: ["FIFO", "LIFO taqiqlangan usul", "O'rtacha faqat", "Tasodifiy"], a: 0 },
  { q: "Inventarizatsiya nima?", o: ["Mol-mulk va zaxiralarni sanab tekshirish", "Soliq to'lash", "Ish haqi berish", "Hujjat yo'q qilish"], a: 0 },
  { q: "Inventarizatsiyada kamomad aniqlansa, u kimga taalluqli bo'lishi mumkin?", o: ["Moddiy javobgar shaxs", "Xaridor", "Bank", "Soliq organi"], a: 0 },

  // --- Daromad / xarajat / foyda ---
  { q: "Sof foyda qanday topiladi?", o: ["Daromad − xarajat − soliq", "Daromad + xarajat", "Faqat daromad", "Aktiv − Passiv"], a: 0 },
  { q: "Yalpi foyda (valovaya) nima?", o: ["Sotuvdan tushum − sotilgan tovar tannarxi", "Sof foyda + soliq", "Faqat xarajat", "Kapital"], a: 0 },
  { q: "Tannarx nima?", o: ["Mahsulot ishlab chiqarish/sotib olish xarajatlari", "Sotuv narxi", "Foyda", "Soliq"], a: 0 },
  { q: "Zarar (ubytok) qachon yuzaga keladi?", o: ["Xarajat daromaddan ko'p bo'lganda", "Foyda bo'lganda", "Kassa to'lganda", "Soliq kam bo'lganda"], a: 0 },
  { q: "Rentabellik nimani ko'rsatadi?", o: ["Faoliyat foydaliligini", "Qarz miqdorini", "Xodimlar sonini", "Soliq turini"], a: 0 },

  // --- Debitor / kreditor / kapital ---
  { q: "Debitor qarz nima?", o: ["Bizga qarzdorlar (bizga qarz)", "Bizning qarzimiz", "Foyda", "Kapital"], a: 0 },
  { q: "Kreditor qarz nima?", o: ["Biz qarzdor bo'lganlar (bizning qarz)", "Bizga qarz", "Daromad", "Aktiv"], a: 0 },
  { q: "Debitorlik qarzi balansning qaysi qismida?", o: ["Aktiv", "Passiv", "Ikkisida", "Balansdan tashqari"], a: 0 },
  { q: "Kreditorlik qarzi balansning qaysi qismida?", o: ["Passiv", "Aktiv", "Daromad", "Xarajat"], a: 0 },
  { q: "Xususiy (o'z) kapital nimalardan iborat?", o: ["Ustav kapitali, taqsimlanmagan foyda va h.k.", "Faqat kreditlar", "Faqat kassa", "Soliqlar"], a: 0 },

  // --- Umumiy terminlar / 1C ---
  { q: "1C dasturi asosan nima uchun ishlatiladi?", o: ["Buxgalteriya hisobini yuritish", "Video montaj", "Grafik dizayn", "O'yin"], a: 0 },
  { q: "1C da 'provodka' nima?", o: ["Buxgalteriya yozuvi (debet-kredit)", "Hisobot", "Foydalanuvchi", "Parol"], a: 0 },
  { q: "Buxgalteriya hisobining asosiy o'lchov birligi?", o: ["Pul (so'm)", "Kg", "Metr", "Soat"], a: 0 },
  { q: "Hisobot davri odatda qanday tugaydi?", o: ["Hisoblar yopilishi bilan", "Ish haqi berish bilan", "Inventarizatsiya bilan", "Bayram bilan"], a: 0 },
  { q: "Bosh kitob (Glavnaya kniga) nima?", o: ["Barcha hisoblar yakuniy registri", "Kassa daftari", "Shartnomalar", "Buyruqlar"], a: 0 },
  { q: "Buxgalteriya balansi qaysi sanaga tuziladi?", o: ["Muayyan sanaga (masalan yil oxiri)", "Har soatda", "Faqat yozda", "Hech qachon"], a: 0 },
  { q: "Oborot-saldo vedomosti nimaga xizmat qiladi?", o: ["Hisoblar aylanmasi va qoldiqlarini tekshirish", "Ish haqi berish", "Reklama", "Soliq to'lash"], a: 0 },
  { q: "Buxgalter hisobida 'hujjat bo'lmasa...'", o: ["operatsiya yozilmaydi", "ikki marta yoziladi", "soliq oshadi", "kassa yopiladi"], a: 0 },
  { q: "QQSni hisobga olish uchun nima shart?", o: ["To'g'ri rasmiylashtirilgan hisob-faktura", "Og'zaki kelishuv", "Faqat kvitansiya", "Hech narsa"], a: 0 },
  { q: "'Aktivlar likvidligi' nimani bildiradi?", o: ["Naqd pulga tez aylanishini", "Og'irligini", "Rangini", "Yoshini"], a: 0 },
  { q: "Eng likvid aktiv qaysi?", o: ["Naqd pul", "Bino", "Asbob-uskuna", "Zaxira"], a: 0 },
  { q: "Buxgalteriya hisobi qaysi prinsipга asoslanadi (uzluksizlik)?", o: ["Korxona faoliyati davom etadi deb", "Har kuni yopiladi deb", "Faqat foyda deb", "Soliqsiz deb"], a: 0 },

  // --- Qiyinroq / hisob-kitob ---
  { q: "Tovar 1 200 000 so'm, QQS 12%. QQS summasi qancha?", o: ["144 000", "120 000", "12 000", "240 000"], a: 0 },
  { q: "Narx QQSsiz 500 000. QQS 12% bilan jami qancha?", o: ["560 000", "550 000", "600 000", "512 000"], a: 0 },
  { q: "Asosiy vosita 10 000 000, xizmat muddati 5 yil. Yillik amortizatsiya (chiziqli)?", o: ["2 000 000", "1 000 000", "5 000 000", "500 000"], a: 0 },
  { q: "Boshlang'ich qoldiq 300 000, debet aylanma 200 000, kredit aylanma 100 000 (aktiv). Yakuniy qoldiq?", o: ["400 000", "200 000", "600 000", "100 000"], a: 0 },
  { q: "Sotuvdan tushum 8 000 000, tannarx 5 000 000. Yalpi foyda?", o: ["3 000 000", "13 000 000", "5 000 000", "8 000 000"], a: 0 },
  { q: "Ish haqi 4 000 000, JShDS 12%. Ushlab qolinadigan soliq?", o: ["480 000", "400 000", "48 000", "1 200 000"], a: 0 },
  { q: "Kassada 500 000 bor edi, 300 000 kirim, 200 000 chiqim. Qoldiq?", o: ["600 000", "400 000", "1 000 000", "300 000"], a: 0 },
  { q: "Aktiv 15 000 000, o'z kapital 9 000 000. Majburiyatlar (qarz) qancha?", o: ["6 000 000", "24 000 000", "9 000 000", "15 000 000"], a: 0 },
  { q: "Tovar 2 000 000 ga olindi, 2 600 000 ga sotildi. Foyda?", o: ["600 000", "4 600 000", "2 000 000", "260 000"], a: 0 },
  { q: "100 dona tovar, donasi 25 000 so'm. Umumiy qiymat?", o: ["2 500 000", "250 000", "25 000", "2 000 000"], a: 0 },

  // --- Yana konseptual ---
  { q: "Buxgalteriya hisobining vazifasi nima?", o: ["Xo'jalik faoliyatini aks ettirish va nazorat", "Reklama qilish", "Sotuvni oshirish", "Dizayn"], a: 0 },
  { q: "Hisobvaraq (schyot) nima?", o: ["Bir turdagi mablag'larni hisobga olish usuli", "Bank kartasi", "Hujjat raqami", "Soliq turi"], a: 0 },
  { q: "Balansda 'valyuta balansa' nima?", o: ["Aktiv (yoki passiv) jami summasi", "Chet el puli", "Foyda", "Xarajat"], a: 0 },
  { q: "Xarajatlar hisobi qanday turdagi?", o: ["Aktiv (xarajat to'planadi)", "Passiv", "Kapital", "Daromad"], a: 0 },
  { q: "Daromad hisobi odatda qaysi tomonда oshadi?", o: ["Kredit", "Debet", "Ikkisida", "Hech qaysida"], a: 0 },
  { q: "Buxgalteriya 'yozuvi' (provodka) nima asosida qilinadi?", o: ["Birlamchi hujjat", "Telefon qo'ng'iroq", "Taxmin", "Reklama"], a: 0 },
  { q: "Korxona bankrot bo'lsa avval kim bilan hisoblashadi?", o: ["Kreditorlar bilan", "Ta'sischilar bilan birinchi", "Xaridorlar", "Reklama agentligi"], a: 0 },
  { q: "'Dvoynaya zapis' (ikki yozuv) prinsipini kim asoslagan deb hisoblanadi?", o: ["Luka Pacholi", "Adam Smit", "Nyuton", "Keyns"], a: 0 },
  { q: "Buxgalteriya balansi necha qismdan iborat?", o: ["2 (aktiv va passiv)", "1", "3", "5"], a: 0 },
  { q: "Moliyaviy hisobot foydalanuvchilari kimlar?", o: ["Rahbariyat, investor, soliq organi", "Faqat kassir", "Faqat xaridor", "Hech kim"], a: 0 },
];
