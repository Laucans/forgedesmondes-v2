Feature: Rules imported from v1
  One scenario per rule of the v1 rules.json; free steps await the vocabulary.

  # Le DM voit ses campagnes et oneshots avec leur illustration de couverture et en crée de nouveaux. Un oneshot est une campagne à une seule séance, et plusieurs campagnes indépendantes coexistent sans compte utilisateur.
  @R1 @business @page:campagnes @component:CampaignList @el:campaign-list
  Scenario: Plusieurs campagnes et oneshots
    Given deux campagnes et un oneshot
    When le DM ouvre l'accueil
    Then les trois apparaissent avec leur couverture, le oneshot n'a qu'une séance, et aucun compte n'est demandé.

  # Une campagne s'exporte en une archive et une archive s'importe, en copie si la campagne existe déjà. Il n'y a pas de sauvegarde automatique, et la date du dernier export est rappelée.
  @R2 @business @page:campagnes @page:campagne @component:CampaignList @component:CampaignOverview @el:campaign-list @el:campaign-overview
  Scenario: Export et import d'une campagne en archive
    Given une campagne exportée puis importée alors qu'elle existe déjà
    When l'import se termine
    Then une copie distincte est créée, l'originale reste intacte et la date du dernier export est affichée.

  # Le DM choisit entre deux modes de connexion au fournisseur de génération. En mode « API », il saisit l'URL de l'API, qu'il s'agisse d'une API cloud ou de son serveur maison. Le système détecte seul le type d'API et s'y connecte, et le DM complète le modèle de génération, le modèle de résumé et une clé éventuelle. En mode « Binaire », il choisit dans une liste déroulante l'un des deux binaires proposés pour le moment : opencode ou Claude Code. Dans les deux modes, un bouton « Tester la connexion » vérifie le réglage. Un rappel indique que seul du texte part vers ce fournisseur.
  @R3 @journey @page:parametres-ia @component:AiSettings @el:ai-settings
  Scenario: Fournisseur de génération paramétrable : API ou binaire
    Given l'écran des paramètres IA, d'abord en mode « API » avec l'URL du serveur maison saisie, puis en mode « Binaire »
    When le DM teste la connexion en mode « API », puis passe en mode « Binaire », ouvre la liste déroulante, choisit « Claude Code » et teste à nouveau la connexion
    Then le type d'API détecté et le résultat du premier test s'affichent, la liste déroulante propose exactement « opencode » et « Claude Code », le résultat du second test s'affiche, et le rappel « seul du texte part vers ce fournisseur » reste visible

  # L'application conserve les joueurs, les personnages, les lieux et les événements d'une campagne, et les présente par onglets. Un personnage est un PJ lié à un joueur ou un PNJ, avec une fiche simple (caractéristiques, CA, PV, sorts et actions), un token et des notes.
  @R4 @business @page:campagne @page:fiche-entite @component:CampaignElements @component:EntityEditor @el:campaign-elements @el:entity-editor
  Scenario: Joueurs et personnages distincts
    Given un PJ lié à un joueur et un PNJ
    When le DM ouvre les onglets de la campagne
    Then chacun apparaît dans le bon onglet avec sa fiche (caractéristiques, CA, PV, sorts, actions), son token et ses notes.

  # Le DM colle des notes en texte libre, éventuellement issues d'une transcription faite dans l'outil, et l'IA en extrait des personnages, des lieux et des événements. Rien n'est créé avant que le DM ait validé la liste proposée.
  @R5 @business @page:campagne @component:NoteImport @el:note-import
  Scenario: Reprise depuis des notes en texte libre
    Given des notes collées
    When l'IA propose personnages, lieux et événements
    Then aucune entité n'est créée tant que le DM n'a pas validé la liste, et seules les entités validées le sont.

  # Chaque entité peut recevoir des alias, par exemple « la taverne » pour « La Taverne du Sanglier ». Les noms et les alias de la campagne forment automatiquement le vocabulaire injecté dans la transcription locale en français.
  @R6 @business @page:fiche-entite @page:dm-view @component:EntityEditor @component:SuggestionPill @component:ElementsPanel @el:entity-editor @el:suggestion-pill @el:elements-panel
  Scenario: Alias et vocabulaire de détection
    Given l'alias « la taverne » sur « La Taverne du Sanglier »
    When la transcription démarre
    Then son vocabulaire contient les noms et les alias de toutes les entités de la campagne.

  # Le DM raconte au micro le prompt initial d'un personnage. L'IA propose un background cohérent et, pour un PNJ, un statblock crédible et jouable tel quel. Cela fonctionne quel que soit le fournisseur configuré : une API, cloud ou serveur maison, ou un binaire, opencode ou Claude Code.
  @R7 @journey @page:fiche-entite @component:EntityEditor @el:entity-editor
  Scenario: Prompt initial dicté et création assistée
    Given un prompt initial dicté pour un PNJ
    When le DM demande la proposition, successivement avec une API configurée et avec un binaire configuré
    Then un background cohérent avec le prompt et un statblock jouable sont proposés dans chacun des deux modes

  # Un PJ s'importe par son URL D&D Beyond. Le bouton « Resynchroniser » met à jour les stats, les PV et les sorts après une montée de niveau, sans toucher aux alias, aux notes ni au token définis localement.
  @R8 @business @page:fiche-entite @component:EntityEditor @el:entity-editor
  Scenario: Import et resynchronisation D&D Beyond
    Given un PJ importé de D&D Beyond avec alias, notes et token locaux
    When le DM clique « Resynchroniser » après une montée de niveau
    Then stats, PV et sorts sont à jour et alias, notes et token sont inchangés.

  # Toute modification par l'IA ou par D&D Beyond s'applique automatiquement et est versionnée, et un bouton « Mis à jour » le signale. Le DM consulte le diff, annule un changement précis ou revient à une version antérieure.
  @R9 @business @page:fiche-entite @page:preparation-seance @component:VersionHistory @component:OralBrief @el:version-history @el:oral-brief
  Scenario: Historique, diff et retour arrière
    Given une modification appliquée par l'IA ou par D&D Beyond
    When le DM ouvre l'historique
    Then une nouvelle version existe avec son diff, et annuler ce changement ou revenir à une version antérieure restaure exactement l'état d'avant.

  # Le DM coche les PJ présents à une séance et peut en ajouter ou en retirer plus tard. Seuls ces PJ sont proposés dans la DM view et sur les battlemaps.
  @R10 @business @page:campagne @page:preparation-seance @component:SessionList @component:SceneBoard @el:session-list @el:scene-board
  Scenario: PJ présents à la séance
    Given une séance avec deux PJ cochés présents sur quatre
    When le DM ouvre la DM view ou une battlemap
    Then seuls ces deux PJ sont proposés, et un PJ ajouté plus tard l'est aussi.

  # Un brief raconté au micro devient une liste ordonnée de scènes. Chaque scène est liée à des lieux, des PNJ, des événements et des médias, porte des notes libres, et peut être réordonnée ou complétée à la main.
  @R11 @journey @page:preparation-seance @component:OralBrief @component:SceneBoard @el:oral-brief @el:scene-board
  Scenario: Brief oral découpé en scènes
    Given un brief raconté au micro
    When il est traité
    Then une liste ordonnée de scènes apparaît, chacune liée à ses lieux, PNJ, événements et médias, réordonnable et modifiable à la main.

  # Le brief reconnaît les PNJ existants cités et les met à jour avec leur diff, et ajoute les PNJ manquants à la liste « à créer ». Pour chacun, le DM choisit « Créer depuis le brief » ou « Affiner » à l'oral ou à l'écrit avant la proposition de background et de statblock.
  @R12 @business @page:preparation-seance @page:campagne @component:OralBrief @component:ToCreateList @component:VersionHistory @el:oral-brief @el:to-create-list @el:version-history
  Scenario: PNJ existants mis à jour, PNJ manquants à créer
    Given un brief citant un PNJ existant et un PNJ inconnu
    When il est traité
    Then le PNJ existant est mis à jour avec son diff et le PNJ inconnu est ajouté à la liste « à créer », sans création automatique.

  # Pendant la préparation, le résumé généré et le journal transcrit horodaté de la séance précédente sont consultables dans un panneau latéral. La liste des séances affiche aussi leur résumé.
  @R13 @journey @page:preparation-seance @page:campagne @component:PreviousSummary @component:SessionList @el:previous-summary @el:session-list
  Scenario: Journal et résumé de la séance précédente
    Given une séance précédente close
    When le DM prépare la suivante
    Then son résumé et son journal horodaté sont consultables dans le panneau latéral et le résumé figure dans la liste des séances.

  # Le DM téléverse des battlemaps, des illustrations et des tokens rattachés à la campagne. Pour chaque battlemap, il règle la taille, le décalage, l'orientation, la couleur et l'opacité de la grille avec un aperçu en direct, sur la règle 1 hex = 5 pieds.
  @R14 @business @page:medias @component:MediaLibrary @component:GridSettings @el:media-library @el:grid-settings
  Scenario: Médias téléversés et grille hexagonale réglée
    Given une battlemap téléversée
    When le DM règle taille, décalage, orientation, couleur et opacité de la grille
    Then l'aperçu se met à jour en direct et un hex vaut toujours 5 pieds.

  # Une battlemap peut avoir une instance dans une scène de séance, sur laquelle le DM place à l'avance les PJ, les PNJ et les monstres.
  @R15 @journey @page:preparation-seance @component:SceneBoard @component:Battlemap @el:scene-board @el:battlemap
  Scenario: Instance de battlemap dans une scène
    Given une scène liée à une battlemap
    When le DM y place à l'avance PJ, PNJ et monstres
    Then l'instance de la scène les conserve à leur position, sans modifier la battlemap d'origine.

  # Le DM téléverse des sons, les nomme, les tague et règle leur volume propre. En séance, il les retrouve par une recherche dynamique et un filtre par tags, en joue plusieurs à la fois avec un volume global, un volume par son et « Tout arrêter », et le son ne sort que de la DM view.
  @R16 @business @page:soundbox @page:dm-view @component:SoundLibrary @component:LiveSoundbox @el:sound-library @el:live-soundbox
  Scenario: Soundbox d'effets tagués
    Given trois sons tagués
    When le DM filtre par tag et en joue deux à la fois
    Then chacun respecte son volume propre et le volume global, « Tout arrêter » coupe tout, et aucun son ne sort de la player view.

  # La DM view montre à gauche tous les éléments de la campagne, ceux de la séance en tête, et les scènes à suivre une à une. Au centre s'ouvre une fiche en lecture optimisée pour la table, avec un bouton d'édition, ou la battlemap de la scène.
  @R17 @journey @page:dm-view @component:ElementsPanel @component:TableSheet @component:Battlemap @component:LiveSessionBar @el:elements-panel @el:table-sheet @el:battlemap @el:live-session-bar
  Scenario: Conduite de la séance depuis la DM view
    Given une séance en cours
    When le DM ouvre la DM view
    Then les éléments de la séance sont en tête à gauche, les scènes défilent une à une, et un clic ouvre au centre la fiche en lecture ou la battlemap de la scène.

  # Un micro avec un bouton marche/pause toujours visible transcrit la séance en local, sans qu'aucun audio ne quitte la machine. Chaque entité ou son nommé par son nom ou son alias apparaît en quelques secondes dans une pile des 5 dernières suggestions. Un clic ouvre l'entité au centre, et un son se joue au second clic.
  @R18 @business @page:dm-view @component:SuggestionPill @el:suggestion-pill
  Scenario: Suggestions du micro en direct
    Given le micro en marche et un PNJ nommé par son alias
    When la phrase est prononcée
    Then il apparaît en quelques secondes dans la pile des 5 dernières suggestions, et aucun audio ne quitte la machine.

  # Le DM glisse-dépose les tokens, le curseur portant le token. Un compteur vert affiche la distance en ligne droite depuis la position de départ, par exemple « 6 hex · 30 pi ». Le token déposé apparaît au même endroit sur la player view en moins d'une seconde.
  @R19 @journey @page:dm-view @page:player-view @component:Battlemap @component:PlayerStage @el:battlemap @el:player-stage
  Scenario: Tokens glissés avec mesure de distance
    Given une battlemap envoyée aux joueurs et un token glissé de 6 hex
    When le DM le déplace
    Then le compteur affiche « 6 hex · 30 pi », et une fois déposé le token apparaît au même endroit sur la player view en moins d'une seconde.

  # Un personnage se glisse sur la battlemap, depuis la colonne de gauche ou la fiche, en une instance ou en « × N ». Les instances sont numérotées automatiquement et renommables.
  @R20 @business @page:dm-view @page:preparation-seance @component:Battlemap @component:ElementsPanel @el:battlemap @el:elements-panel
  Scenario: Dépôt de personnages en une ou plusieurs instances
    Given un monstre glissé « × 3 » sur la battlemap
    When il est déposé
    Then trois instances numérotées 1 à 3 apparaissent, chacune renommable sans toucher aux autres.

  # Chaque token a un interrupteur visible/caché et des badges d'état. Chaque PNJ a des PV courants modifiables côté DM. À 0 PV, le token est grisé, marqué mort et sauté dans l'initiative, et le DM peut le retirer d'un clic. Les PV des PJ ne sont pas suivis.
  @R21 @business @page:dm-view @page:player-view @component:Battlemap @component:PlayerStage @el:battlemap @el:player-stage
  Scenario: PV, états, mort et visibilité des tokens
    Given un PNJ dont les PV tombent à 0
    When le DM valide
    Then son token est grisé, marqué mort et sauté dans l'initiative, et les PV des PJ ne sont jamais suivis.

  # Au lancement du combat, les PNJ tirent d20 + DEX, le DM saisit l'initiative des PJ, et les égalités se départagent par la DEX puis au hasard. Un carrousel à la Foundry apparaît sur les deux vues, avec « Suivant », un compteur de rounds, et l'ajout, le retrait et le réordonnancement des participants. Un clic sur un participant ouvre la fiche de cette instance précise.
  @R22 @business @page:dm-view @page:player-view @component:Battlemap @component:PlayerStage @el:battlemap @el:player-stage
  Scenario: Combat et carrousel d'initiative
    Given deux PNJ à égalité d'initiative
    When le combat démarre
    Then ils sont départagés par la DEX puis au hasard, le carrousel apparaît sur les deux vues, et « Suivant » fait avancer le tour et le compteur de rounds.

  # Tout l'état d'une battlemap, combat en cours compris, survit à la fermeture de l'application. Un bouton « Réinitialiser la carte » vide la carte : tokens, combat et initiative sont retirés, la carte et sa grille restent.
  @R23 @business @page:dm-view @component:Battlemap @el:battlemap
  Scenario: État de la carte conservé
    Given un combat en cours sur une battlemap
    When l'application est fermée puis rouverte
    Then positions, PV, états et initiative sont identiques, et « Réinitialiser la carte » vide la carte : plus aucun token ni ordre d'initiative, la carte et sa grille restent affichées.

  # La player view affiche la couverture de la campagne quand rien n'est envoyé. Le DM y envoie une battlemap, ou une illustration en mode scène (plein écran) ou en mode fenêtre flottante. Dans un onglet player view synchronisé, il déplace les tokens et la fenêtre, la redimensionne en gardant ses proportions, zoome et se déplace.
  @R24 @journey @page:dm-view @page:player-view @component:LiveSessionBar @component:ElementsPanel @component:TableSheet @component:Battlemap @component:PlayerStage @el:live-session-bar @el:elements-panel @el:table-sheet @el:battlemap @el:player-stage
  Scenario: Diffusion vers la player view
    Given rien d'envoyé
    When le DM envoie une illustration en fenêtre flottante puis la redimensionne
    Then la player view passe de la couverture à l'illustration et garde ses proportions.

  # La player view ne montre jamais les notes, les PV des PNJ ni les tokens cachés, absents aussi de son carrousel. Elle n'affiche qu'un état approximatif des PNJ (indemne, blessé, en sang). Un token révélé reprend sa place dans l'ordre d'initiative.
  @R25 @business @page:player-view @page:dm-view @component:PlayerStage @component:LiveSoundbox @el:player-stage @el:live-soundbox
  Scenario: Séparation des vues DM et joueurs
    Given un token caché et un PNJ blessé
    When la player view s'affiche
    Then ni notes, ni PV de PNJ, ni token caché n'apparaissent, l'état du PNJ est seulement « blessé », et un token révélé reprend sa place dans l'initiative.

  # Clore la séance met le micro en pause et conserve localement le journal transcrit horodaté. Un résumé est généré avec le modèle configuré, pour nourrir la préparation suivante.
  @R26 @business @page:dm-view @page:preparation-seance @component:LiveSessionBar @component:PreviousSummary @el:live-session-bar @el:previous-summary
  Scenario: Clôture de séance avec journal et résumé
    Given une séance en cours
    When le DM clôt la séance
    Then le micro passe en pause, le journal horodaté est conservé localement, et un résumé est généré avec le modèle configuré.

  # L'audio du micro est transcrit et analysé sur la machine du DM. Seul du texte est transmis au fournisseur de génération, qu'il soit joint par une API (cloud ou serveur maison) ou par un binaire (opencode ou Claude Code). L'écran des paramètres le rappelle.
  @R77 @business @page:parametres-ia @component:AiSettings @el:ai-settings
  Scenario: Seul du texte part vers le fournisseur
    Given le micro actif pendant une séance ou un brief oral, et un fournisseur de génération configuré, d'abord en mode « API », puis en mode « Binaire »
    When le DM parle, puis demande une génération (statblock, background, analyse du brief ou résumé) dans chacun des deux modes
    Then aucune donnée audio ne sort de la machine, et ce qui est transmis à l'API ou au binaire ne contient que du texte

  # En mode « API », le DM ne renseigne que l'URL. Le système interroge cette URL, reconnaît le type d'API (par exemple une API cloud ou un endpoint opencode) et choisit lui-même le protocole de connexion, sans que le DM ait à préciser le type. Si le type n'est pas reconnu, la connexion est refusée et un message l'explique.
  @R92 @business @page:parametres-ia @component:AiSettings @el:ai-settings
  Scenario: Détection automatique du type d'API
    Given deux URL valides, l'une d'une API cloud et l'autre de l'endpoint opencode du serveur maison, ainsi qu'une URL qui ne répond pas à un type d'API connu
    When le DM saisit tour à tour chacune de ces URL en mode « API » et teste la connexion, sans préciser le type d'API
    Then le type correct est détecté et affiché pour chacune des deux premières URL et la connexion réussit, tandis que la troisième URL est refusée avec un message indiquant que le type d'API n'est pas reconnu

  # À gauche de la fiche d'entité, un rail collant liste les éléments de la campagne par catégorie : PJ, PNJ, lieux et événements. Les médias et les sons restent sur la page de la campagne. Une recherche filtre le rail à chaque frappe, avec la même logique approximative que le panneau gauche de la DM view, sur les noms et les alias. Un clic sur un élément charge sa fiche sur place et met à jour l'identifiant dans l'URL, sans rechargement de page. Des boutons « Nouveau… » en bas du rail créent un personnage, un lieu ou un événement.
  @R93 @journey @page:fiche-entite @component:CampaignElements @component:EntityEditor @el:campaign-elements @el:entity-editor
  Scenario: Rail de navigation entre les fiches d'entité
    Given la fiche d'un lieu ouverte, et un PJ « Elowen » portant l'alias « la rôdeuse » dans la campagne
    When le DM tape « elowen », puis efface et tape « rodeuse » dans la recherche du rail, et clique sur Elowen
    Then Elowen figure dans les résultats pour chacune des deux saisies, sa fiche remplace celle du lieu sans rechargement de page, et l'URL porte son identifiant

  # Un bouton en haut à gauche du rail de la fiche d'entité le replie en une bande fine, et cet état est mémorisé d'une visite à l'autre. Sous 960 px de large, le rail devient un tiroir que le DM ouvre et ferme à la demande.
  @R94 @journey @page:fiche-entite @component:CampaignElements @el:campaign-elements
  Scenario: Rail repliable et tiroir sur petit écran
    Given la fiche d'entité ouverte avec son rail déplié
    When le DM replie le rail et recharge la page, puis réduit la fenêtre sous 960 px, ouvre le tiroir et le referme
    Then le rail est toujours replié après le rechargement, et sous 960 px le tiroir s'ouvre au-dessus de la fiche puis se referme sans la masquer

  # Si la fiche ouverte a des modifications non enregistrées et que le DM choisit un autre élément dans le rail, une barre intégrée à la fiche propose « Enregistrer et continuer », « Abandonner » ou « Rester ». « Enregistrer et continuer » enregistre la fiche puis ouvre l'élément choisi ; « Abandonner » ouvre l'élément choisi sans enregistrer ; « Rester » laisse la fiche et ses modifications en l'état.
  @R95 @journey @page:fiche-entite @component:EntityEditor @el:entity-editor
  Scenario: Confirmation avant de quitter une fiche modifiée
    Given la fiche d'un PNJ dont la description a été modifiée sans être enregistrée
    When le DM clique sur un autre élément du rail et choisit tour à tour « Rester », « Abandonner » puis, après une nouvelle modification, « Enregistrer et continuer »
    Then « Rester » garde la fiche et la modification affichées, « Abandonner » ouvre l'élément choisi et la modification est perdue, et « Enregistrer et continuer » enregistre la modification avant d'ouvrir l'élément choisi

  # Dans le rail de la fiche d'entité, chaque catégorie (PJ, PNJ, lieux, événements) est une section que le DM ferme ou ouvre en cliquant sur son titre. Un petit triangle à gauche du titre indique si la section est ouverte ou fermée. Fermer une section masque ses éléments sans toucher aux autres sections.
  @R96 @journey @page:fiche-entite @component:CampaignElements @el:campaign-elements
  Scenario: Sections du rail repliables par catégorie
    Given la fiche d'entité ouverte avec son rail déplié et les sections PJ, PNJ, lieux et événements toutes ouvertes
    When le DM clique sur le titre « PJ », puis clique de nouveau sur ce même titre
    Then au premier clic, les éléments PJ sont masqués, le triangle à gauche du titre indique que la section est fermée, et les sections PNJ, lieux et événements restent ouvertes ; au second clic, les éléments PJ réapparaissent et le triangle indique que la section est ouverte

  # Chaque média, battlemaps comprises, peut être associé à un lieu de la campagne, depuis sa carte dans la bibliothèque ou depuis le formulaire de téléversement. Un média sans lieu reste valide. Quand un lieu fait partie d'une séance, tous les médias de ce lieu sont associés à cette séance, sans geste supplémentaire. L'association entre lieu et séance est partagée entre la page Médias et la préparation de séance : ajouter un lieu à une séance depuis l'une ou l'autre page associe ses médias à la séance sur les deux pages. La page Médias indique l'association, par exemple « Associé à la séance 4 ». Si le lieu n'est pas encore dans la séance, elle permet de l'y ajouter. Changer le lieu d'un média met à jour son association à la séance.
  @R97 @business @page:medias @page:preparation-seance @component:MediaLibrary @component:SceneBoard @el:media-library @el:scene-board
  Scenario: Médias rattachés à la séance par leur lieu
    Given une battlemap et une illustration associées à « La Taverne du Sanglier », absente de la séance 4, une seconde battlemap associée à un autre lieu, et un média sans lieu
    When le DM ajoute la taverne à une scène de la séance 4 depuis la préparation de séance, puis ouvre la page Médias et y change le lieu de la seconde battlemap pour « La Taverne du Sanglier »
    Then la battlemap et l'illustration de la taverne sont associées à la séance 4 sur les deux pages, la page Médias affiche « Associé à la séance 4 » sur leurs cartes, la seconde battlemap le devient aussi après son changement de lieu, et le média sans lieu reste valide sans association à la séance

  # Dans la DM view, la pastille des suggestions et le bouton marche/pause du micro forment une surcouche posée au-dessus de la page, ancrée en bas à droite de la fenêtre. Elle garde cette position quel que soit le contenu ouvert au centre (fiche en lecture, battlemap ou onglet Soundbox) et quand le DM fait défiler la page ou le panneau gauche. Elle passe au-dessus de ce contenu sans le décaler, et reste cliquable.
  @R98 @journey @page:dm-view @component:SuggestionPill @el:suggestion-pill
  Scenario: Pastille des suggestions en surcouche fixe
    Given une séance en direct dans la DM view, avec le micro en marche et une entité déjà suggérée dans la pastille
    When le DM ouvre au centre une longue fiche en lecture et la fait défiler jusqu'en bas, puis ouvre la battlemap de la scène et enfin l'onglet Soundbox
    Then la pastille et le bouton marche/pause du micro restent affichés au même endroit en bas à droite de la fenêtre, par-dessus le contenu, sans le décaler, et un clic sur l'entité suggérée l'ouvre toujours au centre

  # Depuis les Paramètres IA, le DM vérifie d'un clic que le fournisseur choisi (API cloud ou endpoint opencode maison) répond avec l'URL, les modèles et la clé renseignés.
  @R99 @journey @page:parametres-ia @component:AiSettings @el:ai-settings
  Scenario: Tester la connexion au fournisseur
    Given le DM a renseigné l'URL de son endpoint opencode maison, un modèle de génération et un modèle de résumé
    When il clique sur « Tester la connexion »
    Then l'écran indique si la connexion réussit ou, sinon, la raison de l'échec, sans enregistrer de réglage invalide à son insu

  # La proposition de background, de comportement et de statblock d'un PNJ fonctionne de la même façon avec l'API cloud et avec l'endpoint opencode du serveur maison.
  @R100 @business @page:fiche-entite @page:parametres-ia @component:EntityEditor @component:AiSettings @el:entity-editor @el:ai-settings
  Scenario: Création assistée avec les deux fournisseurs
    Given un PNJ avec un prompt initial dicté, et deux réglages valides : l'API cloud puis l'endpoint opencode
    When le DM demande la proposition IA avec chacun des deux fournisseurs
    Then chaque fournisseur remplit le background, le comportement et un statblock complet (caractéristiques, CA, PV, capacités) dans les mêmes champs de la fiche

  # Le token d'un personnage reprend par défaut le recadrage de son portrait ; une image dédiée peut le remplacer ; sans portrait, il devient une pastille de couleur avec les initiales et le numéro d'instance.
  @R101 @business @page:fiche-entite @page:dm-view @page:player-view @component:EntityEditor @component:Battlemap @component:PlayerStage @el:entity-editor @el:battlemap @el:player-stage
  Scenario: Image de token par défaut
    Given un PNJ « Bandit » sans portrait ni image de token, placé en trois instances
    When les tokens s'affichent sur la battlemap
    Then chacun est une pastille de couleur portant « B » et son numéro (1, 2, 3), et dès qu'un portrait est ajouté et recadré, les tokens montrent ce recadrage

  # Le brief oral reconnaît non seulement les PNJ, mais aussi les lieux et les événements existants, et place les lieux et événements manquants dans la liste « à créer ».
  @R102 @business @page:preparation-seance @page:campagne @component:OralBrief @component:ToCreateList @component:SceneBoard @el:oral-brief @el:to-create-list @el:scene-board
  Scenario: Lieux et événements reconnus dans le brief
    Given une campagne qui contient le lieu « La Taverne du Sanglier » mais pas « Le Pont des Pendus »
    When le DM raconte un brief qui cite la taverne, le pont et l'événement « l'embuscade »
    Then la taverne est liée à la scène correspondante comme lieu existant, et le pont et l'embuscade apparaissent dans la liste « à créer » avec leur type et l'extrait du brief

  # Pour une entité de la liste « à créer », le DM peut compléter sa description à l'oral ou à l'écrit avant que l'IA en fasse la proposition.
  @R103 @journey @page:preparation-seance @page:campagne @component:ToCreateList @el:to-create-list
  Scenario: Affiner une entité manquante
    Given un PNJ manquant dans la liste « à créer », issu du brief
    When le DM choisit « Affiner », dicte trois phrases de plus et valide
    Then la proposition de l'IA (background et statblock) tient compte à la fois de l'extrait du brief et des phrases ajoutées, et l'entité quitte la liste « à créer » une fois créée

  # Au lancement du combat, chaque PNJ tire d20 + modificateur de DEX ; les égalités se départagent par la DEX, puis au hasard.
  @R105 @business @page:dm-view @component:Battlemap @el:battlemap
  Scenario: Initiative des PNJ et départage
    Given deux PNJ qui obtiennent tous deux 14 à l'initiative, l'un avec DEX 16 et l'autre avec DEX 12, et un PJ dont le DM saisit 14
    When le DM lance le combat
    Then chaque PNJ a une initiative comprise entre 1 + son modificateur et 20 + son modificateur, et le PNJ à DEX 16 passe avant celui à DEX 12 ; une égalité qui subsiste à DEX égale est tranchée au hasard

  # Quand plusieurs instances d'un même PNJ sont sur la carte, un clic sur l'une d'elles dans le carrousel ouvre la fiche de cette instance précise, avec ses PV courants modifiables.
  @R106 @journey @page:dm-view @component:Battlemap @component:TableSheet @el:battlemap @el:table-sheet
  Scenario: Fiche d'une instance précise en combat
    Given un combat en cours avec Bandit 1, Bandit 2 et Bandit 3
    When le DM clique sur Bandit 2 dans le carrousel et retire 7 PV
    Then la fiche ouverte est celle de Bandit 2, seuls les PV de Bandit 2 baissent de 7, et ceux de Bandit 1 et Bandit 3 restent inchangés

  # Un token caché garde sa place dans l'ordre d'initiative ; le révéler le fait apparaître à cette place dans le carrousel joueur.
  @R107 @business @page:dm-view @page:player-view @component:Battlemap @component:PlayerStage @el:battlemap @el:player-stage
  Scenario: Révélation à sa place dans l'initiative
    Given un combat où Chef bandit 1, caché, a la deuxième initiative et figure avec une icône dans le carrousel DM seulement
    When le DM le rend visible
    Then il apparaît en deuxième position dans le carrousel de la player view, et l'ordre des autres participants n'a pas changé

  # La player view déduit des PV courants un état approximatif pour chaque PNJ visible : indemne, blessé ou en sang, sans jamais montrer les PV.
  @R108 @business @page:player-view @page:dm-view @component:PlayerStage @component:Battlemap @el:player-stage @el:battlemap
  Scenario: État approximatif des PNJ
    Given un PNJ visible de 20 PV max
    When ses PV courants passent à 20, puis à 13, puis à 10, puis à 0
    Then la player view affiche successivement « indemne », « blessé » (au-dessus de la moitié), « en sang » (à la moitié ou moins), puis le token grisé et marqué mort, sans aucun chiffre de PV

  # Une icône en haut à droite de la pastille ouvre l'historique des 5 dernières entités détectées, que le DM peut rouvrir d'un clic.
  @R109 @journey @page:dm-view @component:SuggestionPill @el:suggestion-pill
  Scenario: Historique des suggestions
    Given le micro a détecté successivement la taverne, le tavernier puis Morlox
    When le DM clique sur l'icône d'historique de la pastille puis sur la taverne
    Then l'historique liste ces entités de la plus récente à la plus ancienne, et la fiche de la taverne s'ouvre au centre

  # L'onglet Soundbox présente une case par son, filtrée dynamiquement par la recherche et par les tags.
  @R110 @journey @page:dm-view @component:LiveSoundbox @el:live-soundbox
  Scenario: Recherche et tags dans la soundbox
    Given une soundbox qui contient « porte qui grince » (tag porte) et « bruit de foule » (tag taverne)
    When le DM tape « gri » dans la recherche, puis l'efface et filtre sur le tag taverne
    Then seule la case « porte qui grince » reste pendant la saisie, puis seule la case « bruit de foule » reste avec le filtre

  # Plusieurs effets jouent en même temps depuis la DM view, chacun à son volume propre multiplié par le volume global, et « Tout arrêter » les coupe tous.
  @R111 @business @page:dm-view @page:soundbox @component:LiveSoundbox @component:SuggestionPill @component:SoundLibrary @el:live-soundbox @el:suggestion-pill @el:sound-library
  Scenario: Sons simultanés et volumes
    Given « bruit de foule » joue depuis la soundbox
    When le DM déclenche « porte qui grince » depuis la pastille, baisse le volume global, puis clique sur « Tout arrêter »
    Then les deux sons se superposent, tous deux baissent avec le volume global en gardant leur rapport, puis plus aucun son ne joue

  # La fenêtre flottante d'une illustration envoyée en mode fenêtre se déplace et se redimensionne en gardant les proportions de l'image.
  @R112 @business @page:player-view @component:PlayerStage @el:player-stage
  Scenario: Fenêtre d'illustration proportionnelle
    Given une illustration de 800 × 1200 envoyée en mode fenêtre
    When le DM l'agrandit par glisser-déposer dans son onglet player view
    Then la fenêtre garde un rapport largeur sur hauteur de 2/3, et sa position et sa taille sont les mêmes sur la player view projetée

  # Dans un onglet player view synchronisé, le DM déplace les tokens, zoome, dézoome et se déplace dans la scène comme sur un canevas.
  @R113 @journey @page:player-view @page:dm-view @component:PlayerStage @component:Battlemap @el:player-stage @el:battlemap
  Scenario: Onglet player view piloté par le DM
    Given une battlemap envoyée aux joueurs et un onglet player view ouvert par le DM
    When il y déplace un token, zoome et décale le cadrage
    Then le token est à la nouvelle position dans la DM view, et le zoome et le cadrage sont les mêmes sur la player view projetée

  # Tout changement fait dans un onglet (token, carrousel, diffusion, fenêtre) apparaît dans les autres onglets ouverts en moins d'une seconde.
  @R114 @business @page:dm-view @page:player-view @component:Battlemap @component:PlayerStage @component:LiveSessionBar @el:battlemap @el:player-stage @el:live-session-bar
  Scenario: Synchronisation des onglets sous une seconde
    Given la DM view et la player view ouvertes dans deux onglets de la même machine
    When le DM dépose un token sur un hex de la DM view
    Then le token apparaît sur le même hex de la player view en moins d'une seconde

  # Sur la soundbox, le DM ajoute un son à la bibliothèque de la campagne que l'écran montre : celle que l'adresse nomme (?campaign=), sinon la campagne par défaut. Son geste vaut approbation : le son est enregistré aussitôt, sans attendre de revue.
  @R115 @journey @page:soundbox @component:SoundLibrary @el:sound-library
  Scenario: Un son ajouté rejoint la soundbox de la campagne
    Given la soundbox ouverte sur la campagne « Les Héritiers de la Tour d’Ébène » par son adresse
    When le DM y ajoute un son nommé et tagué
    Then le son apparaît dans la bibliothèque de cette campagne et y est encore après rechargement, sans refus « un son nomme sa campagne » ni attente de revue

  # Sur l'écran d'une campagne, le DM crée une séance : elle est enregistrée aussitôt dans cette campagne, sans attendre de revue. L'écran montre la campagne que l'adresse nomme (?campaign=), sinon la campagne par défaut.
  @R116 @journey @page:campagne @component:SessionList @el:session-list
  Scenario: Une séance créée existe vraiment
    Given l'écran campagne ouvert sur la campagne « Les Héritiers de la Tour d’Ébène » par son adresse
    When le DM y crée une séance titrée
    Then la séance apparaît dans la liste des séances de cette campagne et y est encore après rechargement

  # Sur l'écran d'une campagne, « Exporter l'archive » fait enregistrer au navigateur le fichier d'archive que le serveur répond à l'export.
  @R117 @journey @page:campagne @component:CampaignOverview @el:campaign-overview
  Scenario: L'export de la campagne donne un fichier
    Given l'écran campagne ouvert sans campagne dans l'adresse
    When le DM exporte l'archive de la campagne
    Then le navigateur enregistre un fichier JSON : l'archive « campaign-archive » de la campagne affichée, qui porte son nom

  # Sur l'écran des médias, le DM téléverse une illustration dans la médiathèque de la campagne affichée, celle que l'adresse nomme, sinon la campagne par défaut : elle est enregistrée aussitôt, sans attendre de revue.
  @R118 @journey @page:medias @component:MediaLibrary @el:media-library
  Scenario: Une illustration téléversée reste dans la médiathèque
    Given l'écran médias ouvert sans campagne dans l'adresse
    When le DM y téléverse une illustration sous un titre qu'aucun autre média ne porte
    Then l'illustration apparaît sous ce titre parmi les illustrations de la médiathèque et y est encore après rechargement

  # Sur la fiche d'une entité, le DM revient à une version antérieure depuis l'historique : la fiche reprend les valeurs de cette version et l'historique garde la trace du retour, aussitôt et sans attendre de revue.
  @R119 @journey @page:fiche-entite @component:VersionHistory @component:EntityEditor @el:version-history @el:entity-editor
  Scenario: Revenir à une version d'une fiche
    Given la fiche de Mère Ombeline, dont le DM vient de changer la description et de l'enregistrer
    When il revient à la version précédente depuis l'historique
    Then la fiche reprend sa description d'origine, une nouvelle version apparaît en tête de l'historique, et l'une comme l'autre sont encore là après rechargement
