// AYUSH Ayurvedic Intake Assessment Flow (Dashavidha Pariksha inspired)
// Standalone clinical inquiry for Ayurvedic physician consultation

export const AYUSH_COMPLAINT_META = {
  id: 'ayush_consultation',
  titleEn: 'Ayurvedic Consultation (AYUSH)',
  titleHi: 'आयुर्वेदिक परामर्श (आयुष)',
  iconName: 'Leaf',
  descriptionEn: 'Holistic Dashavidha Pariksha intake: Prakriti, Agni, Koshtha & Lifestyle',
  descriptionHi: 'प्रकृति, अग्नि (पाचन), कोष्ठ (मल प्रवृत्ति) और आहार-विहार का समग्र परीक्षण',
  color: 'emerald',
  badge: 'Traditional & Holistic Medicine'
};

export const AYUSH_QUESTIONS = [
  {
    id: 'ayush_prakriti',
    dimension: 'Prakriti (शरीर प्रकृति)',
    dimensionEn: 'Prakriti (Constitution & Frame)',
    dimensionHi: 'प्रकृति (शरीर का ढांचा व स्वभाव)',
    questionEn: 'Which description best matches your natural body build and temperament?',
    questionHi: 'आपकी स्वाभाविक शारीरिक बनावट और स्वभाव किस विकल्प से सबसे ज्यादा मेल खाता है?',
    options: [
      {
        dosha: 'Vata',
        value: 'vata',
        labelEn: 'Vata: Lean frame, dry skin, quick mind, active, sensitive to cold',
        labelHi: 'वात: दुबला-पतला शरीर, रूखी त्वचा, तेज सक्रिय मन, ठंड से परेशानी',
        description: 'Light, dry, mobile constitution'
      },
      {
        dosha: 'Pitta',
        value: 'pitta',
        labelEn: 'Pitta: Medium athletic build, warm skin, sharp appetite, sensitive to heat',
        labelHi: 'पित्त: मध्यम सुगठित शरीर, गर्म त्वचा, तेज भूख, गर्मी सहन न होना',
        description: 'Hot, sharp, metabolic constitution'
      },
      {
        dosha: 'Kapha',
        value: 'kapha',
        labelEn: 'Kapha: Solid broad frame, smooth skin, calm temperament, slow & steady',
        labelHi: 'कफ: भारी व चौड़ा शरीर, चिकनी त्वचा, शांत व धैर्यवान स्वभाव',
        description: 'Heavy, stable, nourishing constitution'
      },
      {
        dosha: 'Dual/Tridosha',
        value: 'mixed_doshic',
        labelEn: 'Mixed / Dual: Combination of features from above',
        labelHi: 'मिश्रित: ऊपर दिए गए लक्षणों का मिला-जुला रूप',
        description: 'Vata-Pitta or Pitta-Kapha balance'
      }
    ]
  },
  {
    id: 'ayush_agni',
    dimension: 'Agni (पाचन अग्नि)',
    dimensionEn: 'Agni (Digestive Fire & Metabolism)',
    dimensionHi: 'अग्नि (पाचन शक्ति व भूख)',
    questionEn: 'How is your daily appetite and digestion pattern?',
    questionHi: 'आपकी रोजाना की भूख और भोजन पचने की गति कैसी रहती है?',
    options: [
      {
        agniType: 'Tikshnagni (तेज अग्नि)',
        value: 'tikshnagni',
        labelEn: 'Tikshnagni: Very strong appetite, rapid digestion, irritable if meals delayed',
        labelHi: 'तीक्ष्णाग्नि: बहुत तेज भूख, खाना जल्दी पचना, भूख लगने पर गुस्सा आना',
        description: 'Hyperactive Pitta digestive fire'
      },
      {
        agniType: 'Mandagni (मन्द अग्नि)',
        value: 'mandagni',
        labelEn: 'Mandagni: Low/sluggish appetite, heavy stomach feeling for hours after food',
        labelHi: 'मन्दाग्नि: भूख कम लगना, खाने के बाद घंटों तक पेट भारी रहना',
        description: 'Sluggish Kapha digestive fire'
      },
      {
        agniType: 'Vishamagni (विषम अग्नि)',
        value: 'vishamagni',
        labelEn: 'Vishamagni: Unpredictable appetite, frequent gas, bloating or flatulence',
        labelHi: 'विषमाग्नि: अनिश्चित भूख, कभी बहुत ज्यादा कभी बिल्कुल नहीं, पेट फूलना/गैस',
        description: 'Variable Vata digestive fire'
      },
      {
        agniType: 'Samagni (सम अग्नि)',
        value: 'samagni',
        labelEn: 'Samagni: Healthy, balanced appetite with comfortable normal digestion',
        labelHi: 'समाग्नि: संतुलित भूख, खाना समय पर और बिना किसी परेशानी के पचना',
        description: 'Ideal balanced digestive fire'
      }
    ]
  },
  {
    id: 'ayush_koshtha',
    dimension: 'Koshtha (कोष्ठ व मल प्रवृत्ति)',
    dimensionEn: 'Koshtha (Bowel Pattern & Elimination)',
    dimensionHi: 'कोष्ठ (शौच व पेट साफ होने का स्वभाव)',
    questionEn: 'How regular and comfortable is your bowel movement?',
    questionHi: 'आपका पेट साफ होने की क्रिया (शौच) कैसी रहती है?',
    options: [
      {
        koshthaType: 'Krura (कठोर कोष्ठ)',
        value: 'krura',
        labelEn: 'Krura Koshtha: Hard dry stools, irregular passing, tendency to constipation',
        labelHi: 'क्रूर कोष्ठ: मल कठोर व सूखा, नियमित न होना, कब्ज की पुरानी शिकायत',
        description: 'Dry Vata predominant elimination'
      },
      {
        koshthaType: 'Mridu (मृदु कोष्ठ)',
        value: 'mridu',
        labelEn: 'Mridu Koshtha: Soft or loose stools, rapid evacuation, easily upset by milk/fruits',
        labelHi: 'मृदु कोष्ठ: नरम या ढीला मल, दूध या फल लेने पर तुरंत दस्त की प्रवृत्ति',
        description: 'Sensitive Pitta predominant elimination'
      },
      {
        koshthaType: 'Madhyama (मध्यम कोष्ठ)',
        value: 'madhyama',
        labelEn: 'Madhyama Koshtha: Smooth, effortless once-or-twice daily natural elimination',
        labelHi: 'मध्यम कोष्ठ: रोजाना 1-2 बार आसानी से और बिना किसी परेशानी के पेट साफ होना',
        description: 'Balanced normal elimination'
      }
    ]
  },
  {
    id: 'ayush_ahara_vihara',
    dimension: 'Ahara-Vihara (आहार-विहार)',
    dimensionEn: 'Ahara & Vihara (Diet & Lifestyle Habits)',
    dimensionHi: 'आहार-विहार (खानपान, नींद व दिनचर्या)',
    questionEn: 'Which routine best reflects your daily diet and lifestyle habits?',
    questionHi: 'आपकी दिनचर्या, खानपान और नींद की आदतें किस श्रेणी में आती हैं?',
    options: [
      {
        pattern: 'Vata Aggravating',
        value: 'vata_habits',
        labelEn: 'Irregular eating times, cold/dry snacks, late night sleeping, mental stress',
        labelHi: 'अनियमित समय पर खाना, रूखा-सूखा खानपान, देर रात सोना, मानसिक तनाव',
        description: 'Vata provoking lifestyle'
      },
      {
        pattern: 'Pitta Aggravating',
        value: 'pitta_habits',
        labelEn: 'Frequent spicy, sour, fried foods, tea/coffee excess, short temper/heat exposure',
        labelHi: 'ज्यादा तीखा, खट्टा, तला हुआ भोजन, अधिक चाय/कॉफी, धूप व गर्मी में रहना',
        description: 'Pitta provoking lifestyle'
      },
      {
        pattern: 'Kapha Aggravating',
        value: 'kapha_habits',
        labelEn: 'Heavy sweets, dairy, oily meals, sedentary habits, daytime sleep',
        labelHi: 'अधिक मीठा, चिकनाई युक्त भोजन, व्यायाम की कमी, दिन में सोने की आदत',
        description: 'Kapha provoking lifestyle'
      },
      {
        pattern: 'Balanced Routine',
        value: 'balanced_habits',
        labelEn: 'Warm fresh home meals, 7-8 hrs regular sleep, daily light walking or yoga',
        labelHi: 'ताजा गर्म सात्विक भोजन, 7-8 घंटे की नियमित नींद, दैनिक योग या टहलना',
        description: 'Sattvic healthy routine'
      }
    ]
  }
];

export function compileAyushSummary(ayushAnswers = {}) {
  const prakritiOpt = ayushAnswers['ayush_prakriti']?.selectedOption;
  const agniOpt = ayushAnswers['ayush_agni']?.selectedOption;
  const koshthaOpt = ayushAnswers['ayush_koshtha']?.selectedOption;
  const aharaOpt = ayushAnswers['ayush_ahara_vihara']?.selectedOption;

  const dosha = prakritiOpt?.dosha || 'Vata-Pitta';
  const agni = agniOpt?.agniType || 'Vishamagni';
  const koshtha = koshthaOpt?.koshthaType || 'Madhyama';
  const lifestyle = aharaOpt?.pattern || 'Standard Lifestyle';

  return {
    dominantDosha: dosha,
    prakriti: {
      value: prakritiOpt?.value || 'unknown',
      labelEn: prakritiOpt?.labelEn || 'Prakriti not specified',
      labelHi: prakritiOpt?.labelHi || 'प्रकृति अनिर्धारित'
    },
    agni: {
      value: agniOpt?.value || 'unknown',
      labelEn: agniOpt?.labelEn || 'Agni not specified',
      labelHi: agniOpt?.labelHi || 'अग्नि अनिर्धारित'
    },
    koshtha: {
      value: koshthaOpt?.value || 'unknown',
      labelEn: koshthaOpt?.labelEn || 'Koshtha not specified',
      labelHi: koshthaOpt?.labelHi || 'कोष्ठ अनिर्धारित'
    },
    aharaVihara: {
      value: aharaOpt?.value || 'unknown',
      labelEn: aharaOpt?.labelEn || 'Lifestyle not specified',
      labelHi: aharaOpt?.labelHi || 'आहार-विहार अनिर्धारित'
    },
    ayurvedicSummary: `${dosha} Prakriti with ${agni} and ${koshtha}. Lifestyle note: ${lifestyle}.`
  };
}
