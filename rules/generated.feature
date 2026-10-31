Feature: Navigation of the mock-up
  Written by the harness from the mock-up's links. Regenerated: never edit it.

  @G-campagnes.site-menu @generated @journey @page:campagnes @el:site-menu
  Scenario: Accueil des campagnes montre le menu du site
    Given I am on "campagnes"
    Then I see "site-menu"

  @G-campagnes.menu-campagnes @generated @journey
  Scenario: Depuis Accueil des campagnes, « Campagnes » mène à Accueil des campagnes
    Given I am on "campagnes"
    When I click "menu-campagnes"
    Then I see the page "campagnes"

  @G-campagnes.menu-medias @generated @journey
  Scenario: Depuis Accueil des campagnes, « Médias » mène à Médias et réglage de battlemap
    Given I am on "campagnes"
    When I click "menu-medias"
    Then I see the page "medias"

  @G-campagnes.menu-soundbox @generated @journey
  Scenario: Depuis Accueil des campagnes, « Soundbox » mène à Soundbox
    Given I am on "campagnes"
    When I click "menu-soundbox"
    Then I see the page "soundbox"

  @G-campagnes.menu-parametres-ia @generated @journey
  Scenario: Depuis Accueil des campagnes, « Paramètres IA » mène à Paramètres IA
    Given I am on "campagnes"
    When I click "menu-parametres-ia"
    Then I see the page "parametres-ia"

  @G-campagnes.campaign-list-to-campagne @generated @journey
  Scenario: Depuis Accueil des campagnes, « Ouvrir » mène à Campagne
    Given I am on "campagnes"
    When I click "campaign-list-to-campagne"
    Then I see the page "campagne"

  @G-parametres-ia.site-menu @generated @journey @page:parametres-ia @el:site-menu
  Scenario: Paramètres IA montre le menu du site
    Given I am on "parametres-ia"
    Then I see "site-menu"

  @G-parametres-ia.menu-campagnes @generated @journey
  Scenario: Depuis Paramètres IA, « Campagnes » mène à Accueil des campagnes
    Given I am on "parametres-ia"
    When I click "menu-campagnes"
    Then I see the page "campagnes"

  @G-parametres-ia.menu-medias @generated @journey
  Scenario: Depuis Paramètres IA, « Médias » mène à Médias et réglage de battlemap
    Given I am on "parametres-ia"
    When I click "menu-medias"
    Then I see the page "medias"

  @G-parametres-ia.menu-soundbox @generated @journey
  Scenario: Depuis Paramètres IA, « Soundbox » mène à Soundbox
    Given I am on "parametres-ia"
    When I click "menu-soundbox"
    Then I see the page "soundbox"

  @G-parametres-ia.menu-parametres-ia @generated @journey
  Scenario: Depuis Paramètres IA, « Paramètres IA » mène à Paramètres IA
    Given I am on "parametres-ia"
    When I click "menu-parametres-ia"
    Then I see the page "parametres-ia"

  @G-campagne.site-menu @generated @journey @page:campagne @el:site-menu
  Scenario: Campagne montre le menu du site
    Given I am on "campagne"
    Then I see "site-menu"

  @G-campagne.menu-campagnes @generated @journey
  Scenario: Depuis Campagne, « Campagnes » mène à Accueil des campagnes
    Given I am on "campagne"
    When I click "menu-campagnes"
    Then I see the page "campagnes"

  @G-campagne.menu-medias @generated @journey
  Scenario: Depuis Campagne, « Médias » mène à Médias et réglage de battlemap
    Given I am on "campagne"
    When I click "menu-medias"
    Then I see the page "medias"

  @G-campagne.menu-soundbox @generated @journey
  Scenario: Depuis Campagne, « Soundbox » mène à Soundbox
    Given I am on "campagne"
    When I click "menu-soundbox"
    Then I see the page "soundbox"

  @G-campagne.menu-parametres-ia @generated @journey
  Scenario: Depuis Campagne, « Paramètres IA » mène à Paramètres IA
    Given I am on "campagne"
    When I click "menu-parametres-ia"
    Then I see the page "parametres-ia"

  @G-campagne.crumb-campagnes @generated @journey
  Scenario: Depuis Campagne, « ← Campagnes » mène à Accueil des campagnes
    Given I am on "campagne"
    When I click "crumb-campagnes"
    Then I see the page "campagnes"

  @G-campagne.campaign-overview-to-preparation-seance @generated @journey
  Scenario: Depuis Campagne, « Préparer la prochaine séance » mène à Préparation de séance
    Given I am on "campagne"
    When I click "campaign-overview-to-preparation-seance"
    Then I see the page "preparation-seance"

  @G-campagne.campaign-overview-to-dm-view @generated @journey
  Scenario: Depuis Campagne, « Lancer la DM view » mène à DM view
    Given I am on "campagne"
    When I click "campaign-overview-to-dm-view"
    Then I see the page "dm-view"

  @G-campagne.session-list-to-dm-view @generated @journey
  Scenario: Depuis Campagne, « Vers DM view » mène à DM view
    Given I am on "campagne"
    When I click "session-list-to-dm-view"
    Then I see the page "dm-view"

  @G-campagne.session-list-to-preparation-seance @generated @journey
  Scenario: Depuis Campagne, « Vers Préparation de séance » mène à Préparation de séance
    Given I am on "campagne"
    When I click "session-list-to-preparation-seance"
    Then I see the page "preparation-seance"

  @G-campagne.campaign-elements-to-fiche-entite @generated @journey
  Scenario: Depuis Campagne, « Vers Fiche d’entité » mène à Fiche d’entité
    Given I am on "campagne"
    When I click "campaign-elements-to-fiche-entite"
    Then I see the page "fiche-entite"

  @G-campagne.campaign-elements-to-medias @generated @journey
  Scenario: Depuis Campagne, « Vers Médias et réglage de battlemap » mène à Médias et réglage de battlemap
    Given I am on "campagne"
    When I click "campaign-elements-to-medias"
    Then I see the page "medias"

  @G-campagne.campaign-elements-to-soundbox @generated @journey
  Scenario: Depuis Campagne, « Vers Soundbox » mène à Soundbox
    Given I am on "campagne"
    When I click "campaign-elements-to-soundbox"
    Then I see the page "soundbox"

  @G-campagne.to-create-list-to-fiche-entite @generated @journey
  Scenario: Depuis Campagne, « Vers Fiche d’entité » mène à Fiche d’entité
    Given I am on "campagne"
    When I click "to-create-list-to-fiche-entite"
    Then I see the page "fiche-entite"

  @G-fiche-entite.site-menu @generated @journey @page:fiche-entite @el:site-menu
  Scenario: Fiche d’entité montre le menu du site
    Given I am on "fiche-entite"
    Then I see "site-menu"

  @G-fiche-entite.menu-campagnes @generated @journey
  Scenario: Depuis Fiche d’entité, « Campagnes » mène à Accueil des campagnes
    Given I am on "fiche-entite"
    When I click "menu-campagnes"
    Then I see the page "campagnes"

  @G-fiche-entite.menu-medias @generated @journey
  Scenario: Depuis Fiche d’entité, « Médias » mène à Médias et réglage de battlemap
    Given I am on "fiche-entite"
    When I click "menu-medias"
    Then I see the page "medias"

  @G-fiche-entite.menu-soundbox @generated @journey
  Scenario: Depuis Fiche d’entité, « Soundbox » mène à Soundbox
    Given I am on "fiche-entite"
    When I click "menu-soundbox"
    Then I see the page "soundbox"

  @G-fiche-entite.menu-parametres-ia @generated @journey
  Scenario: Depuis Fiche d’entité, « Paramètres IA » mène à Paramètres IA
    Given I am on "fiche-entite"
    When I click "menu-parametres-ia"
    Then I see the page "parametres-ia"

  @G-fiche-entite.crumb-campagnes @generated @journey
  Scenario: Depuis Fiche d’entité, « Campagnes » mène à Accueil des campagnes
    Given I am on "fiche-entite"
    When I click "crumb-campagnes"
    Then I see the page "campagnes"

  @G-fiche-entite.crumb-campagne @generated @journey
  Scenario: Depuis Fiche d’entité, « Campagne » mène à Campagne
    Given I am on "fiche-entite"
    When I click "crumb-campagne"
    Then I see the page "campagne"

  @G-fiche-entite.campaign-elements-to-medias @generated @journey
  Scenario: Depuis Fiche d’entité, « Vers Médias et réglage de battlemap » mène à Médias et réglage de battlemap
    Given I am on "fiche-entite"
    When I click "campaign-elements-to-medias"
    Then I see the page "medias"

  @G-fiche-entite.campaign-elements-to-soundbox @generated @journey
  Scenario: Depuis Fiche d’entité, « Vers Soundbox » mène à Soundbox
    Given I am on "fiche-entite"
    When I click "campaign-elements-to-soundbox"
    Then I see the page "soundbox"

  @G-fiche-entite.entity-editor-to-campagne @generated @journey
  Scenario: Depuis Fiche d’entité, « Vers Campagne » mène à Campagne
    Given I am on "fiche-entite"
    When I click "entity-editor-to-campagne"
    Then I see the page "campagne"

  @G-preparation-seance.site-menu @generated @journey @page:preparation-seance @el:site-menu
  Scenario: Préparation de séance montre le menu du site
    Given I am on "preparation-seance"
    Then I see "site-menu"

  @G-preparation-seance.menu-campagnes @generated @journey
  Scenario: Depuis Préparation de séance, « Campagnes » mène à Accueil des campagnes
    Given I am on "preparation-seance"
    When I click "menu-campagnes"
    Then I see the page "campagnes"

  @G-preparation-seance.menu-medias @generated @journey
  Scenario: Depuis Préparation de séance, « Médias » mène à Médias et réglage de battlemap
    Given I am on "preparation-seance"
    When I click "menu-medias"
    Then I see the page "medias"

  @G-preparation-seance.menu-soundbox @generated @journey
  Scenario: Depuis Préparation de séance, « Soundbox » mène à Soundbox
    Given I am on "preparation-seance"
    When I click "menu-soundbox"
    Then I see the page "soundbox"

  @G-preparation-seance.menu-parametres-ia @generated @journey
  Scenario: Depuis Préparation de séance, « Paramètres IA » mène à Paramètres IA
    Given I am on "preparation-seance"
    When I click "menu-parametres-ia"
    Then I see the page "parametres-ia"

  @G-preparation-seance.crumb-campagnes @generated @journey
  Scenario: Depuis Préparation de séance, « Campagnes » mène à Accueil des campagnes
    Given I am on "preparation-seance"
    When I click "crumb-campagnes"
    Then I see the page "campagnes"

  @G-preparation-seance.crumb-campagne @generated @journey
  Scenario: Depuis Préparation de séance, « Campagne » mène à Campagne
    Given I am on "preparation-seance"
    When I click "crumb-campagne"
    Then I see the page "campagne"

  @G-preparation-seance.previous-summary-to-fiche-entite @generated @journey
  Scenario: Depuis Préparation de séance, « Vers Fiche d’entité » mène à Fiche d’entité
    Given I am on "preparation-seance"
    When I click "previous-summary-to-fiche-entite"
    Then I see the page "fiche-entite"

  @G-preparation-seance.oral-brief-to-fiche-entite @generated @journey
  Scenario: Depuis Préparation de séance, « Vers Fiche d’entité » mène à Fiche d’entité
    Given I am on "preparation-seance"
    When I click "oral-brief-to-fiche-entite"
    Then I see the page "fiche-entite"

  @G-preparation-seance.scene-board-to-fiche-entite @generated @journey
  Scenario: Depuis Préparation de séance, « Vers Fiche d’entité » mène à Fiche d’entité
    Given I am on "preparation-seance"
    When I click "scene-board-to-fiche-entite"
    Then I see the page "fiche-entite"

  @G-preparation-seance.scene-board-to-medias @generated @journey
  Scenario: Depuis Préparation de séance, « Vers Médias et réglage de battlemap » mène à Médias et réglage de battlemap
    Given I am on "preparation-seance"
    When I click "scene-board-to-medias"
    Then I see the page "medias"

  @G-preparation-seance.to-create-list-to-fiche-entite @generated @journey
  Scenario: Depuis Préparation de séance, « Vers Fiche d’entité » mène à Fiche d’entité
    Given I am on "preparation-seance"
    When I click "to-create-list-to-fiche-entite"
    Then I see the page "fiche-entite"

  @G-medias.site-menu @generated @journey @page:medias @el:site-menu
  Scenario: Médias et réglage de battlemap montre le menu du site
    Given I am on "medias"
    Then I see "site-menu"

  @G-medias.menu-campagnes @generated @journey
  Scenario: Depuis Médias et réglage de battlemap, « Campagnes » mène à Accueil des campagnes
    Given I am on "medias"
    When I click "menu-campagnes"
    Then I see the page "campagnes"

  @G-medias.menu-medias @generated @journey
  Scenario: Depuis Médias et réglage de battlemap, « Médias » mène à Médias et réglage de battlemap
    Given I am on "medias"
    When I click "menu-medias"
    Then I see the page "medias"

  @G-medias.menu-soundbox @generated @journey
  Scenario: Depuis Médias et réglage de battlemap, « Soundbox » mène à Soundbox
    Given I am on "medias"
    When I click "menu-soundbox"
    Then I see the page "soundbox"

  @G-medias.menu-parametres-ia @generated @journey
  Scenario: Depuis Médias et réglage de battlemap, « Paramètres IA » mène à Paramètres IA
    Given I am on "medias"
    When I click "menu-parametres-ia"
    Then I see the page "parametres-ia"

  @G-soundbox.site-menu @generated @journey @page:soundbox @el:site-menu
  Scenario: Soundbox montre le menu du site
    Given I am on "soundbox"
    Then I see "site-menu"

  @G-soundbox.menu-campagnes @generated @journey
  Scenario: Depuis Soundbox, « Campagnes » mène à Accueil des campagnes
    Given I am on "soundbox"
    When I click "menu-campagnes"
    Then I see the page "campagnes"

  @G-soundbox.menu-medias @generated @journey
  Scenario: Depuis Soundbox, « Médias » mène à Médias et réglage de battlemap
    Given I am on "soundbox"
    When I click "menu-medias"
    Then I see the page "medias"

  @G-soundbox.menu-soundbox @generated @journey
  Scenario: Depuis Soundbox, « Soundbox » mène à Soundbox
    Given I am on "soundbox"
    When I click "menu-soundbox"
    Then I see the page "soundbox"

  @G-soundbox.menu-parametres-ia @generated @journey
  Scenario: Depuis Soundbox, « Paramètres IA » mène à Paramètres IA
    Given I am on "soundbox"
    When I click "menu-parametres-ia"
    Then I see the page "parametres-ia"

  @G-dm-view.site-menu @generated @journey @page:dm-view @el:site-menu
  Scenario: DM view montre le menu du site
    Given I am on "dm-view"
    Then I see "site-menu"

  @G-dm-view.menu-campagnes @generated @journey
  Scenario: Depuis DM view, « Campagnes » mène à Accueil des campagnes
    Given I am on "dm-view"
    When I click "menu-campagnes"
    Then I see the page "campagnes"

  @G-dm-view.menu-medias @generated @journey
  Scenario: Depuis DM view, « Médias » mène à Médias et réglage de battlemap
    Given I am on "dm-view"
    When I click "menu-medias"
    Then I see the page "medias"

  @G-dm-view.menu-soundbox @generated @journey
  Scenario: Depuis DM view, « Soundbox » mène à Soundbox
    Given I am on "dm-view"
    When I click "menu-soundbox"
    Then I see the page "soundbox"

  @G-dm-view.menu-parametres-ia @generated @journey
  Scenario: Depuis DM view, « Paramètres IA » mène à Paramètres IA
    Given I am on "dm-view"
    When I click "menu-parametres-ia"
    Then I see the page "parametres-ia"

  @G-dm-view.live-session-bar-to-player-view @generated @journey
  Scenario: Depuis DM view, « Vers Player view » mène à Player view
    Given I am on "dm-view"
    When I click "live-session-bar-to-player-view"
    Then I see the page "player-view"

  @G-dm-view.live-session-bar-to-campagne @generated @journey
  Scenario: Depuis DM view, « Vers Campagne » mène à Campagne
    Given I am on "dm-view"
    When I click "live-session-bar-to-campagne"
    Then I see the page "campagne"

  @G-dm-view.table-sheet-to-fiche-entite @generated @journey
  Scenario: Depuis DM view, « Vers Fiche d’entité » mène à Fiche d’entité
    Given I am on "dm-view"
    When I click "table-sheet-to-fiche-entite"
    Then I see the page "fiche-entite"

  @G-player-view.site-menu @generated @journey @page:player-view @el:site-menu
  Scenario: Player view montre le menu du site
    Given I am on "player-view"
    Then I see "site-menu"

  @G-error.site-menu @generated @journey @page:error @el:site-menu
  Scenario: Page introuvable montre le menu du site
    Given I am on "error"
    Then I see "site-menu"

  @G-error.menu-campagnes @generated @journey
  Scenario: Depuis Page introuvable, « Campagnes » mène à Accueil des campagnes
    Given I am on "error"
    When I click "menu-campagnes"
    Then I see the page "campagnes"

  @G-error.error-back @generated @journey
  Scenario: Depuis Page introuvable, « Retour aux campagnes » mène à Accueil des campagnes
    Given I am on "error"
    When I click "error-back"
    Then I see the page "campagnes"
