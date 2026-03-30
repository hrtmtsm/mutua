// ── Prompt DB layer ───────────────────────────────────────────────────────────
//
// Loads session prompts from Supabase `prompts` table, deduplicating against
// prompts shown to this pair in the last 30 days via `session_prompts`.
//
// Falls back to the in-memory LIBRARY when Supabase is not configured.

import { supabase, isConfigured } from './supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Prompt {
  id?:    string;                          // uuid from DB (absent in fallback)
  t:      Partial<Record<string, string>>; // translations keyed by language name
  hint?:  string;
  level?: 1 | 2 | 3;
  tags?:  string[];
}

export type Pools = { ice: Prompt[]; conv: Prompt[]; reflect: Prompt[] };

// ── Translation helper ────────────────────────────────────────────────────────

export function getT(prompt: Prompt, lang: string): string {
  return prompt.t[lang] ?? prompt.t['English'] ?? '';
}

// ── In-memory fallback library ────────────────────────────────────────────────

export const LIBRARY: Pools = {
  ice: [
    {
      t: {
        English:    "Where did you grow up?",
        Japanese:   "どこで育ちましたか？",
        Korean:     "어디서 자랐나요?",
        Mandarin:   "你在哪里长大的？",
        Spanish:    "¿Dónde creciste?",
        French:     "Où avez-vous grandi ?",
        Portuguese: "Onde você cresceu?",
        German:     "Wo bist du aufgewachsen?",
        Italian:    "Dove sei cresciuto?",
        Arabic:     "أين نشأت؟",
        Hindi:      "आप कहाँ पले-बढ़े?",
        Turkish:    "Nerede büyüdünüz?",
        Vietnamese: "Bạn lớn lên ở đâu?",
        Thai:       "คุณเติบโตมาที่ไหน?",
        Indonesian: "Di mana kamu tumbuh besar?",
        Dutch:      "Waar ben je opgegroeid?",
        Polish:     "Gdzie dorastałeś?",
        Swedish:    "Var växte du upp?",
        Russian:    "Где ты вырос?",
        Tagalog:    "Saan ka lumaki?",
        Swahili:    "Ulikua wapi?",
      },
      level: 1,
      hint: "Ask what they miss most about it.",
    },
    {
      t: {
        English:    "What's something small that made you smile this week?",
        Japanese:   "今週、ちょっと嬉しかったことはありますか？",
        Korean:     "이번 주에 기분 좋았던 작은 일이 있나요?",
        Mandarin:   "这周有什么小事让你开心吗？",
        Spanish:    "¿Qué pequeña cosa te alegró esta semana?",
        French:     "Quelle petite chose vous a fait sourire cette semaine ?",
        Portuguese: "O que de pequeno te fez sorrir essa semana?",
        German:     "Was Kleines hat dich diese Woche zum Lächeln gebracht?",
        Italian:    "Cosa di piccolo ti ha fatto sorridere questa settimana?",
        Arabic:     "ما الشيء الصغير الذي أسعدك هذا الأسبوع؟",
        Hindi:      "इस हफ्ते किस छोटी सी बात ने आपको मुस्कुराया?",
        Turkish:    "Bu hafta sizi güldüren küçük bir şey neydi?",
        Vietnamese: "Điều nhỏ nào đã làm bạn mỉm cười tuần này?",
        Thai:       "มีเรื่องเล็กๆ อะไรที่ทำให้คุณยิ้มสัปดาห์นี้บ้าง?",
        Indonesian: "Hal kecil apa yang membuatmu tersenyum minggu ini?",
        Dutch:      "Wat kleins heeft je deze week aan het lachen gemaakt?",
        Polish:     "Co małego sprawiło, że się uśmiechnąłeś w tym tygodniu?",
        Swedish:    "Vad litet fick dig att le den här veckan?",
        Russian:    "Какая мелочь заставила тебя улыбнуться на этой неделе?",
        Tagalog:    "Anong maliit na bagay ang nagpasaya sa iyo ngayong linggo?",
        Swahili:    "Kitu kidogo gani kilikusfurahisha wiki hii?",
      },
      level: 1,
      hint: "Ask what made that moment stand out.",
      tags: ["Making friends", "Casual conversation"],
    },
    {
      t: {
        English:    "What does a perfect weekend look like for you?",
        Japanese:   "理想の週末はどんな感じですか？",
        Korean:     "완벽한 주말은 어떤 모습인가요?",
        Mandarin:   "你理想中的周末是什么样的？",
        Spanish:    "¿Cómo es tu fin de semana perfecto?",
        French:     "À quoi ressemble votre week-end idéal ?",
        Portuguese: "Como é o seu fim de semana perfeito?",
        German:     "Wie sieht dein perfektes Wochenende aus?",
        Italian:    "Com'è il tuo weekend perfetto?",
        Arabic:     "كيف يبدو عطلة نهاية الأسبوع المثالية بالنسبة لك؟",
        Hindi:      "आपके लिए एक आदर्श सप्ताहांत कैसा दिखता है?",
        Turkish:    "Sizin için mükemmel bir hafta sonu nasıl görünür?",
        Vietnamese: "Cuối tuần hoàn hảo với bạn trông như thế nào?",
        Thai:       "วันหยุดสุดสัปดาห์ที่สมบูรณ์แบบของคุณเป็นอย่างไร?",
        Indonesian: "Seperti apa akhir pekan yang sempurna bagimu?",
        Dutch:      "Hoe ziet een perfect weekend eruit voor jou?",
        Polish:     "Jak wygląda idealny weekend dla ciebie?",
        Swedish:    "Hur ser din perfekta helg ut?",
        Russian:    "Как выглядят твои идеальные выходные?",
        Tagalog:    "Ano ang hitsura ng isang perpektong katapusan ng linggo para sa iyo?",
        Swahili:    "Wikendi kamili inaonekana vipi kwako?",
      },
      level: 1,
    },
    {
      t: {
        English:    "What's one word you've been trying to use more lately?",
        Japanese:   "最近、よく使おうとしている言葉はありますか？",
        Korean:     "요즘 더 많이 쓰려고 노력하는 표현이 있나요?",
        Mandarin:   "你最近在努力多用的词是什么？",
        Spanish:    "¿Hay alguna palabra que estés intentando usar más?",
        French:     "Y a-t-il un mot que vous essayez d'utiliser plus souvent ?",
        Portuguese: "Tem alguma palavra que você está tentando usar mais?",
        German:     "Gibt es ein Wort, das du öfter benutzen möchtest?",
        Italian:    "C'è una parola che stai cercando di usare di più?",
        Arabic:     "هل هناك كلمة تحاول استخدامها أكثر؟",
        Hindi:      "हाल ही में आप कौन सा शब्द ज़्यादा इस्तेमाल करने की कोशिश कर रहे हैं?",
        Turkish:    "Son zamanlarda daha fazla kullanmaya çalıştığınız bir kelime var mı?",
        Vietnamese: "Gần đây bạn đang cố gắng dùng nhiều hơn từ nào?",
        Thai:       "มีคำใดที่คุณพยายามใช้บ่อยขึ้นเร็วๆ นี้?",
        Indonesian: "Ada kata yang sedang kamu coba gunakan lebih sering belakangan ini?",
        Dutch:      "Is er een woord dat je de laatste tijd vaker probeert te gebruiken?",
        Polish:     "Czy jest jakieś słowo, którego ostatnio starasz się używać częściej?",
        Swedish:    "Finns det ett ord du försökt använda mer på sistone?",
        Russian:    "Есть ли слово, которое ты в последнее время стараешься использовать чаще?",
        Tagalog:    "Mayroon bang salita na sinisikap mong gamitin nang mas madalas kamakailan?",
        Swahili:    "Kuna neno ambalo umekuwa ukijaribu kutumia zaidi hivi karibuni?",
      },
      level: 2,
    },
    {
      t: {
        English:    "What's a phrase you learned recently that surprised you?",
        Japanese:   "最近覚えた表現で、驚いたものはありますか？",
        Korean:     "최근에 배운 표현 중 놀라웠던 게 있나요?",
        Mandarin:   "你最近学到了什么让你惊喜的表达？",
        Spanish:    "¿Qué expresión aprendiste recientemente que te sorprendió?",
        French:     "Quelle expression avez-vous apprise récemment qui vous a surpris ?",
        Portuguese: "Que expressão você aprendeu recentemente que te surpreendeu?",
        German:     "Welchen Ausdruck hast du kürzlich gelernt, der dich überrascht hat?",
        Italian:    "Qual è una frase che hai imparato di recente che ti ha sorpreso?",
        Arabic:     "ما العبارة التي تعلمتها مؤخرًا وفاجأتك؟",
        Hindi:      "हाल ही में सीखा कौन सा वाक्यांश आपको चौंका गया?",
        Turkish:    "Son zamanlarda öğrendiğiniz ve sizi şaşırtan bir ifade nedir?",
        Vietnamese: "Cụm từ nào bạn học gần đây khiến bạn ngạc nhiên?",
        Thai:       "มีวลีใดที่คุณเพิ่งเรียนรู้และทำให้คุณประหลาดใจ?",
        Indonesian: "Ungkapan apa yang baru-baru ini kamu pelajari dan membuatmu terkejut?",
        Dutch:      "Welke uitdrukking heb je onlangs geleerd die je verraste?",
        Polish:     "Jakie wyrażenie nauczyłeś się niedawno i cię zaskoczyło?",
        Swedish:    "Vilken fras lärde du dig nyligen som överraskade dig?",
        Russian:    "Какую фразу ты недавно выучил, и она тебя удивила?",
        Tagalog:    "Anong parirala ang natutunan mo kamakailan na nagulat sa iyo?",
        Swahili:    "Ni msemo gani uliojifunza hivi karibuni ambao ulikushangaza?",
      },
      level: 2,
    },
  ],

  conv: [
    {
      t: {
        English:    "Tell me about a place that felt like home.",
        Japanese:   "「ふるさと」のように感じる場所を教えてください。",
        Korean:     "집처럼 느껴지는 장소에 대해 이야기해 주세요.",
        Mandarin:   "告诉我一个让你感觉像家一样的地方。",
        Spanish:    "Cuéntame sobre un lugar que sentiste como hogar.",
        French:     "Parlez-moi d'un endroit qui vous a semblé comme chez vous.",
        Portuguese: "Me fala sobre um lugar que pareceu um lar para você.",
        German:     "Erzähl mir von einem Ort, der sich wie Zuhause angefühlt hat.",
        Italian:    "Parlami di un posto che ti è sembrato come casa.",
        Arabic:     "أخبرني عن مكان شعرت فيه بأنه مثل البيت.",
        Hindi:      "मुझे किसी ऐसी जगह के बारे में बताइए जो घर जैसी लगी।",
        Turkish:    "Ev gibi hissettiren bir yer hakkında bana anlat.",
        Vietnamese: "Kể cho tôi nghe về một nơi khiến bạn cảm thấy như ở nhà.",
        Thai:       "เล่าให้ฉันฟังเกี่ยวกับสถานที่ที่รู้สึกเหมือนบ้าน",
        Indonesian: "Ceritakan tentang tempat yang terasa seperti rumah.",
        Dutch:      "Vertel me over een plek die als thuis voelde.",
        Polish:     "Opowiedz mi o miejscu, które czuło się jak dom.",
        Swedish:    "Berätta om ett ställe som kändes som hemma.",
        Russian:    "Расскажи мне о месте, которое ощущалось как дом.",
        Tagalog:    "Sabihin mo sa akin ang tungkol sa isang lugar na parang tahanan.",
        Swahili:    "Niambie kuhusu mahali ambapo palihisi kama nyumbani.",
      },
      level: 2,
      hint: "Ask what made it feel that way.",
    },
    {
      t: {
        English:    "What's something you changed your mind about recently?",
        Japanese:   "最近、考えが変わったことはありますか？",
        Korean:     "최근에 생각이 바뀐 게 있나요?",
        Mandarin:   "最近有什么事让你改变了想法？",
        Spanish:    "¿Sobre qué cambiaste de opinión recientemente?",
        French:     "Sur quoi avez-vous changé d'avis récemment ?",
        Portuguese: "Sobre o que você mudou de ideia recentemente?",
        German:     "Worüber hast du kürzlich deine Meinung geändert?",
        Italian:    "Su cosa hai cambiato idea di recente?",
        Arabic:     "ما الذي غيّرت رأيك فيه مؤخرًا؟",
        Hindi:      "हाल ही में किस बात पर आपने अपना मन बदला?",
        Turkish:    "Son zamanlarda fikrinizi değiştirdiğiniz bir şey nedir?",
        Vietnamese: "Gần đây bạn đã thay đổi suy nghĩ về điều gì?",
        Thai:       "เร็วๆ นี้คุณเปลี่ยนใจเรื่องอะไรบ้าง?",
        Indonesian: "Apa yang belakangan ini membuatmu mengubah pendapat?",
        Dutch:      "Waarover heb je de laatste tijd van gedachten veranderd?",
        Polish:     "O czym ostatnio zmieniłeś zdanie?",
        Swedish:    "Vad har du ändrat åsikt om på sistone?",
        Russian:    "О чём ты недавно изменил своё мнение?",
        Tagalog:    "Tungkol saan ang isang bagay na binago mo ang isip kamakailan?",
        Swahili:    "Ni nini ulichobadilisha mawazo yako kuhusu hivi karibuni?",
      },
      level: 3,
      tags: ["Cultural exchange"],
    },
    {
      t: {
        English:    "Describe your city to someone who's never been.",
        Japanese:   "あなたの街を初めて来た人に紹介するとしたら？",
        Korean:     "처음 오는 사람에게 당신의 도시를 소개한다면?",
        Mandarin:   "向从没去过的人介绍你的城市。",
        Spanish:    "Describe tu ciudad a alguien que nunca ha estado allí.",
        French:     "Décrivez votre ville à quelqu'un qui n'y est jamais allé.",
        Portuguese: "Descreva sua cidade para alguém que nunca foi.",
        German:     "Beschreib deine Stadt jemandem, der noch nie da war.",
        Italian:    "Descrivi la tua città a qualcuno che non c'è mai stato.",
        Arabic:     "صف مدينتك لشخص لم يزرها قط.",
        Hindi:      "अपने शहर को किसी ऐसे व्यक्ति के लिए बताइए जो कभी वहाँ नहीं गया।",
        Turkish:    "Şehrinizi hiç gitmemiş birine anlatın.",
        Vietnamese: "Mô tả thành phố của bạn cho người chưa từng đến đó.",
        Thai:       "อธิบายเมืองของคุณให้คนที่ไม่เคยไปฟัง",
        Indonesian: "Gambarkan kotamu kepada seseorang yang belum pernah ke sana.",
        Dutch:      "Beschrijf je stad aan iemand die er nog nooit is geweest.",
        Polish:     "Opisz swoje miasto komuś, kto nigdy tam nie był.",
        Swedish:    "Beskriv din stad för någon som aldrig har besökt den.",
        Russian:    "Опиши свой город тому, кто никогда там не был.",
        Tagalog:    "Ilarawan ang iyong lungsod sa isang taong hindi pa nakarating doon.",
        Swahili:    "Elezea mji wako kwa mtu ambaye hajawahi kwenda.",
      },
      level: 2,
      tags: ["Travel"],
    },
    {
      t: {
        English:    "What's a habit you've picked up from another culture?",
        Japanese:   "他の文化から取り入れた習慣はありますか？",
        Korean:     "다른 문화에서 받아들인 습관이 있나요?",
        Mandarin:   "你从其他文化中养成了什么习惯？",
        Spanish:    "¿Qué hábito adoptaste de otra cultura?",
        French:     "Quelle habitude avez-vous adoptée d'une autre culture ?",
        Portuguese: "Que hábito você adotou de outra cultura?",
        German:     "Welche Gewohnheit hast du von einer anderen Kultur übernommen?",
        Italian:    "Che abitudine hai preso da un'altra cultura?",
        Arabic:     "ما العادة التي أخذتها من ثقافة أخرى؟",
        Hindi:      "किसी दूसरी संस्कृति से आपने कौन सी आदत अपनाई?",
        Turkish:    "Başka bir kültürden edindiğiniz bir alışkanlık var mı?",
        Vietnamese: "Bạn đã học được thói quen nào từ một nền văn hóa khác?",
        Thai:       "คุณรับนิสัยอะไรมาจากวัฒนธรรมอื่น?",
        Indonesian: "Kebiasaan apa yang kamu ambil dari budaya lain?",
        Dutch:      "Welke gewoonte heb je overgenomen van een andere cultuur?",
        Polish:     "Jakie nawyki przejąłeś z innej kultury?",
        Swedish:    "Vilken vana har du tagit med dig från en annan kultur?",
        Russian:    "Какую привычку ты перенял из другой культуры?",
        Tagalog:    "Anong ugali ang kinuha mo mula sa ibang kultura?",
        Swahili:    "Ni tabia gani uliyochukua kutoka kwa utamaduni mwingine?",
      },
      level: 2,
      tags: ["Cultural exchange"],
    },
    {
      t: {
        English:    "Tell me about a meal that has a story behind it.",
        Japanese:   "思い出のある食べ物の話を聞かせてください。",
        Korean:     "추억이 담긴 음식 이야기를 들려주세요.",
        Mandarin:   "聊聊一道有故事的菜吧。",
        Spanish:    "Cuéntame sobre una comida que tiene una historia.",
        French:     "Parlez-moi d'un repas qui a une histoire.",
        Portuguese: "Me conta sobre uma refeição que tem uma história.",
        German:     "Erzähl mir von einer Mahlzeit mit einer Geschichte dahinter.",
        Italian:    "Raccontami di un pasto che ha una storia.",
        Arabic:     "أخبرني عن وجبة لها قصة.",
        Hindi:      "किसी ऐसे खाने के बारे में बताइए जिसके पीछे एक कहानी है।",
        Turkish:    "Arkasında bir hikaye olan bir yemekten bahsedin.",
        Vietnamese: "Kể cho tôi nghe về một bữa ăn có câu chuyện phía sau.",
        Thai:       "เล่าเรื่องอาหารที่มีเรื่องราวเบื้องหลัง",
        Indonesian: "Ceritakan tentang makanan yang punya cerita di baliknya.",
        Dutch:      "Vertel me over een maaltijd die een verhaal heeft.",
        Polish:     "Opowiedz mi o posiłku, który ma jakąś historię.",
        Swedish:    "Berätta om en måltid som har en historia bakom sig.",
        Russian:    "Расскажи о блюде, за которым стоит история.",
        Tagalog:    "Sabihin mo sa akin ang tungkol sa isang pagkain na may kwento.",
        Swahili:    "Niambie kuhusu chakula chenye hadithi nyuma yake.",
      },
      level: 2,
      hint: "Ask if they still make it today.",
      tags: ["Casual conversation", "Cultural exchange"],
    },
    {
      t: {
        English:    "What's the hardest part of your job to explain to someone outside it?",
        Japanese:   "仕事の中で一番説明しにくいことは何ですか？",
        Korean:     "일 중에서 설명하기 가장 어려운 부분은 무엇인가요?",
        Mandarin:   "你工作中最难解释的是什么？",
        Spanish:    "¿Qué parte de tu trabajo es más difícil de explicar?",
        French:     "Quelle partie de votre travail est la plus difficile à expliquer ?",
        Portuguese: "Qual parte do seu trabalho é mais difícil de explicar?",
        German:     "Was ist der schwierigste Teil deines Jobs zu erklären?",
        Italian:    "Qual è la parte del tuo lavoro più difficile da spiegare?",
        Arabic:     "ما الجزء الأصعب في عملك لشرحه؟",
        Hindi:      "आपके काम का वह हिस्सा क्या है जिसे बाहरी व्यक्ति को समझाना सबसे मुश्किल है?",
        Turkish:    "İşinizin dışarıdan birine açıklaması en zor kısmı nedir?",
        Vietnamese: "Phần nào trong công việc của bạn khó giải thích nhất cho người ngoài?",
        Thai:       "ส่วนไหนของงานคุณที่ยากที่สุดในการอธิบายให้คนนอกเข้าใจ?",
        Indonesian: "Bagian paling sulit dari pekerjaanmu untuk dijelaskan kepada orang luar?",
        Dutch:      "Wat is het moeilijkste deel van je werk om aan buitenstaanders uit te leggen?",
        Polish:     "Jaka część twojej pracy jest najtrudniejsza do wyjaśnienia osobom z zewnątrz?",
        Swedish:    "Vad är den svåraste delen av ditt jobb att förklara för någon utanför?",
        Russian:    "Какую часть своей работы тебе сложнее всего объяснить постороннему?",
        Tagalog:    "Anong bahagi ng iyong trabaho ang pinakamahirap ipaliwanag sa labas?",
        Swahili:    "Sehemu gani ya kazi yako ni ngumu zaidi kuelezea kwa mtu wa nje?",
      },
      level: 3,
      tags: ["Work / professional"],
    },
    {
      t: {
        English:    "What's a word in your language that's hard to translate?",
        Japanese:   "翻訳しにくい言葉や表現はありますか？",
        Korean:     "번역하기 어려운 표현이 있나요?",
        Mandarin:   "你的语言中有什么难以翻译的词吗？",
        Spanish:    "¿Hay alguna palabra en tu idioma difícil de traducir?",
        French:     "Y a-t-il un mot dans votre langue difficile à traduire ?",
        Portuguese: "Tem alguma palavra no seu idioma difícil de traduzir?",
        German:     "Gibt es ein Wort in deiner Sprache, das schwer zu übersetzen ist?",
        Italian:    "C'è una parola nella tua lingua difficile da tradurre?",
        Arabic:     "هل هناك كلمة في لغتك يصعب ترجمتها؟",
        Hindi:      "आपकी भाषा में कोई ऐसा शब्द है जिसका अनुवाद करना मुश्किल है?",
        Turkish:    "Dilinizde çevrilmesi zor bir kelime var mı?",
        Vietnamese: "Có từ nào trong ngôn ngữ của bạn khó dịch sang tiếng khác không?",
        Thai:       "มีคำในภาษาของคุณที่แปลได้ยากไหม?",
        Indonesian: "Ada kata dalam bahasamu yang sulit diterjemahkan?",
        Dutch:      "Is er een woord in jouw taal dat moeilijk te vertalen is?",
        Polish:     "Czy jest jakieś słowo w twoim języku, które trudno przetłumaczyć?",
        Swedish:    "Finns det ett ord på ditt språk som är svårt att översätta?",
        Russian:    "Есть ли в твоём языке слово, которое трудно перевести?",
        Tagalog:    "Mayroon bang salita sa iyong wika na mahirap isalin?",
        Swahili:    "Kuna neno katika lugha yako ambalo ni gumu kutafsiri?",
      },
      level: 2,
      hint: "Try to use it together in a sentence.",
    },
    {
      t: {
        English:    "What's something most people get wrong about your country?",
        Japanese:   "自分の国について、よく誤解されることは何ですか？",
        Korean:     "당신 나라에 대해 많이 오해받는 게 있나요?",
        Mandarin:   "大家对你的国家最常有什么误解？",
        Spanish:    "¿Qué malentendido hay sobre tu país?",
        French:     "Quelle idée reçue existe sur votre pays ?",
        Portuguese: "O que as pessoas costumam entender errado sobre seu país?",
        German:     "Was missverstehen die Leute oft über dein Land?",
        Italian:    "Cosa fraintendono spesso sul tuo paese?",
        Arabic:     "ما الشيء الذي يسيء فهمه الناس عن بلدك؟",
        Hindi:      "आपके देश के बारे में ज़्यादातर लोग क्या गलत समझते हैं?",
        Turkish:    "Ülkeniz hakkında çoğu insanın yanlış anladığı bir şey nedir?",
        Vietnamese: "Điều gì mà hầu hết mọi người hiểu sai về đất nước bạn?",
        Thai:       "คนส่วนใหญ่เข้าใจผิดเรื่องอะไรเกี่ยวกับประเทศคุณ?",
        Indonesian: "Apa yang paling sering disalahpahami orang tentang negaramu?",
        Dutch:      "Wat begrijpen de meeste mensen verkeerd over jouw land?",
        Polish:     "Co większość ludzi źle rozumie na temat twojego kraju?",
        Swedish:    "Vad missförstår folk ofta om ditt land?",
        Russian:    "Что большинство людей неправильно понимает о твоей стране?",
        Tagalog:    "Ano ang madalas na maling pag-unawa ng mga tao tungkol sa iyong bansa?",
        Swahili:    "Ni nini ambacho watu wengi wanaelewa vibaya kuhusu nchi yako?",
      },
      level: 3,
    },
    {
      t: {
        English:    "What's something you've never told anyone about where you grew up?",
        Japanese:   "育った場所について、あまり話したことがないことはありますか？",
        Korean:     "자란 곳에 대해 별로 얘기한 적 없는 게 있나요?",
        Mandarin:   "关于你成长的地方，有什么你很少提起的事？",
        Spanish:    "¿Hay algo sobre donde creciste que no hayas contado?",
        French:     "Y a-t-il quelque chose sur l'endroit où vous avez grandi que vous n'avez jamais dit ?",
        Portuguese: "Tem algo sobre onde você cresceu que nunca contou?",
        German:     "Was hast du noch niemandem über deinen Aufwachsort erzählt?",
        Italian:    "C'è qualcosa su dove sei cresciuto che non hai mai detto?",
        Arabic:     "هل هناك شيء عن مكان نشأتك لم تخبر به أحدًا؟",
        Hindi:      "आपके पले-बढ़े जगह के बारे में कुछ ऐसा जो आपने किसी को नहीं बताया?",
        Turkish:    "Büyüdüğünüz yer hakkında kimseye anlatmadığınız bir şey?",
        Vietnamese: "Có điều gì về nơi bạn lớn lên mà bạn chưa kể cho ai nghe không?",
        Thai:       "มีอะไรเกี่ยวกับที่ที่คุณเติบโตที่คุณยังไม่เคยบอกใครบ้าง?",
        Indonesian: "Ada hal tentang tempat kamu tumbuh besar yang belum pernah kamu ceritakan?",
        Dutch:      "Is er iets over waar je bent opgegroeid dat je nooit aan iemand hebt verteld?",
        Polish:     "Czy jest coś o miejscu, w którym dorastałeś, czego nikomu nie powiedziałeś?",
        Swedish:    "Finns det något om platsen du växte upp på som du aldrig berättat för någon?",
        Russian:    "Есть ли что-то о месте, где ты вырос, о чём ты никогда никому не рассказывал?",
        Tagalog:    "Mayroon bang bagay tungkol sa lugar na lumaki ka na hindi mo pa sinabi sa kahit sino?",
        Swahili:    "Kuna kitu kuhusu mahali ulipokua ambacho hukumwambia mtu yeyote?",
      },
      level: 3,
      tags: ["Making friends"],
    },
  ],

  reflect: [
    {
      t: {
        English:    "What's one word or phrase you want to remember from today?",
        Japanese:   "今日覚えておきたい言葉や表現は何ですか？",
        Korean:     "오늘 기억하고 싶은 표현이 있나요?",
        Mandarin:   "今天有什么词或表达你想记住？",
        Spanish:    "¿Qué palabra o expresión quieres recordar de hoy?",
        French:     "Quel mot ou expression voulez-vous retenir d'aujourd'hui ?",
        Portuguese: "Que palavra ou expressão você quer lembrar de hoje?",
        German:     "Welches Wort oder welche Phrase möchtest du dir von heute merken?",
        Italian:    "Quale parola o frase vuoi ricordare di oggi?",
        Arabic:     "ما الكلمة أو العبارة التي تريد تذكرها من اليوم؟",
        Hindi:      "आज से कौन सा शब्द या वाक्यांश आप याद रखना चाहते हैं?",
        Turkish:    "Bugünden hatırlamak istediğiniz bir kelime veya ifade nedir?",
        Vietnamese: "Có từ hay cụm từ nào từ hôm nay bạn muốn ghi nhớ không?",
        Thai:       "มีคำหรือวลีใดจากวันนี้ที่คุณอยากจำ?",
        Indonesian: "Kata atau frasa apa yang ingin kamu ingat dari hari ini?",
        Dutch:      "Welk woord of welke zin wil je onthouden van vandaag?",
        Polish:     "Jakie słowo lub wyrażenie chcesz zapamiętać z dzisiaj?",
        Swedish:    "Vilket ord eller vilken fras vill du komma ihåg från idag?",
        Russian:    "Какое слово или фразу ты хочешь запомнить с сегодняшнего дня?",
        Tagalog:    "Anong salita o parirala ang gusto mong matandaan mula ngayon?",
        Swahili:    "Ni neno au fungu la maneno gani unalotaka kukumbuka kutoka leo?",
      },
      level: 1,
      hint: "Write it down before you forget.",
    },
    {
      t: {
        English:    "Was there a moment in this conversation where something clicked?",
        Japanese:   "会話の中で「あ、わかった」と感じた瞬間はありましたか？",
        Korean:     "대화 중 뭔가 이해된 순간이 있었나요?",
        Mandarin:   "交流中有没有某个瞬间让你突然明白了什么？",
        Spanish:    "¿Hubo un momento en que algo se aclaró?",
        French:     "Y a-t-il eu un moment où quelque chose s'est éclairé ?",
        Portuguese: "Teve um momento em que algo ficou claro?",
        German:     "Gab es einen Moment, in dem etwas klick gemacht hat?",
        Italian:    "C'è stato un momento in cui qualcosa ha fatto click?",
        Arabic:     "هل كان هناك لحظة شعرت فيها بأن شيئًا ما وضح لك؟",
        Hindi:      "क्या इस बातचीत में कोई ऐसा पल था जब कुछ समझ में आया?",
        Turkish:    "Bu konuşmada bir şeyin yerine oturduğu bir an oldu mu?",
        Vietnamese: "Trong cuộc trò chuyện này, có khoảnh khắc nào mà bạn chợt hiểu ra không?",
        Thai:       "มีช่วงไหนในการสนทนานี้ที่บางอย่างเข้าใจแจ่มแจ้งขึ้นบ้างไหม?",
        Indonesian: "Apakah ada momen dalam percakapan ini di mana sesuatu terasa jelas?",
        Dutch:      "Was er een moment in dit gesprek waarop iets klikte?",
        Polish:     "Czy był moment w tej rozmowie, kiedy coś zaskoczyło?",
        Swedish:    "Fanns det ett ögonblick i samtalet då något föll på plats?",
        Russian:    "Был ли в этом разговоре момент, когда что-то стало понятным?",
        Tagalog:    "Mayroon bang sandali sa pag-uusap na ito na biglang naging malinaw ang isang bagay?",
        Swahili:    "Kulikuwa na wakati katika mazungumzo haya ambapo kitu kilikuwa wazi?",
      },
      level: 2,
    },
    {
      t: {
        English:    "What do you want to talk about next time?",
        Japanese:   "次回は何について話したいですか？",
        Korean:     "다음엔 어떤 주제로 얘기하고 싶으세요?",
        Mandarin:   "下次你想聊什么？",
        Spanish:    "¿De qué quieres hablar la próxima vez?",
        French:     "De quoi voulez-vous parler la prochaine fois ?",
        Portuguese: "Sobre o que você quer falar da próxima vez?",
        German:     "Worüber möchtest du nächstes Mal reden?",
        Italian:    "Di cosa vuoi parlare la prossima volta?",
        Arabic:     "عمَّ تريد التحدث في المرة القادمة؟",
        Hindi:      "अगली बार आप किस बारे में बात करना चाहते हैं?",
        Turkish:    "Bir dahaki sefere ne hakkında konuşmak istersiniz?",
        Vietnamese: "Lần tới bạn muốn nói về điều gì?",
        Thai:       "ครั้งหน้าคุณอยากพูดคุยเรื่องอะไร?",
        Indonesian: "Apa yang ingin kamu bicarakan lain kali?",
        Dutch:      "Waarover wil je de volgende keer praten?",
        Polish:     "O czym chcesz rozmawiać następnym razem?",
        Swedish:    "Vad vill du prata om nästa gång?",
        Russian:    "О чём ты хочешь поговорить в следующий раз?",
        Tagalog:    "Ano ang gusto mong pag-usapan sa susunod na pagkakataon?",
        Swahili:    "Unataka kuzungumza kuhusu nini wakati ujao?",
      },
      level: 1,
    },
    {
      t: {
        English:    "What's one thing that surprised you about this conversation?",
        Japanese:   "この会話で意外だったことはありますか？",
        Korean:     "이번 대화에서 의외였던 게 있나요?",
        Mandarin:   "这次对话中有什么让你意外的吗？",
        Spanish:    "¿Qué te sorprendió de esta conversación?",
        French:     "Qu'est-ce qui vous a surpris dans cette conversation ?",
        Portuguese: "O que te surpreendeu nessa conversa?",
        German:     "Was hat dich an diesem Gespräch überrascht?",
        Italian:    "Cosa ti ha sorpreso di questa conversazione?",
        Arabic:     "ما الذي فاجأك في هذه المحادثة؟",
      },
      level: 2,
    },
  ],
};

// ── Prompt selection ──────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export function selectPrompts(pool: Prompt[], goal: string): Prompt[] {
  const tagged   = pool.filter(p => p.tags?.includes(goal));
  const untagged = pool.filter(p => !p.tags || p.tags.length === 0);
  const rest     = pool.filter(p => p.tags && p.tags.length > 0 && !p.tags.includes(goal));
  const byLevel  = (arr: Prompt[]) =>
    ([1, 2, 3] as const).flatMap(l => shuffle(arr.filter(p => (p.level ?? 2) === l)));
  return [...byLevel(tagged), ...byLevel(untagged), ...byLevel(rest)];
}

// ── Supabase fetch ────────────────────────────────────────────────────────────

// DB row shape returned by Supabase
interface PromptRow {
  id:           string;
  phase:        string;
  level:        number;
  tags:         string[];
  hint:         string | null;
  translations: Record<string, string>;
}

function rowToPrompt(row: PromptRow): Prompt {
  return {
    id:    row.id,
    t:     row.translations,
    hint:  row.hint ?? undefined,
    level: row.level as 1 | 2 | 3,
    tags:  row.tags,
  };
}

// Returns IDs of prompts shown to this pair within the last 30 days.
async function recentlyShownIds(idA: string, idB: string): Promise<Set<string>> {
  const [a, b] = [idA, idB].sort();
  const since  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('session_prompts')
    .select('prompt_id')
    .eq('session_id_a', a)
    .eq('session_id_b', b)
    .gte('shown_at', since);

  return new Set((data ?? []).map((r: { prompt_id: string }) => r.prompt_id));
}

export async function fetchSessionPool(
  sessionIdA: string,
  sessionIdB: string,
  goal: string,
): Promise<Pools> {
  const { data, error } = await supabase
    .from('prompts')
    .select('id, phase, level, tags, hint, translations');

  if (error || !data || data.length === 0) {
    return buildFallbackPool(goal);
  }

  const seen  = await recentlyShownIds(sessionIdA, sessionIdB);
  const rows  = data as PromptRow[];

  // Partition by phase. Prioritise unseen; append seen at end so the pool
  // never runs dry even if everything has been covered.
  function partition(phase: string): Prompt[] {
    const all    = rows.filter(r => r.phase === phase).map(rowToPrompt);
    const unseen = all.filter(p => !seen.has(p.id!));
    const seenPs = all.filter(p =>  seen.has(p.id!));
    return [
      ...selectPrompts(unseen, goal),
      ...selectPrompts(seenPs, goal),
    ];
  }

  return {
    ice:     partition('ice'),
    conv:    partition('conv'),
    reflect: partition('reflect'),
  };
}

// ── Sync fallback ─────────────────────────────────────────────────────────────

export function buildFallbackPool(goal: string): Pools {
  return {
    ice:     selectPrompts(LIBRARY.ice,     goal),
    conv:    selectPrompts(LIBRARY.conv,    goal),
    reflect: selectPrompts(LIBRARY.reflect, goal),
  };
}

// ── Record shown prompt ───────────────────────────────────────────────────────

export async function recordShownPrompt(
  sessionIdA: string,
  sessionIdB: string,
  promptId: string,
): Promise<void> {
  if (!isConfigured || !promptId) return;
  const [a, b] = [sessionIdA, sessionIdB].sort();
  await supabase.from('session_prompts').insert({
    session_id_a: a,
    session_id_b: b,
    prompt_id:    promptId,
  });
}
