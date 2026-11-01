Feature: Accueil des campagnes, création, export et import
  Le maître du jeu voit ses campagnes et oneshots avec leur couverture, en crée,
  exporte une archive et l'importe en nouvelle copie.

  @R1 @journey @role:dm @page:campagnes @el:site-menu @el:campaign-list @el:campaign-cards @el:campaign-count @el:campaign-open @el:campaign-export @el:campaign-new @el:campaign-to-import
  Scenario: Le maître du jeu voit l'accueil avec ses campagnes et ses oneshots
    Given I am a "dm"
    And I am on "campagnes"
    Then I see "campaign-cards"
    And I see the text "Le Val Maudit"
    And I see the text "La Nuit du Phare"
    And I see "campaign-count"
    And I see "campaign-open"
    And I see "campaign-export"
    And I see "campaign-new"
    And I see "campaign-to-import"

  @R2 @business @role:dm @page:campagnes @el:campaign-new @el:campaign-new-dialog @el:campaign-new-name @el:campaign-new-pitch @el:campaign-create
  Scenario: Le maître du jeu crée une campagne
    Given I am a "dm"
    And I am on "campagnes"
    When I click "campaign-new"
    And I fill "campaign-new-name" with "Les Marais Gris"
    And I fill "campaign-new-pitch" with "Un marais qui avale les voyageurs."
    And I click "campaign-create"
    Then there is a "campaign" with name "Les Marais Gris" and kind "campagne"
    And I see the text "Les Marais Gris"

  @R3 @business @role:dm @page:campagnes @el:campaign-new @el:campaign-new-name @el:campaign-new-oneshot @el:campaign-create
  Scenario: Un oneshot est créé avec sa séance unique
    Given I am a "dm"
    And I am on "campagnes"
    When I click "campaign-new"
    And I fill "campaign-new-name" with "Le Banquet Truqué"
    And I click "campaign-new-oneshot"
    And I click "campaign-create"
    Then there is a "campaign" with name "Le Banquet Truqué" and kind "oneshot"
    And there is a "session" with title "Le Banquet Truqué" and position "1"

  @R4 @business @role:dm @page:campagnes @el:campaign-new @el:campaign-create
  Scenario: Une campagne sans nom est refusée
    Given I am a "dm"
    And I am on "campagnes"
    When I click "campaign-new"
    And I click "campaign-create"
    Then the command "campaign.createCampaign" is refused because "Donnez un nom à la campagne."

  @R5 @business @role:dm @page:campagnes @el:campaign-new @el:campaign-new-name @el:campaign-create
  Scenario: Une campagne au nom déjà pris est refusée
    Given I am a "dm"
    And I am on "campagnes"
    When I click "campaign-new"
    And I fill "campaign-new-name" with "Le Val Maudit"
    And I click "campaign-create"
    Then the command "campaign.createCampaign" is refused because "Une campagne porte déjà ce nom."

  @R6 @business @role:dm @page:campagnes @el:campaign-cards @el:campaign-export
  Scenario: L'export depuis l'accueil ne modifie rien d'autre que la date d'export
    Given I am a "dm"
    And I am on "campagnes"
    When I select "La Nuit du Phare" in "campaign-cards"
    And I click "campaign-export"
    Then the "campaign" with name "La Nuit du Phare" has kind "oneshot"
    And the "campaign" with name "La Nuit du Phare" has pitch "Une tempête, un phare éteint, et quelqu’un qui ne veut pas qu’on le rallume."

  @R7 @business @role:dm @page:campagnes @el:campaign-to-import @el:campaign-import-dialog @el:campaign-archive @el:campaign-import
  Scenario: L'import crée toujours une nouvelle copie sans toucher l'originale
    Given I am a "dm"
    And I am on "campagnes"
    When I click "campaign-to-import"
    And I fill "campaign-archive" with "archive.zip"
    And I click "campaign-import"
    Then there is a "campaign" with name "Le Val Maudit (copie importée)"
    And the "campaign" with name "Le Val Maudit" has kind "campagne"
    And the "campaign" with name "Le Val Maudit" has glyph "VM"

  @R8 @business @role:dm @page:campagnes @el:campaign-to-import @el:campaign-import
  Scenario: Un import sans archive est refusé
    Given I am a "dm"
    And I am on "campagnes"
    When I click "campaign-to-import"
    And I click "campaign-import"
    Then the command "campaign.importCampaign" is refused because "Choisissez une archive à importer."

  @R9 @journey @role:dm @page:campagne @el:crumb-campagnes @el:campaign-overview @el:overview-campaign @el:overview-last-export @el:overview-export @el:overview-counts @el:overview-to-preparation @el:overview-to-dm-view @el:overview-back
  Scenario: Le maître du jeu ouvre une campagne et voit son aperçu
    Given I am a "dm"
    And I am on "campagnes"
    When I select "Le Val Maudit" in "campaign-cards"
    And I click "campaign-open"
    Then I see the page "campagne"
    And I see "campaign-overview"
    And I see "overview-campaign"
    And I see the text "Le Val Maudit"
    And I see "overview-last-export"
    And I see "overview-export"
    And I see "overview-counts"
    And I see "overview-to-preparation"
    And I see "overview-to-dm-view"
    And I see "overview-back"
    And I see "crumb-campagnes"

  @R10 @business @role:dm @page:campagne @el:overview-export
  Scenario: L'export depuis l'aperçu ne modifie que la date d'export
    Given I am a "dm"
    And I am on "campagnes"
    When I select "Les Cendres d’Arkhos" in "campaign-cards"
    And I click "campaign-open"
    And I click "overview-export"
    Then I see the page "campagne"
    And the "campaign" with name "Les Cendres d’Arkhos" has kind "campagne"

  @R11 @journey @role:dm @page:error @el:site-menu @el:error-back
  Scenario: La page d'erreur ramène aux campagnes
    Given I am a "dm"
    And I am on "no-such-page"
    Then I see the page "error"
    And I see "error-back"

  @R12 @journey @role:dm @page:campagnes @el:campaign-search
  Scenario: Le maître du jeu recherche une campagne par son nom
    Given I am a "dm"
    And I am on "campagnes"
    When I fill "campaign-search" with "Phare"
    Then I see the text "La Nuit du Phare"

  @R13 @journey @role:dm @page:campagnes @el:campaign-filter
  Scenario: Le maître du jeu filtre les campagnes par type
    Given I am a "dm"
    And I am on "campagnes"
    When I select "Oneshot" in "campaign-filter"
    Then I see the text "La Nuit du Phare"

  @R14 @journey @role:dm @page:campagnes @el:campaign-empty-new @el:campaign-new-dialog @el:campaign-new-name
  Scenario: Sans campagne, l'accueil propose d'en créer une
    Given I am a "dm"
    And there is no "campaign_overview_view"
    And I am on "campagnes"
    When I click "campaign-empty-new"
    Then I see "campaign-new-name"
