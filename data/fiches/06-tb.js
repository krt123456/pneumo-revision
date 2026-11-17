PNEUMO.fiche("tb-commune", {
  e: [
    "Tuberculose pulmonaire commune = infection du parenchyme par le **bacille de Koch** (BAAR, aérobie strict), transmise **par voie aérienne** ; les **TPM+** sont les plus contagieux.",
    "Clinique **non spécifique**, début **insidieux** : asthénie, amaigrissement, **fébricule vespéral** et **sueurs nocturnes**, **toux > 15 jours**, parfois hémoptysie. Pas d'amélioration après 2–3 semaines de traitement usuel → **penser TB**.",
    "Radio : lésions des **sommets** : **nodules**, **infiltrats** non systématisés, **cavernes** (image en **raquette**).",
    "Certitude **bactériologique** : BK dans les crachats **3 matins de suite, à jeun** (tubage gastrique si pas de crachats), **Ziehl-Neelsen** (rouge) ou auramine ; culture **Löwenstein-Jensen** (28 à 42 jours).",
    "Anapath : **follicule de Köster** = granulome épithélioïde et gigantocellulaire **avec nécrose caséeuse**. Cas : **TPM+** (microscopie positive) ou **TPM− C+**."
  ],
  s: [
    ["Définition et transmission", "navy", [
      "Infection du parenchyme pulmonaire par **Mycobacterium tuberculosis** (bacille de Koch). Transmission **interhumaine par voie aérienne** (gouttelettes émises en toussant). Les malades à **microscopie positive (TPM+)** sont les plus contagieux.",
      ["cards", ["Complication précoce", "D'une primo-infection tuberculeuse.", "blue"], ["Réinfection exogène", "Apport massif de BK (contage intense).", "orange"], ["Réactivation endogène", "Reviviscence de BK quiescents (le plus fréquent chez l'adulte).", "red"]],
      ["ul", "**Facteurs de risque** : pauvreté, habitat précaire, **diabète**, **alcoolisme**, toxicomanie, malnutrition, gastrectomie, **immunodépression** (VIH, cancers, immunosuppresseurs, anti-TNF), insuffisance respiratoire chronique, **personnel soignant**."],
    ]],
    ["Le germe et l'anatomie pathologique", "purple", [
      ["ul", "**Mycobacterium tuberculosis** : bacille **acido-alcoolo-résistant (BAAR)**, **aérobie strict** (d'où les sommets, mieux ventilés), à croissance lente.", "**Examen direct** : coloration de **Ziehl-Neelsen** (bacilles **rouges**) ou **auramine** (bacilles jaunes fluorescents, plus rapide).", "**Culture** sur **Löwenstein-Jensen** : lecture à **28, 42 (et 72) jours** ; **antibiogramme** si contact avec un cas résistant."],
      ["ret", "**Follicule de Köster** : granulome **épithélioïde et gigantocellulaire avec nécrose caséeuse centrale**. **Sans** nécrose caséeuse → penser **sarcoïdose**."],
    ]],
    ["Clinique", "blue", [
      ["ul", "**Aucun signe pathognomonique.**", "**Début insidieux** (le plus fréquent) : asthénie, **anorexie, amaigrissement**, **fébricule vespéral** (37,5–38 °C le soir) avec **sueurs nocturnes** ; **toux durable (> 15 jours)**, parfois **hémoptysie**.", "**Début bruyant** : aspect bronchique ou **pseudo-pneumonique** (avec laryngite).", "**Autres révélations** : hémoptysie, pleurésie, pneumothorax.", "**Latence** : découverte fortuite (radio d'embauche, dépistage autour d'un cas)."],
      ["pie", "« Pneumonie » qui **ne guérit pas après 2–3 semaines** d'antibiotiques usuels → **penser tuberculose** et chercher les BK."],
    ]],
    ["Radiographie", "teal", [
      ["fig", "tb-caverne", "Lésions des sommets : caverne + nodules et infiltrats."],
      ["tab", ["Lésion", "Aspect"],
        ["**Nodule**", "Sommet, < 1 cm (micro- ou macronodule), arrondi, dense, contours flous, ± calcifications (mieux vues au scanner)"],
        ["**Infiltrat**", "Confluence de nodules ; **disséminé, non systématisé**, hétérogène, flou (≠ pneumonie systématisée)"],
        ["**Caverne**", "Clarté entourée d'une ligne opaque, reliée à la **bronche de drainage** : image en **raquette**"],
        ["Aspect pneumonique", "**Pneumonie caséeuse**"],
        ["Séquelles", "Fibrose, DDB, **tuberculome** (nodule calcifié à limites nettes), adénopathies médiastinales calcifiées, pachypleurite"]],
      ["pq", "Les **sommets** sont les zones les mieux oxygénées : le BK, **aérobie strict**, s'y plaît."],
    ]],
    ["Diagnostic de certitude", "green", [
      ["steps", "**Au moins 2 échantillons** d'expectoration, dont un **le matin à jeun** ; en pratique **3 jours de suite** chez le cracheur.",
        "Pas de crachats : **tubage gastrique le matin à jeun**, 3 jours de suite (les BAAR résistent à l'acidité de l'estomac).",
        "Lésions minimes non excavées ou 3 directs négatifs : **fibroaspiration bronchique** (et expectoration 24 h après).",
        "**Demander spécifiquement la recherche de BAAR** : un ECBC standard ne la fait pas.",
        "**Culture** (28–72 jours) et antibiogramme si contage résistant."],
      ["crs", "Si **3 examens directs négatifs** et pas de culture disponible : antibiotique **non spécifique pendant 10 jours**, réévaluer à 15 jours ; si les signes et les images persistent, refaire **3 BK** puis décider. (Éviter les fluoroquinolones, actives sur le BK, qui masqueraient le diagnostic.)"],
      ["tab", ["Définition du cas", "Signification"],
        ["**TPM+**", "Tuberculose pulmonaire à **microscopie positive** : la plus contagieuse"],
        ["**TPM− C+**", "Microscopie négative, **culture positive**"]],
      "**Biologie** : peu d'intérêt (VS accélérée, lymphocytose, leuconeutropénie).",
    ]],
  ],
  p: [
    ["L'ECBC", "Un ECBC standard suffit pour chercher le BK.", "Il faut **demander spécifiquement la recherche de BAAR** (Ziehl ou auramine) et la culture des mycobactéries.", "Le BK ne se voit pas à la coloration de Gram.", ""],
    ["Le nombre de prélèvements", "Un seul crachat négatif élimine la tuberculose.", "**3 prélèvements** (au moins 2, dont un le matin à jeun) ; tubage gastrique si pas de crachats.", "L'excrétion de bacilles est irrégulière.", ""],
    ["Granulome et sarcoïdose", "Tout granulome épithélioïde est tuberculeux.", "Tuberculose = granulome **avec nécrose caséeuse** (follicule de Köster) ; **sans nécrose** = sarcoïdose (entre autres).", "", ""],
    ["Le siège", "La tuberculose commune touche surtout les bases.", "Elle touche surtout les **sommets** (segments apicaux et postérieurs).", "Le BK est aérobie strict.", ""],
    ["Infiltrat ou pneumonie", "Un infiltrat tuberculeux est systématisé comme une pneumonie.", "L'infiltrat est **disséminé, non systématisé**, hétérogène.", "", ""],
    ["Les fluoroquinolones", "Devant une suspicion de TB, une fluoroquinolone est un bon antibiotique d'attente.", "Les fluoroquinolones sont **actives sur le BK** : elles masquent le diagnostic et sélectionnent des résistances.", "", ""],
  ],
  v: [
    ["Mycobacterium tuberculosis est un bacille aérobie strict.", true, ""],
    ["Le fébricule tuberculeux est typiquement matinal.", false, "Il est **vespéral** (le soir), avec sueurs nocturnes."],
    ["La coloration de Ziehl-Neelsen colore les BAAR en rouge.", true, ""],
    ["La culture sur Löwenstein-Jensen donne un résultat en 48 heures.", false, "28 à 42 jours (jusqu'à 72)."],
    ["Le follicule de Köster comporte une nécrose caséeuse.", true, ""],
    ["L'image en raquette associe une caverne et sa bronche de drainage.", true, ""],
    ["Les tuberculeux à microscopie positive sont les plus contagieux.", true, ""],
  ],
  q: [
    ["Concernant le diagnostic de la tuberculose pulmonaire commune :", ["Les crachats sont recueillis le matin, 3 jours de suite", "Le tubage gastrique se fait le matin à jeun", "Un ECBC standard recherche automatiquement les BAAR", "La culture se fait sur Löwenstein-Jensen", "La certitude est bactériologique"], "ABDE", ""],
    ["Facteurs de risque de tuberculose :", ["Diabète", "Infection VIH", "Traitement anti-TNF", "Gastrectomie", "Hypertension artérielle"], "ABCD", ""],
    ["Aspects radiologiques de la tuberculose commune :", ["Nodules des sommets", "Infiltrat non systématisé", "Caverne avec bronche de drainage", "Opacité systématisée avec bronchogramme du lobe moyen", "Tuberculome calcifié en séquelle"], "ABCE", ""],
  ],
  c: [
    ["Homme de 35 ans, chômeur, vivant dans un logement exigu. Toux depuis 6 semaines, amaigrissement de 7 kg, sueurs nocturnes. Un traitement par amoxicilline n'a rien changé. Radio : nodules et infiltrat du sommet droit avec une clarté arrondie.", [
      ["Le diagnostic à évoquer en premier :", ["Tuberculose pulmonaire commune", "PFLA", "Bronchite aiguë", "Asthme", "Pneumothorax"], "A", ""],
      ["Examens de certitude :", ["Recherche de BAAR dans les crachats 3 jours de suite", "Culture sur Löwenstein-Jensen", "IDR à la tuberculine", "Hémogramme", "Tubage gastrique s'il ne crache pas"], "ABE", "L'IDR ne prouve pas la maladie."],
      ["Les BAAR sont positifs à l'examen direct. Il s'agit :", ["D'une TPM+", "D'un cas contagieux", "D'une TPM− C+", "D'un cas à déclarer et à traiter", "D'une infection tuberculeuse latente"], "ABD", ""],
    ]],
  ],
});

PNEUMO.fiche("tb-extra", {
  e: [
    "Tuberculose extra-pulmonaire = localisations **hors du poumon** ; elles **ne sont pas contagieuses**. La forme **ganglionnaire** est la plus fréquente.",
    "Diagnostic : **cas présumés** (arguments de présomption) ou **cas prouvés** (BK en culture, **follicule caséeux**, frottis de pus caséeux).",
    "Présomption : tableau compatible, **lymphocytose** dans les liquides, granulome, **IDR > 10 mm**, autres causes éliminées.",
    "**Formes sévères** : miliaire, méningite, péricardite, **mal de Pott**, tuberculose rénale. **Formes communes** : pleurale, ganglionnaire, osseuse (hors rachis), péritonéale, intestinale, cutanée.",
    "Méningite TB : LCR **lymphocytaire**, protéines **> 1 g/L**, glucose **< 0,4 g/L**. Miliaire : micronodules diffus, chercher la méningite."
  ],
  s: [
    ["Définition et enjeux", "navy", [
      "Localisations de la tuberculose **situées hors du poumon**, conséquence précoce ou tardive de la **primo-infection** (dissémination). Elles **ne sont pas des sources d'infection**.",
      ["ul", "Fréquence **en progression** ; la forme **ganglionnaire** est la plus fréquente.", "Problèmes **diagnostiques** (organes difficiles d'accès : os, viscères) et **thérapeutiques** (ex. ganglions)."],
    ]],
    ["Cas présumés, cas prouvés", "purple", [
      ["tab", ["Cas présumé (forte probabilité)", "Cas prouvé (au moins 1 critère)"],
        ["Tableau **clinique et radiologique compatible** (contexte, infection subaiguë ou chronique, imagerie selon l'organe)", "**BK en culture** d'un prélèvement pathologique (liquide ou solide)"],
        ["**Inflammation chronique** : **lymphocytose** durable des liquides (plèvre, ascite, péricarde, LCR) ; granulome sans caséification à la biopsie", "**Follicule caséeux** à l'histologie"],
        ["**IDR > 10 mm**", "Frottis de **pus caséeux** (hématéine-éosine : nappe éosinophile anhiste)"],
        ["**Autres causes éliminées**", ""]],
      ["tab", ["Localisation", "Prélèvement", "Recherche"],
        ["Ganglionnaire", "Ponction-aspiration, biopsie", "BK (direct, culture), histologie"],
        ["Pleurale", "Ponction et **biopsie pleurale**", "Culture du liquide et du fragment, histologie"],
        ["Méningée", "**Ponction lombaire**", "BK, cytologie et biochimie du LCR"],
        ["Rénale", "**3 culots urinaires** (3 jours de suite)", "BK direct et culture"],
        ["Abcès froid, ascite", "Ponction", "BK direct et culture"],
        ["Peau, muqueuses", "Biopsie", "Culture du fragment, histologie"]],
    ]],
    ["Classement selon la gravité", "red", [
      ["cards", ["Formes sévères", "**Miliaire**, **méningite**, méningo-miliaire, **péricardite**, **vertébrale (mal de Pott)**, **rénale**.", "red"], ["Formes communes", "Pleurale, **ganglionnaire**, osseuse et ostéo-articulaire (rachis exclu), péritonéale ascitique, intestinale, autres viscères, peau et muqueuses.", "green"]],
      ["ret", "Ce classement a surtout un **intérêt thérapeutique** : les formes sévères (méningée, vertébrale) sont traitées **plus longtemps (12 mois)**."],
    ]],
    ["Formes à connaître", "orange", [
      ["fig", "miliaire", "Miliaire : micronodules de 1 à 3 mm, diffus, bilatéraux."],
      ["ul", "**Miliaire** : dissémination sanguine ; fièvre, altération rapide, dyspnée ; micronodules « grains de mil » ; tubercules choroïdiens au **fond d'œil** ; prélèvements respiratoires + **hémocultures mycobactéries**, ECBU, myéloculture si cytopénie ; **toujours chercher une méningite** (ponction lombaire).",
        "**Méningite tuberculeuse** : LCR clair, **lymphocytaire**, **hyperprotéinorachie > 1 g/L**, **hypoglycorachie < 0,4 g/L**.",
        "**Pleurésie tuberculeuse** : exsudat **citrin, lymphocytaire** ; diagnostic par **biopsie pleurale** (granulome caséeux) et culture.",
        "**Ganglionnaire** : adénopathies cervicales, fistulisation possible (écrouelles) ; ponction ou biopsie-exérèse.",
        "**Mal de Pott** : spondylodiscite tuberculeuse, abcès froid, risque de compression médullaire."],
    ]],
  ],
  p: [
    ["La contagiosité", "Une tuberculose ganglionnaire est contagieuse comme une TPM+.", "Les formes extra-pulmonaires **ne sont pas contagieuses** (sauf atteinte pulmonaire associée).", "Le BK n'est pas expectoré.", ""],
    ["La forme la plus fréquente", "La forme extra-pulmonaire la plus fréquente est la pleurésie.", "C'est la forme **ganglionnaire**.", "", ""],
    ["Le LCR", "Une méningite tuberculeuse a un LCR à polynucléaires avec glycorachie normale.", "LCR **lymphocytaire**, protéines **> 1 g/L**, glucose **< 0,4 g/L**.", "", ""],
    ["La miliaire", "Une miliaire se résume à l'atteinte pulmonaire.", "C'est une **dissémination** : chercher la **méningite** (PL), le fond d'œil, les autres localisations.", "", ""],
    ["Le mal de Pott", "Le rachis fait partie des formes osseuses communes.", "La tuberculose **vertébrale** est une **forme sévère** (traitement de 12 mois).", "", ""],
  ],
  v: [
    ["Les localisations extra-pulmonaires ne contribuent pas à la transmission.", true, ""],
    ["Une IDR supérieure à 10 mm est un argument de présomption.", true, ""],
    ["La méningite tuberculeuse est une forme commune.", false, "C'est une forme **sévère**."],
    ["Le follicule caséeux prouve la tuberculose extra-pulmonaire.", true, ""],
    ["La tuberculose rénale se cherche sur 3 culots urinaires.", true, ""],
  ],
  q: [
    ["Formes sévères de tuberculose extra-pulmonaire :", ["Miliaire", "Méningite", "Péricardite", "Mal de Pott", "Adénopathie cervicale isolée"], "ABCD", ""],
    ["LCR d'une méningite tuberculeuse :", ["Lymphocytaire", "Protéines > 1 g/L", "Glucose < 0,4 g/L", "Polynucléaires altérés majoritaires", "Liquide trouble purulent"], "ABC", ""],
  ],
});

PNEUMO.fiche("tb-traitement", {
  e: [
    "Antituberculeux de 1re ligne : **H** isoniazide 5 mg/kg, **R** rifampicine 10 mg/kg, **Z** pyrazinamide 25 mg/kg, **E** éthambutol 15 mg/kg, **S** streptomycine 15 mg/kg IM.",
    "**Nouveau cas : 2 RHZE / 4 RH = 6 mois.** TEP simple : 2 RHZ / 4 RH. Rechute : 2 SHRZE / 1 HRZE / 5 HRE (8 mois). **Méningée ou vertébrale : 12 mois** (2 RHZE / 10 RH).",
    "Effets majeurs : **hépatite (H, R, Z)**, **névrite optique (E)**, **surdité (S)**. Mineurs : paresthésies (H → **vitamine B6**), arthralgies (Z), troubles digestifs (R).",
    "**Rifampicine** : urines orange ; **interactions** majeures (contraceptifs oraux, AVK, antidiabétiques oraux, corticoïdes).",
    "**Prise supervisée** pendant la phase initiale (2 premiers mois) ; contrôles des crachats en cours et en fin de traitement ; déclaration et enquête autour du cas."
  ],
  s: [
    ["Avant de commencer", "navy", [
      ["crs", "Ton fichier « 6-Traitement de la TBC.pptx » est **vide** (0 octet) : cette fiche s'appuie sur ta « Révision totale » et sur le programme national. **Retélécharge le cours** et vérifie les détails (seuils, contrôles)."],
      ["ul", "**Buts** : guérir le malade, **rendre le malade non contagieux**, éviter les rechutes et les **résistances**.", "**Principes** : association d'antibiotiques (jamais de monothérapie), **durée suffisante**, prise **quotidienne, le matin à jeun**, **régularité** (observance), **gratuité** dans le programme national."],
    ]],
    ["Les médicaments", "purple", [
      ["tab", ["Lettre", "Médicament", "Dose", "Effets à retenir"],
        ["**H**", "Isoniazide", "5 mg/kg/j", "**Hépatite** ; neuropathie périphérique, paresthésies → **vitamine B6**"],
        ["**R**", "Rifampicine", "10 mg/kg/j", "**Hépatite** ; urines et larmes **orange** ; troubles digestifs ; **interactions** (inducteur enzymatique)"],
        ["**Z**", "Pyrazinamide", "25 mg/kg/j", "**Hépatite** ; **arthralgies** (hyperuricémie)"],
        ["**E**", "Éthambutol", "15 mg/kg/j", "**Névrite optique** rétrobulbaire (acuité, vision des couleurs)"],
        ["**S**", "Streptomycine", "15 mg/kg/j IM", "**Surdité**, vertiges (toxicité cochléo-vestibulaire), rein"]],
      ["ast", "« **HRZ** abîment le foie, **E** les **yeux** (E comme « Eye »), **S** l'oreille (S comme « Sourd ») »."],
    ]],
    ["Les régimes", "green", [
      ["svg", "tbtl", "Nouveau cas : 2 mois de phase intensive (RHZE), puis 4 mois de continuation (RH)."],
      ["tab", ["Situation", "Régime", "Durée"],
        ["**Nouveau cas** de tuberculose pulmonaire", "**2 RHZE / 4 RH**", "**6 mois**"],
        ["Tuberculose extra-pulmonaire simple", "2 RHZ / 4 RH", "6 mois"],
        ["**Rechute** (retraitement)", "2 SHRZE / 1 HRZE / 5 HRE", "8 mois"],
        ["**Méningée** ou **vertébrale**", "2 RHZE / 10 RH", "**12 mois**"]],
      ["pq", "La **phase intensive** (4 antibiotiques) tue vite la masse de bacilles et évite de sélectionner des mutants résistants ; la **phase de continuation** stérilise les bacilles qui persistent."],
    ]],
    ["Surveillance", "teal", [
      ["ul", "**Clinique** : poids, signes, **observance**, tolérance.", "**Bactériologique** : crachats (examen direct) **en fin de phase intensive** et **en fin de traitement** pour juger la guérison.", "**Biologique** : transaminases (surtout si alcool, hépatopathie, signes digestifs, ictère).", "**Ophtalmologique** sous éthambutol (acuité visuelle, vision des couleurs).", "**Interactions** de la rifampicine : contraception orale moins efficace (contraception non hormonale), AVK, antidiabétiques oraux, corticoïdes à adapter."],
      ["pie", "**Hépatite médicamenteuse** (ictère, cytolyse importante) : **arrêter** les antituberculeux, puis les **réintroduire progressivement** sous surveillance (vérifie les seuils exacts dans ton cours)."],
      ["ret", "**Prise supervisée** (le malade prend ses comprimés devant un soignant) pendant les **2 premiers mois** : c'est la meilleure arme contre l'échec et les résistances."],
    ]],
  ],
  p: [
    ["La durée standard", "Un nouveau cas de tuberculose pulmonaire se traite 9 mois.", "**2 RHZE / 4 RH = 6 mois.**", "", ""],
    ["L'éthambutol", "L'éthambutol se surveille par l'audiogramme.", "**Éthambutol → névrite optique** : surveiller la vision. La surdité, c'est la **streptomycine**.", "", ""],
    ["La rifampicine et la pilule", "La rifampicine n'a pas d'interaction notable.", "Inducteur enzymatique puissant : baisse d'efficacité des **contraceptifs oraux**, **AVK**, antidiabétiques oraux, corticoïdes.", "", ""],
    ["Les paresthésies", "Les paresthésies sous traitement imposent l'arrêt de l'isoniazide.", "Elles se préviennent et se traitent par la **vitamine B6**.", "", ""],
    ["Les formes graves", "Une méningite tuberculeuse se traite 6 mois comme une TPM+.", "Méningée et vertébrale : **12 mois** (2 RHZE / 10 RH).", "", ""],
    ["Les urines orange", "Des urines orange sous traitement signent une hépatite.", "C'est la **coloration normale** due à la rifampicine : prévenir le patient.", "", ""],
  ],
  v: [
    ["Le régime d'un nouveau cas est 2 RHZE / 4 RH.", true, ""],
    ["Le pyrazinamide peut donner des arthralgies.", true, "Par hyperuricémie."],
    ["La streptomycine est toxique pour l'oreille.", true, ""],
    ["L'isoniazide est le seul antituberculeux hépatotoxique.", false, "H, R et Z sont hépatotoxiques."],
    ["La tuberculose vertébrale se traite 12 mois.", true, ""],
    ["La phase intensive dure 4 mois.", false, "2 mois."],
  ],
  q: [
    ["Effets indésirables et médicaments correspondants :", ["Névrite optique : éthambutol", "Surdité : streptomycine", "Arthralgies : pyrazinamide", "Paresthésies : isoniazide", "Urines orange : éthambutol"], "ABCD", "Urines orange : rifampicine."],
    ["Interactions de la rifampicine :", ["Contraceptifs oraux", "AVK", "Antidiabétiques oraux", "Corticoïdes", "Vitamine B6"], "ABCD", ""],
  ],
  c: [
    ["Femme de 28 ans, sous contraception orale, TPM+ nouveau cas, 55 kg.", [
      ["Le régime :", ["2 RHZE / 4 RH", "2 SHRZE / 1 HRZE / 5 HRE", "2 RHZE / 10 RH", "Isoniazide seul 6 mois", "Rifampicine + isoniazide 3 mois"], "A", ""],
      ["Conseils à donner :", ["Changer pour une contraception non hormonale", "Urines orange sans gravité", "Signaler une baisse de vision", "Prendre les comprimés le matin à jeun", "Arrêter le traitement dès que la toux disparaît"], "ABCD", "Le traitement se poursuit 6 mois."],
    ]],
  ],
});

PNEUMO.fiche("tb-prevention", {
  e: [
    "Histoire naturelle : **contamination aérienne** → **primo-infection** (le plus souvent latente = **ITL**) → **tuberculose-maladie** chez **10 %**, surtout dans les **2 premières années**.",
    "**BCG** à la naissance pour **tout enfant**, et de 0 à 14 ans sans cicatrice vaccinale, **sans IDR préalable**.",
    "Contacts d'un TPM+ : enfant **< 5 ans** → **traitement préventif sans test** ; **> 5 ans** → tester, traiter si positif. **VIH** → traitement préventif **sans test**.",
    "Dépistage ITL : **IDR** (5 UI de tuberculine, lecture à **72 h**, induration en mm) : **≥ 15 mm = ITL**, **< 5 mm = pas d'ITL**, **5–14 mm → IGRA**.",
    "Traitement de l'ITL : **rifampicine + isoniazide 3 mois** ; si hépatite ou VIH sous antirétroviraux : **isoniazide seul 6 mois**."
  ],
  s: [
    ["Histoire naturelle", "navy", [
      ["steps", "**Contamination** par voie aérienne à partir d'un malade **bacillifère** (gouttelettes de toux). Le risque augmente avec la toux, la **contagiosité** (BAAR au direct, cavernes) et la **durée d'exposition**.",
        "**Primo-infection** : le plus souvent **asymptomatique** = **infection tuberculeuse latente (ITL)** ; granulomes avec quelques bacilles quiescents. Parfois **patente** : altération de l'état général, **érythème noueux**, kérato-conjonctivite phlycténulaire, adénopathies médiastinales (chancre d'inoculation).",
        "**Tuberculose-maladie** chez **10 %** des primo-infectés, le plus souvent **dans les 2 ans** : pulmonaire (75 %) ou extra-pulmonaire."],
      ["ul", "**Favorisent la maladie** : **immunodépression** (VIH +++, cancers, immunosuppresseurs, anti-TNF), âges extrêmes, **diabète**, insuffisance rénale, malnutrition, alcool, tabac, précarité, toxicomanie."],
    ]],
    ["La vaccination BCG", "green", [
      ["ul", "**Tout enfant à la naissance.**", "**Tous les enfants de 0 à 14 ans** sans cicatrice vaccinale.", "**Toujours sans IDR préalable.**"],
      ["pq", "Le BCG protège surtout l'**enfant** contre les formes **graves** (miliaire, méningite) ; il protège peu contre la tuberculose pulmonaire de l'adulte."],
    ]],
    ["L'enquête autour d'un cas", "orange", [
      ["tab", ["Sujet contact (même toit qu'un TPM+)", "Conduite"],
        ["Enfant **< 5 ans** (sans tuberculose active)", "**Traitement préventif systématique, sans test**"],
        ["Enfant > 5 ans, adolescent", "**Tester** (IDR / IGRA), **traiter si positif**"],
        ["Contact **VIH**, quel que soit l'âge", "**Traitement préventif sans test**"],
        ["Contact > 14 ans **avec signes ou radio anormale**", "**3 à 6 BK** à l'examen direct ; si positifs → traitement ; si négatifs → culture"],
        ["Contact > 14 ans **sans signe**", "**Revoir à 2 mois** (ou avant si des signes apparaissent)"],
        ["Personnel de santé", "Médecine du travail"]],
      ["ret", "Toujours **éliminer une tuberculose active** (clinique, radio, BK) **avant** de traiter une ITL : sinon on donnerait une bithérapie à une maladie qui en demande quatre."],
    ]],
    ["L'infection tuberculeuse latente (ITL)", "purple", [
      "Réponse immunitaire persistante aux antigènes de M. tuberculosis **sans signe de tuberculose active**. Risque de réactivation : **5 à 10 % sur toute la vie**, surtout les **2 premières années**. Environ **un quart de la population mondiale** est infecté.",
      ["ul", "**À dépister et traiter** : contacts domestiques (selon l'âge), **VIH**, candidats aux **anti-TNF** ou biothérapies, **dialysés**, **greffés**, **silicose**."],
      ["tab", ["Test", "Comment", "Intérêt"],
        ["**IDR à la tuberculine**", "**5 UI** de PPD (0,1 mL) en intradermique, **lecture à 72 h** : diamètre transversal de l'**induration** (pas la rougeur)", "Simple ; faussé par le BCG"],
        ["**IGRA** (QuantiFERON, T-SPOT)", "Prise de sang : interféron gamma après stimulation par des antigènes du BK", "**Ne croise pas** avec le BCG ni avec les mycobactéries atypiques"]],
      ["steps", "Faire une **IDR**.", "**≥ 15 mm** → ITL retenue → **traitement préventif** chez les personnes à risque.", "**< 5 mm** → ITL écartée (sauf corticoïdes ou immunosuppresseurs antérieurs → **IGRA**).", "**5 à 14 mm** → **IGRA** pour confirmer ou écarter."],
      ["tab", ["Traitement de l'ITL", "Quand"],
        ["**Rifampicine + isoniazide, 3 mois**", "**1re intention**"],
        ["**Isoniazide seul, 6 mois**", "Antécédent ou risque d'**hépatite** ; **VIH sous antirétroviraux** (interactions de la rifampicine)"],
        ["Dose d'isoniazide", "**10 mg/kg chez l'enfant**, **5 mg/kg chez l'adulte**"]],
    ]],
  ],
  p: [
    ["L'IDR avant le BCG", "On fait une IDR avant de vacciner un enfant par le BCG.", "Le BCG se fait **sans IDR préalable**.", "", ""],
    ["L'enfant de moins de 5 ans", "Un enfant de 3 ans contact d'un TPM+ doit d'abord avoir une IDR.", "**Traitement préventif systématique sans test** (après avoir éliminé une tuberculose active).", "Le risque de forme grave est très élevé chez le petit enfant.", ""],
    ["La lecture de l'IDR", "On mesure la rougeur à 48 h.", "On mesure l'**induration** (diamètre transversal) **à 72 h**.", "", ""],
    ["L'IGRA et le BCG", "Le QuantiFERON est faussement positif après BCG.", "L'IGRA **ne croise pas** avec le BCG ni les mycobactéries atypiques.", "", ""],
    ["Le régime de l'ITL", "Une ITL se traite par 2 RHZE / 4 RH.", "**RH 3 mois** en 1re intention ; **H 6 mois** si hépatite ou VIH sous antirétroviraux.", "L'ITL contient peu de bacilles : pas besoin de quadrithérapie.", ""],
  ],
  v: [
    ["Environ 10 % des primo-infectés développent une tuberculose-maladie.", true, "Surtout dans les 2 premières années."],
    ["Le BCG est fait à la naissance sans IDR préalable.", true, ""],
    ["Une IDR entre 5 et 14 mm impose un test IGRA.", true, ""],
    ["Le traitement de première intention de l'ITL est l'isoniazide seul 9 mois.", false, "Rifampicine + isoniazide 3 mois."],
    ["Un contact VIH doit recevoir un traitement préventif sans test préalable.", true, ""],
  ],
  q: [
    ["Populations à dépister et traiter pour une ITL :", ["Candidats aux anti-TNF", "Dialysés", "Patients atteints de silicose", "Candidats à une greffe", "Asthmatiques sous bêta-2 de courte durée"], "ABCD", ""],
    ["IDR à 8 mm chez un adulte contact :", ["Faire un IGRA", "Conclure à une ITL certaine", "Écarter l'ITL", "Éliminer d'abord une tuberculose active", "Commencer 2 RHZE / 4 RH"], "AD", ""],
  ],
  c: [
    ["Un père de famille est TPM+. Ses enfants ont 3 ans et 9 ans, sans aucun signe, radios normales.", [
      ["Pour l'enfant de 3 ans :", ["Traitement préventif sans test", "IDR d'abord", "Rien, revoir dans 2 mois", "2 RHZE / 4 RH", "Rifampicine + isoniazide 3 mois"], "AE", ""],
      ["Pour l'enfant de 9 ans :", ["Tester (IDR ± IGRA)", "Traiter si le test est positif", "Traitement préventif sans test", "BCG de rappel", "Rien à faire"], "AB", ""],
    ]],
  ],
});
