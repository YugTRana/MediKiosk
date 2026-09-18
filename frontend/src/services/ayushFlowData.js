// AYUSH Ayurvedic Intake Assessment Flow (Classical Dashavidha Pariksha)
// Charaka Samhita Vimana Sthana 8/94 inspired clinical inquiry for Ayurvedic physician consultation:
// 1. Prakriti (Natural Constitution)
// 2. Vikriti (Active Morbidity / Dosha Imbalance)
// 3. Sara (Tissue Essence & Vitality)
// 4. Samhanana (Compactness of Frame)
// 5. Pramana (Anthropometry & Proportions)
// 6. Satmya (Homologation & Adaptational Tolerance)
// 7. Sattva (Mental Temperament & Resilience)
// 8. Ahara Shakti (Digestive & Intake Capacity)
// 9. Vyayama Shakti (Physical Endurance & Stamina)
// 10. Vaya (Biological Life Stage)
// Plus: Agni (Digestive Fire), Koshtha (Bowel Nature), and Ahara-Vihara (Diet & Routine)

export const AYUSH_COMPLAINT_META = {
  id: 'ayush_consultation',
  titleEn: 'Ayurvedic Consultation (AYUSH)',
  titleHi: 'आयुर्वेदिक परामर्श (आयुष)',
  iconName: 'Leaf',
  descriptionEn: 'Holistic Dashavidha Pariksha intake: Prakriti, Agni, Koshtha & Lifestyle',
  descriptionHi: 'प्रकृति, अग्नि (पाचन), कोष्ठ (मल प्रवृत्ति) और आहार-विहार का समग्र दशविध परीक्षण',
  color: 'emerald',
  badge: 'Traditional & Holistic Medicine'
};

export const AYUSH_QUESTIONS = [
  // 1. Prakriti (Constitution)
  {
    id: 'ayush_prakriti',
    dimension: 'Prakriti (शरीर प्रकृति)',
    dimensionEn: '1. Prakriti (Constitution & Frame)',
    dimensionHi: '1. प्रकृति (शरीर का ढांचा व स्वाभाविक स्वभाव)',
    questionEn: 'Which description best matches your natural body build and temperament since youth?',
    questionHi: 'आपकी स्वाभाविक शारीरिक बनावट और स्वभाव किस श्रेणी से सबसे अधिक मेल खाता है?',
    options: [
      {
        dosha: 'Vata',
        value: 'vata',
        labelEn: 'Vata: Lean slender frame, dry skin, quick mind, active, sensitive to cold',
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
        labelEn: 'Mixed / Dual: Combination of features from two or more types',
        labelHi: 'द्विदोषज/मिश्रित: ऊपर दिए गए लक्षणों का मिला-जुला रूप',
        description: 'Vata-Pitta or Pitta-Kapha balance'
      }
    ]
  },

  // 2. Vikriti (Active Dosha Imbalance)
  {
    id: 'ayush_vikriti',
    dimension: 'Vikriti (विकृति व वर्तमान दोष)',
    dimensionEn: '2. Vikriti (Active Dosha Disturbance)',
    dimensionHi: '2. विकृति (वर्तमान में शरीर में कौन सा दोष बढ़ा हुआ लगता है?)',
    questionEn: 'Which uncomfortable symptoms are currently most troubling you?',
    questionHi: 'वर्तमान में आपको मुख्य रूप से किस प्रकार की शारीरिक तकलीफ अधिक महसूस हो रही है?',
    options: [
      {
        vikritiDosha: 'Vata Imbalance',
        value: 'vata_vikriti',
        labelEn: 'Joint/body aches, gas, dryness, sleep disturbances, anxiety or stiffness',
        labelHi: 'जोड़ों व शरीर में दर्द, गैस, रूखापन, नींद की कमी या अकड़न (वात प्रकोप)',
        description: 'Vata aggravation'
      },
      {
        vikritiDosha: 'Pitta Imbalance',
        value: 'pitta_vikriti',
        labelEn: 'Acidity, heartburn, excessive thirst, burning sensation, skin redness or irritability',
        labelHi: 'खट्टी डकारें, जलन, अत्यधिक प्यास, शरीर में गर्मी, त्वचा पर लालिमा (पित्त प्रकोप)',
        description: 'Pitta aggravation'
      },
      {
        vikritiDosha: 'Kapha Imbalance',
        value: 'kapha_vikriti',
        labelEn: 'Heavy body feeling, excessive mucus/cough, lethargy, sluggishness, water retention',
        labelHi: 'शरीर में भारीपन, कफ/बलगम, आलस्य, सुस्ती, अंग शिथिलता (कफ प्रकोप)',
        description: 'Kapha aggravation'
      },
      {
        vikritiDosha: 'Sama (Balanced/Mild)',
        value: 'sama_state',
        labelEn: 'No acute doshic aggravation; seeking preventive health guidance',
        labelHi: 'कोई गंभीर असंतुलन नहीं; सामान्य स्वास्थ्य सुधार हेतु परामर्श',
        description: 'Mild or sub-clinical imbalance'
      }
    ]
  },

  // 3. Sara (Tissue Essence / Vitality)
  {
    id: 'ayush_sara',
    dimension: 'Sara (धातु सारता)',
    dimensionEn: '3. Sara (Tissue Vitality & Structural Essence)',
    dimensionHi: '3. धातु सारता (शरीर की आंतरिक दृढ़ता व धातुओं का स्वास्थ्य)',
    questionEn: 'How would you describe your hair, skin, bones, teeth, and general body vitality?',
    questionHi: 'आपके बाल, त्वचा, हड्डियां, दांत और शरीर की आंतरिक ताकत कैसी है?',
    options: [
      {
        saraGrade: 'Pravara Sara (उत्तम सार)',
        value: 'pravara_sara',
        labelEn: 'High vitality: Lustrous hair, clear resilient skin, strong bones and teeth',
        labelHi: 'उत्तम सार: घने चमकदार बाल, स्वस्थ कांतिपूर्ण त्वचा, मजबूत हड्डियां व दांत',
        description: 'Excellent tissue vitality'
      },
      {
        saraGrade: 'Madhyama Sara (मध्यम सार)',
        value: 'madhyama_sara',
        labelEn: 'Moderate vitality: Normal tissue health with occasional seasonal dryness or weakness',
        labelHi: 'मध्यम सार: सामान्य शारीरिक मजबूती, कभी-कभार थकान या बालों का गिरना',
        description: 'Moderate tissue vitality'
      },
      {
        saraGrade: 'Avara Sara (अवर/हीन सार)',
        value: 'avara_sara',
        labelEn: 'Low vitality: Brittle nails, hair thinning, dull dry skin, early bodily fatigue',
        labelHi: 'अवर सार: कमजोर नाखून, बाल झड़ना, रूखी बेजान त्वचा, जल्दी कमजोरी आना',
        description: 'Suboptimal tissue vitality'
      }
    ]
  },

  // 4. Samhanana & Pramana (Body Compactness & Proportions)
  {
    id: 'ayush_samhanana',
    dimension: 'Samhanana (संहनन व शरीर गठन)',
    dimensionEn: '4. Samhanana (Body Compactness & Symmetry)',
    dimensionHi: '4. संहनन (हड्डियों व मांसपेशियों का गठाव व बनावट)',
    questionEn: 'How is the firmness and compactness of your muscular and skeletal structure?',
    questionHi: 'आपकी मांसपेशियों और हड्डियों की बनावट और मजबूती कैसी है?',
    options: [
      {
        compactness: 'Susamhata (सुसंहत - उत्तम)',
        value: 'susamhata',
        labelEn: 'Well-compacted: Solid, well-knit joints and well-proportioned musculature',
        labelHi: 'सुसंहत: मजबूत गठे हुए जोड़, सुडौल मांसपेशियां और दृढ़ शारीरिक बनावट',
        description: 'Well-knit compact structure'
      },
      {
        compactness: 'Madhyama (मध्यम गठन)',
        value: 'madhyama_samhanana',
        labelEn: 'Average build: Moderate joint firmness and average muscle tone',
        labelHi: 'मध्यम: औसत शारीरिक गठन, सामान्य मांसपेशियों की दृढ़ता',
        description: 'Average body compactness'
      },
      {
        compactness: 'Hina / Asamhata (अवर गठन)',
        value: 'hina_samhanana',
        labelEn: 'Loose or fragile: Easily sprained joints, weak posture, frail body frame',
        labelHi: 'अवर/असंहत: जोड़ों में जल्दी मोच आना, कमजोर शरीर व शिथिल मांसपेशियां',
        description: 'Fragile body frame'
      }
    ]
  },

  // 5. Satmya (Adaptational Homologation)
  {
    id: 'ayush_satmya',
    dimension: 'Satmya (सात्म्य व अनुकूलन)',
    dimensionEn: '5. Satmya (Nutritional & Climate Adaptability)',
    dimensionHi: '5. सात्म्य (विभिन्न प्रकार के भोजन और मौसम को सहने की क्षमता)',
    questionEn: 'Can your body easily adapt to different foods, seasonal changes, and climates?',
    questionHi: 'क्या आपका शरीर अलग-अलग खानपान और मौसम के बदलाव को आसानी से सहन कर लेता है?',
    options: [
      {
        satmyaType: 'Sarva-Rasa Satmya (सर्व रस सात्म्य)',
        value: 'sarva_rasa',
        labelEn: 'High adaptability: Tolerates all food tastes (sweet, sour, spicy, bitter) and seasonal shifts well',
        labelHi: 'उत्तम सात्म्य: सभी प्रकार के स्वाद (मीठा, खट्टा, तीखा) और मौसम आसानी से पचते हैं',
        description: 'Broad adaptational range'
      },
      {
        satmyaType: 'Madhyama Satmya (मध्यम सात्म्य)',
        value: 'madhyama_satmya',
        labelEn: 'Moderate adaptability: Sensitive to sudden weather changes or extreme spicy/sour foods',
        labelHi: 'मध्यम सात्म्य: मौसम बदलने या ज्यादा तीखा/खट्टा खाने पर हल्की समस्या होना',
        description: 'Moderate adaptational range'
      },
      {
        satmyaType: 'Avara / Eka-Rasa (अवर सात्म्य)',
        value: 'avara_satmya',
        labelEn: 'Limited adaptability: Highly sensitive, easily upset by unfamiliar foods or mild cold/heat',
        labelHi: 'अवर सात्म्य: बहुत संवेदनशील, नया खाना या मामूली सर्दी-गर्मी से तुरंत बीमार पड़ना',
        description: 'Restricted adaptational capacity'
      }
    ]
  },

  // 6. Sattva (Mental Temperament & Resilience)
  {
    id: 'ayush_sattva',
    dimension: 'Sattva (सत्त्व व मानसिक बल)',
    dimensionEn: '6. Sattva (Psychological Strength & Pain Endurance)',
    dimensionHi: '6. सत्त्व (मानसिक शक्ति, धैर्य व दर्द सहने की क्षमता)',
    questionEn: 'How do you handle stress, illness, medical treatments, and physical discomfort?',
    questionHi: 'तनाव, शारीरिक दर्द या बीमारी की स्थिति में आपका मानसिक धैर्य कैसा रहता है?',
    options: [
      {
        sattvaGrade: 'Pravara Sattva (प्रवर सत्त्व - उच्च धैर्य)',
        value: 'pravara_sattva',
        labelEn: 'High resilience: Calm, composed under stress, high pain tolerance, optimistic',
        labelHi: 'प्रवर सत्त्व: शांत स्वभाव, उच्च मानसिक धैर्य, दर्द व तनाव में विचलित न होना',
        description: 'Strong emotional resilience'
      },
      {
        sattvaGrade: 'Madhyama Sattva (मध्यम सत्त्व)',
        value: 'madhyama_sattva',
        labelEn: 'Average resilience: Manages distress with support, occasional worry or restlessness',
        labelHi: 'मध्यम सत्त्व: सामान्य धैर्य, अपनों के समझाने पर संभल जाना, कभी-कभार चिंता',
        description: 'Moderate resilience'
      },
      {
        sattvaGrade: 'Avara Sattva (अवर सत्त्व - दुर्बल)',
        value: 'avara_sattva',
        labelEn: 'Low resilience: Highly anxious, fearful of needles/pain, easily overwhelmed by stress',
        labelHi: 'अवर सत्त्व: बहुत जल्दी घबरा जाना, दर्द व बीमारी से अत्यधिक डर लगना',
        description: 'Sensitive/anxiety-prone nature'
      }
    ]
  },

  // 7. Agni & Ahara Shakti (Digestive Fire & Intake Capacity)
  {
    id: 'ayush_agni',
    dimension: 'Agni (पाचन अग्नि व आहार शक्ति)',
    dimensionEn: '7. Agni & Ahara Shakti (Digestive Fire & Food Capacity)',
    dimensionHi: '7. अग्नि व आहार शक्ति (भूख, पाचन व खाना खाने की क्षमता)',
    questionEn: 'How is your daily appetite and how smoothly does food digest after meals?',
    questionHi: 'आपकी रोजाना की भूख और भोजन पचने की गति कैसी रहती है?',
    options: [
      {
        agniType: 'Tikshnagni (तीक्ष्णाग्नि - तेज भूख)',
        value: 'tikshnagni',
        labelEn: 'Tikshnagni: Very strong appetite, rapid digestion, irritable or weak if meals are delayed',
        labelHi: 'तीक्ष्णाग्नि: बहुत तेज भूख, खाना जल्दी पचना, समय पर खाना न मिले तो बेचैनी/गुस्सा',
        description: 'Pitta predominant rapid digestion'
      },
      {
        agniType: 'Mandagni (मन्दाग्नि - सुस्त पाचन)',
        value: 'mandagni',
        labelEn: 'Mandagni: Low appetite, heaviness in chest/stomach for hours after light meals',
        labelHi: 'मन्दाग्नि: भूख कम लगना, थोड़ा सा खाने पर भी घंटों तक पेट भारी रहना',
        description: 'Kapha predominant sluggish digestion'
      },
      {
        agniType: 'Vishamagni (विषमाग्नि - अनियमित पाचन)',
        value: 'vishamagni',
        labelEn: 'Vishamagni: Irregular appetite, gas, bloating, digestion varies day to day',
        labelHi: 'विषमाग्नि: कभी बहुत भूख कभी बिल्कुल नहीं, पेट फूलना, अफारा व गैस बनना',
        description: 'Vata predominant variable digestion'
      },
      {
        agniType: 'Samagni (समाग्नि - संतुलित पाचन)',
        value: 'samagni',
        labelEn: 'Samagni: Healthy, balanced appetite; meals digest comfortably in 3-4 hours',
        labelHi: 'समाग्नि: संतुलित भूख, खाना समय पर और बिना किसी भारीपन के आसानी से पचना',
        description: 'Ideal balanced digestive state'
      }
    ]
  },

  // 8. Vyayama Shakti (Physical Work Endurance & Stamina)
  {
    id: 'ayush_vyayama_shakti',
    dimension: 'Vyayama Shakti (व्यायाम शक्ति)',
    dimensionEn: '8. Vyayama Shakti (Physical Stamina & Work Capacity)',
    dimensionHi: '8. व्यायाम शक्ति (शारीरिक परिश्रम व काम करने की क्षमता)',
    questionEn: 'How is your capacity for physical labor, brisk walking, stairs, or exercise?',
    questionHi: 'पैदल चलने, सीढ़ियां चढ़ने या शारीरिक काम करने में आपकी सांस और ताकत कैसी रहती है?',
    options: [
      {
        capacity: 'Pravara (उत्तम व्यायाम शक्ति)',
        value: 'pravara_vyayama',
        labelEn: 'High capacity: Can perform prolonged physical work or sports without undue fatigue',
        labelHi: 'उत्तम शक्ति: बिना थके लगातार शारीरिक काम, व्यायाम या तेज चाल चलने की क्षमता',
        description: 'High physical stamina'
      },
      {
        capacity: 'Madhyama (मध्यम शक्ति)',
        value: 'madhyama_vyayama',
        labelEn: 'Moderate capacity: Can handle routine daily chores and 20-30 min walking comfortably',
        labelHi: 'मध्यम शक्ति: सामान्य दैनिक कामकाज और 20-30 मिनट टहलना बिना परेशानी के कर पाना',
        description: 'Average physical stamina'
      },
      {
        capacity: 'Avara (हीन/अल्प शक्ति)',
        value: 'avara_vyayama',
        labelEn: 'Low capacity: Gets breathless, fatigued or exhausted after minor exertion or 1 flight of stairs',
        labelHi: 'अवर शक्ति: थोड़ा सा चलने या 1 मंजिल सीढ़ी चढ़ने पर ही सांस फूलना व भारी थकान',
        description: 'Low physical stamina'
      }
    ]
  },

  // 9. Koshtha (Bowel Elimination Pattern)
  {
    id: 'ayush_koshtha',
    dimension: 'Koshtha (कोष्ठ व मल प्रवृत्ति)',
    dimensionEn: '9. Koshtha (Bowel Pattern & Elimination)',
    dimensionHi: '9. कोष्ठ (शौच व पेट साफ होने का स्वभाव)',
    questionEn: 'How regular and comfortable is your bowel movement (evacuation)?',
    questionHi: 'आपका पेट साफ होने की क्रिया (शौच) कैसी रहती है?',
    options: [
      {
        koshthaType: 'Krura (क्रूर कोष्ठ - कठोर)',
        value: 'krura',
        labelEn: 'Krura Koshtha: Hard dry stools, irregular passing, tendency to chronic constipation',
        labelHi: 'क्रूर कोष्ठ: मल कठोर व सूखा, नियमित न होना, कब्ज की पुरानी शिकायत',
        description: 'Dry Vata predominant elimination'
      },
      {
        koshthaType: 'Mridu (मृदु कोष्ठ - नरम/ढीला)',
        value: 'mridu',
        labelEn: 'Mridu Koshtha: Soft or loose stools, rapid evacuation, easily upset by milk, ghee or fruits',
        labelHi: 'मृदु कोष्ठ: नरम या ढीला मल, दूध, घी या फल लेने पर तुरंत दस्त की प्रवृत्ति',
        description: 'Sensitive Pitta predominant elimination'
      },
      {
        koshthaType: 'Madhyama (मध्यम कोष्ठ - सामान्य)',
        value: 'madhyama',
        labelEn: 'Madhyama Koshtha: Smooth, effortless once-or-twice daily natural elimination',
        labelHi: 'मध्यम कोष्ठ: रोजाना 1-2 बार आसानी से और बिना किसी परेशानी के पेट साफ होना',
        description: 'Balanced normal elimination'
      }
    ]
  },

  // 10. Ahara-Vihara & Vaya (Diet, Sleep & Lifestyle Habits)
  {
    id: 'ayush_ahara_vihara',
    dimension: 'Ahara-Vihara (आहार-विहार)',
    dimensionEn: '10. Ahara & Vihara (Diet, Sleep & Routine)',
    dimensionHi: '10. आहार-विहार (खानपान, नींद व दिनचर्या की आदतें)',
    questionEn: 'Which daily routine and dietary habit best matches your current lifestyle?',
    questionHi: 'आपकी दिनचर्या, खानपान और नींद की आदतें किस श्रेणी में आती हैं?',
    options: [
      {
        pattern: 'Vata Aggravating Habits',
        value: 'vata_habits',
        labelEn: 'Irregular meal timings, cold/dry/junk snacks, late night sleeping, mental tension',
        labelHi: 'अनियमित समय पर खाना, रूखा-सूखा खानपान, देर रात जागना, मानसिक तनाव',
        description: 'Vata provoking lifestyle'
      },
      {
        pattern: 'Pitta Aggravating Habits',
        value: 'pitta_habits',
        labelEn: 'Frequent spicy, oily, sour meals, tea/coffee excess, short temper, heat exposure',
        labelHi: 'ज्यादा तीखा, खट्टा, तला हुआ भोजन, अधिक चाय/कॉफी, धूप व गर्मी में रहना',
        description: 'Pitta provoking lifestyle'
      },
      {
        pattern: 'Kapha Aggravating Habits',
        value: 'kapha_habits',
        labelEn: 'Heavy sweets, dairy, oily curries, daytime naps, sedentary habits with no exercise',
        labelHi: 'अधिक मीठा, चिकनाई युक्त भोजन, दिन में सोना, व्यायाम की कमी',
        description: 'Kapha provoking lifestyle'
      },
      {
        pattern: 'Sattvic Balanced Routine',
        value: 'balanced_habits',
        labelEn: 'Fresh warm homemade meals, 7-8 hrs regular night sleep, daily walking or yoga',
        labelHi: 'ताजा गर्म सात्विक भोजन, 7-8 घंटे की नियमित नींद, दैनिक योग या टहलना',
        description: 'Sattvic healthy routine'
      }
    ]
  }
];

/**
 * Compile a comprehensive Dashavidha Pariksha assessment profile.
 */
export function compileAyushSummary(ayushAnswers = {}) {
  const getOpt = (id) => ayushAnswers[id]?.selectedOption || null;

  const prakritiOpt = getOpt('ayush_prakriti');
  const vikritiOpt = getOpt('ayush_vikriti');
  const saraOpt = getOpt('ayush_sara');
  const samhananaOpt = getOpt('ayush_samhanana');
  const satmyaOpt = getOpt('ayush_satmya');
  const sattvaOpt = getOpt('ayush_sattva');
  const agniOpt = getOpt('ayush_agni');
  const vyayamaOpt = getOpt('ayush_vyayama_shakti');
  const koshthaOpt = getOpt('ayush_koshtha');
  const aharaOpt = getOpt('ayush_ahara_vihara');

  const dominantDosha = prakritiOpt?.dosha || 'Vata-Pitta';
  const agniName = agniOpt?.agniType || 'Vishamagni (अनियमित अग्नि)';
  const koshthaName = koshthaOpt?.koshthaType || 'Madhyama (मध्यम कोष्ठ)';
  const lifestyleName = aharaOpt?.pattern || 'Standard Lifestyle';
  const vikritiName = vikritiOpt?.vikritiDosha || 'Vata Imbalance';

  return {
    dominantDosha,
    prakriti: {
      value: prakritiOpt?.value || 'vata_pitta',
      labelEn: prakritiOpt?.labelEn || 'Vata-Pitta Constitution',
      labelHi: prakritiOpt?.labelHi || 'वात-पित्त प्रकृति'
    },
    vikriti: {
      value: vikritiOpt?.value || 'vata_vikriti',
      dosha: vikritiName,
      labelEn: vikritiOpt?.labelEn || 'Vata aggravation',
      labelHi: vikritiOpt?.labelHi || 'वात प्रकोप'
    },
    sara: {
      value: saraOpt?.value || 'madhyama_sara',
      grade: saraOpt?.saraGrade || 'Madhyama Sara (मध्यम सार)',
      labelEn: saraOpt?.labelEn || 'Moderate tissue vitality',
      labelHi: saraOpt?.labelHi || 'मध्यम धातु सारता'
    },
    samhanana: {
      value: samhananaOpt?.value || 'madhyama_samhanana',
      compactness: samhananaOpt?.compactness || 'Madhyama (मध्यम गठन)',
      labelEn: samhananaOpt?.labelEn || 'Average body build',
      labelHi: samhananaOpt?.labelHi || 'मध्यम शारीरिक गठन'
    },
    satmya: {
      value: satmyaOpt?.value || 'madhyama_satmya',
      type: satmyaOpt?.satmyaType || 'Madhyama Satmya',
      labelEn: satmyaOpt?.labelEn || 'Moderate dietary adaptability',
      labelHi: satmyaOpt?.labelHi || 'मध्यम सात्म्य'
    },
    sattva: {
      value: sattvaOpt?.value || 'madhyama_sattva',
      grade: sattvaOpt?.sattvaGrade || 'Madhyama Sattva (मध्यम मानसिक बल)',
      labelEn: sattvaOpt?.labelEn || 'Average mental resilience',
      labelHi: sattvaOpt?.labelHi || 'मध्यम सत्त्व'
    },
    agni: {
      value: agniOpt?.value || 'vishamagni',
      agniType: agniName,
      labelEn: agniOpt?.labelEn || 'Vishamagni: Variable appetite and digestion',
      labelHi: agniOpt?.labelHi || 'विषमाग्नि: अनिश्चित भूख व पाचन'
    },
    vyayamaShakti: {
      value: vyayamaOpt?.value || 'madhyama_vyayama',
      capacity: vyayamaOpt?.capacity || 'Madhyama (मध्यम व्यायाम शक्ति)',
      labelEn: vyayamaOpt?.labelEn || 'Moderate physical work stamina',
      labelHi: vyayamaOpt?.labelHi || 'मध्यम व्यायाम शक्ति'
    },
    koshtha: {
      value: koshthaOpt?.value || 'madhyama',
      koshthaType: koshthaName,
      labelEn: koshthaOpt?.labelEn || 'Madhyama Koshtha: Regular elimination',
      labelHi: koshthaOpt?.labelHi || 'मध्यम कोष्ठ: नियमित शौच प्रवृत्ति'
    },
    aharaVihara: {
      value: aharaOpt?.value || 'balanced_habits',
      pattern: lifestyleName,
      labelEn: aharaOpt?.labelEn || 'Routine dietary and sleep habits',
      labelHi: aharaOpt?.labelHi || 'सामान्य आहार-विहार'
    },
    vaya: {
      stage: 'Madhyama Vaya (युवा/प्रौढ़ वय)',
      labelEn: 'Adult stage (20-60 yrs)',
      labelHi: 'मध्यम वय (वयस्क अवस्था)'
    },
    clarifyingHistory: null,
    ayurvedicSummary: `${dominantDosha} Prakriti with active ${vikritiName}. Evaluated with ${agniName}, ${koshthaName}. Lifestyle pattern: ${lifestyleName}.`
  };
}
