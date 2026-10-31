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

  @B-dm-on-dm-view
  Scenario: DM view montre le menu à Maître du jeu
    Given I am a "dm"
    And I am on "dm-view"
    Then I see "site-menu"

  @B-dm-on-player-view
  Scenario: Player view montre le menu à Maître du jeu
    Given I am a "dm"
    And I am on "player-view"
    Then I see "site-menu"

  @B-dm-on-error
  Scenario: Page introuvable montre le menu à Maître du jeu
    Given I am a "dm"
    And I am on "error"
    Then I see "site-menu"

  @B-empty-campagnes.campaign-cards
  Scenario: Les campagnes et oneshots vide sur Accueil des campagnes le dit
    Given I am a "dm"
    And there is no "campaign" with kind "campagne"
    And there is no "campaign" with kind "oneshot"
    And I am on "campagnes"
    Then I see "campaign-cards"
    And I see the text "Aucune campagne pour l’instant : créez-en une ou importez une archive."

  @B-empty-campagne.overview-card
  Scenario: La campagne ouverte vide sur Campagne le dit
    Given I am a "dm"
    And there is no "campaign" with kind "campagne"
    And there is no "campaign" with kind "oneshot"
    And I am on "campagne"
    Then I see "overview-card"
    And I see the text "Campagne introuvable."

  @B-empty-campagne.overview-counts
  Scenario: Résumé chiffré des éléments vide sur Campagne le dit
    Given I am a "dm"
    And there is no "campaign_overview_view" with campaign_id "6f1c2a3e-8b4d-4c1e-9a7f-1d2e3f4a5b6c"
    And there is no "campaign_overview_view" with campaign_id "a2b7d9e0-3c4f-4e8a-b1d2-7c8e9f0a1b2c"
    And there is no "campaign_overview_view" with campaign_id "d4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f70"
    And I am on "campagne"
    Then I see "overview-counts"
    And I see the text "Rien encore dans cette campagne."

  @B-player-on-error
  Scenario: Page introuvable montre le menu à Joueur
    Given I am a "player"
    And I am on "error"
    Then I see "site-menu"
