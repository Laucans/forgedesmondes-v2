@base @journey
Feature: Base pack
  What every product keeps, written by the harness: the site menu on every page, the
  error page, empty states and the actions a role may not trigger. A step naming
  "..." is a placeholder the rules' task replaces.

  @B-dm-menu-campagnes
  Scenario: Le menu mène dm à Accueil des campagnes
    Given I am a "dm"
    And I am on "campagnes"
    When I click "menu-campagnes"
    Then I see the page "campagnes"
    And I see "site-menu"

  @B-dm-menu-parametres-ia
  Scenario: Le menu mène dm à Paramètres IA
    Given I am a "dm"
    And I am on "campagnes"
    When I click "menu-parametres-ia"
    Then I see the page "parametres-ia"
    And I see "site-menu"

  @B-dm-on-campagne
  Scenario: Campagne montre le menu à dm
    Given I am a "dm"
    And I am on "campagne"
    Then I see "site-menu"

  @B-dm-on-fiche-entite
  Scenario: Fiche d’entité montre le menu à dm
    Given I am a "dm"
    And I am on "fiche-entite"
    Then I see "site-menu"

  @B-dm-on-preparation-seance
  Scenario: Préparation de séance montre le menu à dm
    Given I am a "dm"
    And I am on "preparation-seance"
    Then I see "site-menu"

  @B-dm-menu-medias
  Scenario: Le menu mène dm à Médias et réglage de battlemap
    Given I am a "dm"
    And I am on "campagnes"
    When I click "menu-medias"
    Then I see the page "medias"
    And I see "site-menu"

  @B-dm-menu-soundbox
  Scenario: Le menu mène dm à Soundbox
    Given I am a "dm"
    And I am on "campagnes"
    When I click "menu-soundbox"
    Then I see the page "soundbox"
    And I see "site-menu"

  @B-dm-error
  Scenario: Une adresse inconnue montre la page d'erreur à dm
    Given I am a "dm"
    And I am on "no-such-page"
    Then I see the page "error"
    And I see "site-menu"

  @B-player-error
  Scenario: Une adresse inconnue montre la page d'erreur à player
    Given I am a "player"
    And I am on "no-such-page"
    Then I see the page "error"
    And I see "site-menu"
