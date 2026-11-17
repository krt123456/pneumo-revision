PNEUMO.fiche("grippe", {
  e: [
    "Grippe = virose **aiguë très contagieuse**, épidémique, due à **Myxovirus influenzae** ; bénigne en général, grave chez le sujet âgé et les malades cardiaques ou respiratoires.",
    "Virus **A et B** = épidémies saisonnières ; **seul le virus A** donne des **pandémies** (cassure antigénique). Sous-types selon **H** (hémagglutinine) et **N** (neuraminidase).",
    "Incubation **1 à 4 jours** (≈ 48 h) ; contagiosité **de la veille des signes à J7**. Début **brutal** : fièvre à 40 °C, myalgies, céphalées, toux sèche ; **V grippal** ; 5 à 7 jours.",
    "Diagnostic **clinique** en période d'épidémie ; biologie (RT-PCR, antigènes) seulement hors épidémie ou chez les fragiles.",
    "**Antiviral dans les 48 h** : oseltamivir (A et B), amantadine (A seulement). **Vaccin annuel** trivalent (2 A + 1 B), protection en 2 à 3 semaines."
  ],
  s: [
    ["Le virus et l'épidémiologie", "navy", [
      "Taux d'attaque annuel : **5 à 10 %** des adultes, **20 à 30 %** des enfants.",
      ["tab", ["Type", "Rôle", "À retenir"],
        ["A", "Épidémies saisonnières **et pandémies**", "Seul à avoir des **sous-types** (H1N1, H3N2…) ; origine aviaire des « cassures »"],
        ["B", "Épidémies saisonnières", "Pas de pandémie"]],
      ["cards", ["Glissement antigénique", "Petites mutations chaque année : le système immunitaire reconnaît moins bien le virus → **épidémies saisonnières** (et vaccin à refaire chaque année).", "blue"],
        ["Cassure antigénique", "Nouveau virus A (souvent venu des oiseaux) contre lequel personne n'est protégé → **pandémie**.", "red"]],
      ["ul", "**Réservoir** humain ; les oiseaux sont les hôtes d'origine des virus A.", "**Transmission** par **microgouttelettes** (parole, toux, éternuement), à partir des sécrétions des voies aériennes supérieures.", "Virus fragile : sensible aux désinfectants (eau de Javel, alcool à 70 %), à la chaleur et à la dessiccation (d'où les épidémies d'**hiver**).", "**Contagiosité** : de la **veille des symptômes jusqu'à J7**. **Incubation** : **1 à 4 jours**, 2 jours en moyenne."],
      ["pq", "L'**hémagglutinine** accroche le virus à la cellule ; la **neuraminidase** libère les nouveaux virions. C'est pour cela que les **anti-neuraminidases** (oseltamivir) bloquent la diffusion du virus."],
    ]],
    ["Clinique de la grippe commune", "blue", [
      ["steps", "**Incubation** brève (48 h en moyenne).", "**Début brutal** : malaise, frissons, **fièvre élevée d'emblée** (souvent 40 °C), douleurs diffuses intenses (céphalées, myalgies).", "**Phase d'état** : fièvre, tachycardie, asthénie profonde ; **catarrhe** (larmoiement, rhinorrhée, douleur pharyngée, dysphonie), brûlures rétrosternales, **toux sèche** douloureuse et insomniante.", "**Examen pauvre** : injection conjonctivale, rougeur pharyngée, langue saburrale, quelques râles bronchiques.", "**Évolution** en 5 à 7 jours ; la fièvre évolue en deux temps (**V grippal**) ; asthénie et toux peuvent durer plus d'une semaine."],
      ["ret", "Contraste typique : **beaucoup de symptômes, examen pauvre**. Chez l'**enfant**, signes digestifs plus fréquents."],
    ]],
    ["Grippe compliquée et grippe maligne", "red", [
      ["ul", "**Surinfection bactérienne** (sujets âgés, insuffisants respiratoires ou cardiaques, diabétiques) : **Haemophilus influenzae**, **pneumocoque**, **staphylocoque doré**. Signes : toux accentuée, **crachats purulents**, foyer de pneumonie, abcès, pleurésie purulente.",
        "**ORL** : otite, sinusite (surtout chez l'enfant).",
        "**Extra-respiratoires**, exceptionnels : myocardite, méningite, **syndrome de Guillain-Barré**, glomérulonéphrite aiguë."],
      ["pie", "La grippe maligne ne touche pas seulement les fragiles : elle s'observe aussi chez des **adultes jeunes en bonne santé**."],
      "**Grippe maligne** : après un début banal, **détresse respiratoire aiguë** (polypnée, cyanose, hypoxie) avec **poumon blanc bilatéral** (SDRA), puis défaillance cardiaque droite, cytolyse hépatique, insuffisance rénale. Souvent mortelle.",
    ]],
    ["Diagnostic", "teal", [
      "**Avant tout clinique**, surtout en période d'épidémie. La biologie n'est utile **qu'en dehors d'une épidémie ou chez un sujet fragile**.",
      ["tab", ["Méthode", "Exemple"],
        ["Directe", "Antigènes viraux dans les sécrétions naso-pharyngées (immunofluorescence, ELISA) ; **RT-PCR** (la plus sensible) ; culture cellulaire"],
        ["Indirecte (sérologie)", "Ascension des anticorps sur **2 prélèvements à 2 semaines d'intervalle** (fixation du complément, inhibition de l'hémagglutination) : diagnostic **rétrospectif**"]],
    ]],
    ["Traitement et prévention", "green", [
      ["tab", ["Antiviral", "Actif sur", "Condition"],
        ["Amantadine (Mantadix)", "Virus **A seulement**", "Dans les **48 h**"],
        ["Oseltamivir (Tamiflu), zanamivir (Relenza)", "Virus **A et B**", "Dans les **48 h** (anti-neuraminidases)"]],
      ["ul", "**Symptomatique** : repos, antipyrétiques, antalgiques, boissons, antitussifs.", "**Antibiotiques seulement en cas de surinfection bactérienne.**"],
      ["ret", "**Vaccin annuel**, trivalent (**2 souches A + 1 souche B**), **une seule injection**, protection en **2 à 3 semaines**."],
      ["ul", "**Prévention collective** en épidémie : éviter les malades, **masque chirurgical**, **lavage des mains** (savon ou solution hydroalcoolique), tousser dans un mouchoir à usage unique, aérer 10 minutes par jour, nettoyer poignées, téléphones, claviers."],
    ]],
    ["COVID-19 (SARS-CoV-2)", "purple", [
      "Apparue à **Wuhan** (Chine) en **décembre 2019** ; coronavirus du genre **Betacoronavirus**, différent du SARS-CoV-1 (SRAS 2003) et du MERS-CoV (Moyen-Orient, 2012). Transmission **interhumaine** (postillons, surfaces).",
      ["ul", "**Incubation : 2 à 14 jours.**", "**Sujets à risque** : âgés, HTA, diabète, maladie cardiovasculaire, cancer.", "**Signes** : fièvre (98,6 %), asthénie (69,6 %), toux sèche (59,4 %), anorexie (39,9 %), myalgies (34,8 %), dyspnée (31,2 %).", "**Biologie des formes sévères** : hypoxémie (PaO2 < 70 mmHg), **lymphopénie**, hyperleucocytose si surinfection, **D-dimères élevés** (chez les décédés), urée et créatinine en hausse.", "**Imagerie** : condensations bilatérales, aspect de SDRA ; au scanner **verre dépoli périphérique** ; aggravation possible à J7–J10.", "**Confirmation** : **RT-PCR** ; sérologie IgM/IgG.", "**Traitement** (selon le cours) : pas de traitement curatif spécifique ; symptomatique et assistance respiratoire ; mêmes mesures de prévention que la grippe."],
    ]],
    ["Bronchite aiguë", "orange", [
      "Inflammation de la muqueuse des **bronches et bronchioles**, **sans atteinte du parenchyme** (alvéoles), d'origine **virale dans 90 %** des cas ; environ **30 %** des infections respiratoires aiguës. Guérison en ≈ 15 jours.",
      ["ul", "**Phase sèche** : fébricule (rarement > 38 °C), toux sèche quinteuse, **brûlures rétrosternales**, souvent après une rhinopharyngite ; auscultation normale ou sibilants.", "**Phase humide** : toux productive ; chez l'adulte sain, des crachats purulents **ne signifient pas forcément** une surinfection (desquamation).", "**Examens inutiles** ; radio seulement si toux fébrile persistante ou si une pneumonie ne peut être éliminée (comorbidités, âge > 75 ans).", "**Traitement** : repos, arrêt du tabac, hydratation, paracétamol. **Pas d'antibiotique chez l'adulte sain** (sauf exacerbation de BPCO). **Déconseillés** : antitussifs, corticoïdes, AINS, mucolytiques."],
      ["ast", "**Toux qui dure plus de 3 semaines** chez l'adulte : penser à la **coqueluche** (et, en Algérie, toujours à la **tuberculose**)."],
    ]],
  ],
  p: [
    ["Les pandémies", "Les virus A et B peuvent donner des pandémies.", "Les virus A et B donnent les **épidémies saisonnières** ; **seul le virus A** donne des **pandémies**.", "Seul le virus A a des sous-types et un réservoir animal (oiseaux) : les **cassures** créent des virus nouveaux.", ""],
    ["Glissement ou cassure", "Le glissement antigénique explique les pandémies.", "**Glissement** = petites mutations → **épidémies saisonnières**. **Cassure** = nouveau virus → **pandémie**.", "Glisser, c'est changer un peu ; casser, c'est tout changer.", ""],
    ["Le délai de l'antiviral", "L'oseltamivir est efficace quel que soit le délai.", "Les antiviraux doivent être pris **dans les 48 h** après les premiers symptômes.", "Le virus se multiplie surtout les premiers jours.", ""],
    ["L'amantadine", "L'amantadine agit sur les virus A et B.", "L'amantadine agit **sur le virus A seulement** ; les anti-neuraminidases (oseltamivir, zanamivir) sur **A et B**.", "", ""],
    ["Le diagnostic biologique", "Toute grippe doit être confirmée par PCR.", "Le diagnostic est **clinique** en épidémie ; la biologie seulement **hors épidémie ou chez les fragiles**.", "", ""],
    ["La bronchite purulente", "Bronchite aiguë avec crachats purulents chez l'adulte sain → antibiotiques.", "**Pas d'antibiotique chez l'adulte sain** : la purulence traduit la desquamation, pas forcément une surinfection.", "90 % des bronchites aiguës sont virales.", ""],
    ["Le sujet jeune", "La grippe maligne ne touche que les sujets fragiles.", "Elle s'observe aussi chez des **adultes jeunes en bonne santé**.", "", ""],
  ],
  v: [
    ["Seul le virus influenza A est responsable de pandémies.", true, ""],
    ["La contagiosité de la grippe commence la veille des symptômes.", true, "Et persiste environ 7 jours."],
    ["L'incubation de la grippe est de 1 à 2 semaines.", false, "1 à 4 jours (≈ 48 h)."],
    ["L'oseltamivir est actif sur les virus A et B.", true, "C'est un inhibiteur de la neuraminidase."],
    ["Le vaccin antigrippal se fait une fois tous les 5 ans.", false, "Il est **annuel**."],
    ["La sérologie grippale permet un diagnostic rapide en urgence.", false, "Elle nécessite 2 prélèvements à 2 semaines d'intervalle : diagnostic rétrospectif."],
    ["L'incubation du COVID-19 va de 2 à 14 jours.", true, ""],
    ["Les antitussifs et les corticoïdes sont recommandés dans la bronchite aiguë.", false, "Non recommandés, voire délétères."],
  ],
  q: [
    ["Concernant le virus de la grippe :", ["Seul le type A possède des sous-types", "Les sous-types reposent sur l'hémagglutinine et la neuraminidase", "Le glissement antigénique explique les pandémies", "Le réservoir des formes humaines est l'homme", "Le virus résiste très bien à la chaleur"], "ABD", "Le glissement explique les épidémies saisonnières ; le virus est sensible à la chaleur."],
    ["Les germes de surinfection bactérienne de la grippe sont :", ["Haemophilus influenzae", "Streptococcus pneumoniae", "Staphylococcus aureus", "Mycobacterium tuberculosis", "Legionella pneumophila"], "ABC", ""],
    ["La vaccination antigrippale :", ["Est annuelle", "Contient 2 souches A et 1 souche B", "Nécessite 3 injections", "Protège en 2 à 3 semaines", "Est contre-indiquée chez le BPCO"], "ABD", "Une seule injection ; elle est au contraire recommandée chez le BPCO."],
  ],
  c: [
    ["Homme de 72 ans, insuffisant cardiaque, vu en janvier pour fièvre à 39,8 °C apparue brutalement il y a 24 h, myalgies, céphalées et toux sèche. Plusieurs cas dans la famille.", [
      ["Le diagnostic le plus probable :", ["Grippe saisonnière", "Bronchite aiguë bactérienne", "Tuberculose", "Pneumonie à légionelle", "Asthme"], "A", "Début brutal, épidémie familiale, hiver."],
      ["Quelles mesures sont justifiées ?", ["Oseltamivir car moins de 48 h et sujet à risque", "Antibiotique systématique", "Paracétamol et hydratation", "Surveiller une surinfection bactérienne", "Sérologie grippale pour décider du traitement"], "ACD", "Antibiotique seulement si surinfection ; la sérologie est rétrospective."],
      ["Au 5e jour : crachats purulents et foyer de crépitants à droite. On évoque :", ["Une surinfection bactérienne", "Un pneumocoque, un staphylocoque ou Haemophilus", "Une évolution normale de la grippe", "Une indication d'antibiothérapie", "Une méningite"], "ABD", ""],
    ]],
  ],
});
