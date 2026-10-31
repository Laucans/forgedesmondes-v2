Feature: Campaign home — list, create, export and import
  The DM sees campaigns and oneshots with their covers, creates one, opens it, exports it as an
  archive and imports an archive as a new copy.

  @R1 @journey @role:dm @page:campagnes @el:campaign-list @el:campagnes-title @el:campaign-cards @el:campaign-cover @el:campaign-name @el:campaign-kind @el:campaign-pitch
  Scenario: The home lists campaigns and oneshots with cover, name, type and pitch
    Given I am a "dm"
    And I am on "campagnes"
    Then I see "campaign-list"
    And I see "campagnes-title"
    And I see "campaign-cards"
    And I see "campaign-cover"
    And I see "campaign-name"
    And I see "campaign-kind"
    And I see "campaign-pitch"
    And I see the text "La Couronne de Cendres"
    And I see the text "La Nuit du Phare"
    And I see the text "oneshot"

  @R2 @journey @role:dm @page:campagnes @el:create-campaign-form @el:campaign-name-input @el:campaign-kind-select @el:campaign-pitch-input @el:campaign-list-create-campaign
  Scenario: The DM creates a campaign
    Given I am a "dm"
    And I am on "campagnes"
    And I see "create-campaign-form"
    When I fill "campaign-name-input" with "Les Marais Rouges"
    And I select "Campagne (plusieurs séances)" in "campaign-kind-select"
    And I fill "campaign-pitch-input" with "Un marais où la brume avale les voyageurs."
    And I click "campaign-list-create-campaign"
    Then there is a "campaign" with name "Les Marais Rouges" and kind "campagne"
    And I see the text "Les Marais Rouges"

  @R3 @journey @role:dm @page:campagnes @el:campaign-name-input @el:campaign-kind-select @el:campaign-list-create-campaign
  Scenario: The DM creates a oneshot, which gets exactly one session
    Given I am a "dm"
    And I am on "campagnes"
    When I fill "campaign-name-input" with "L'Auberge du Corbeau"
    And I select "Oneshot (une seule séance)" in "campaign-kind-select"
    And I click "campaign-list-create-campaign"
    Then there is a "campaign" with name "L'Auberge du Corbeau" and kind "oneshot"
    And there is a "session" with title "L'Auberge du Corbeau" and position "1"

  @R4 @business @role:dm @page:campagnes @el:campaign-name-input @el:campaign-list-create-campaign
  Scenario: A campaign without a name is refused
    Given I am a "dm"
    And I am on "campagnes"
    When I click "campaign-list-create-campaign"
    Then the command "campaign.createCampaign" is refused because "le nom de la campagne est obligatoire"

  @R5 @journey @role:dm @page:campagne @page:campagnes @el:campaign-list-to-campagne @el:overview-card @el:overview-cover @el:overview-name @el:overview-kind @el:overview-pitch @el:overview-last-export @el:overview-counts @el:campaign-overview
  Scenario: Opening a campaign shows its overview
    Given I am a "dm"
    And I am on "campagnes"
    When I select "Le Val Maudit" in "campaign-cards"
    And I click "campaign-list-to-campagne"
    Then I see the page "campagne"
    And I see "campaign-overview"
    And I see "overview-card"
    And I see "overview-cover"
    And I see "overview-name"
    And I see "overview-kind"
    And I see "overview-pitch"
    And I see "overview-last-export"
    And I see "overview-counts"
    And I see the text "Le Val Maudit"
    And I see the text "3 joueurs · 3 PJ · 5 PNJ"

  @R6 @business @role:dm @page:campagnes @page:campagne @el:campaign-overview-export-campaign
  Scenario: Export stamps last_exported_at
    Given I am a "dm"
    And I am on "campagnes"
    When I select "Le Val Maudit" in "campaign-cards"
    And I click "campaign-list-to-campagne"
    And I click "campaign-overview-export-campaign"
    Then I see the page "campagne"
    And I see the text "Dernier export : 20"

  @R7 @business @role:dm @page:campagnes @el:import-campaign-form @el:import-campaign-hint @el:import-archive-input @el:campaign-list-import-campaign
  Scenario: Import always creates a new copy and leaves the original untouched
    Given I am a "dm"
    And I am on "campagnes"
    Then I see "import-campaign-form"
    And I see "import-campaign-hint"
    And I see the text "L’import crée toujours une nouvelle copie"
    When I fill "import-archive-input" with "{\"campaign\":{\"id\":\"a2b7d9e0-3c4f-4e8a-b1d2-7c8e9f0a1b2c\",\"name\":\"Le Val Maudit (copie)\",\"kind\":\"campagne\",\"pitch\":\"Une copie.\",\"sound_master_volume\":1}}"
    And I click "campaign-list-import-campaign"
    Then there is a "campaign" with name "Le Val Maudit (copie)" and kind "campagne"
    And the "campaign" with name "Le Val Maudit" has pitch "Une vallée où les morts reviennent chaque nuit de pleine lune."
    And the "campaign" with name "Le Val Maudit (copie)" has origin_campaign_id "a2b7d9e0-3c4f-4e8a-b1d2-7c8e9f0a1b2c"

  @R8 @business @role:dm @page:campagnes @el:import-archive-input @el:campaign-list-import-campaign
  Scenario: An archive that is not a campaign is refused
    Given I am a "dm"
    And I am on "campagnes"
    When I fill "import-archive-input" with "pas une archive"
    And I click "campaign-list-import-campaign"
    Then the command "campaign.importCampaign" is refused because "l’archive n’est pas un fichier d’export valide"

  @R9 @business @role:dm @page:campagnes @el:import-archive-input @el:campaign-list-import-campaign
  Scenario: An archive with a master volume out of range is refused
    Given I am a "dm"
    And I am on "campagnes"
    When I fill "import-archive-input" with "{\"campaign\":{\"name\":\"Trop fort\",\"kind\":\"campagne\",\"sound_master_volume\":3}}"
    And I click "campaign-list-import-campaign"
    Then the command "campaign.importCampaign" is refused because "le volume global doit rester entre 0 et 1"
    And there is no "campaign" with name "Trop fort"

  @R10 @journey @role:dm @page:campagnes @page:campagne @el:site-menu @el:menu-campagnes @el:menu-medias @el:menu-soundbox @el:menu-parametres-ia
  Scenario: The site menu offers the four sections on the home
    Given I am a "dm"
    And I am on "campagnes"
    Then I see "site-menu"
    And I see "menu-campagnes"
    And I see "menu-medias"
    And I see "menu-soundbox"
    And I see "menu-parametres-ia"

  @R11 @journey @role:dm @page:error @el:error-title @el:error-message @el:error-back @el:menu-campagnes
  Scenario: The error page explains and leads back to the home
    Given I am a "dm"
    And I am on "no-such-page"
    Then I see the page "error"
    And I see "error-title"
    And I see "error-message"
    And I see "menu-campagnes"
    When I click "error-back"
    Then I see the page "campagnes"

  @R12 @journey @role:dm @page:parametres-ia @el:ai-settings @el:ai-settings-save-settings @el:ai-settings-test-connection
  Scenario: Paramètres IA shows its blocks and actions
    Given I am a "dm"
    And I am on "parametres-ia"
    Then I see "ai-settings"
    Then I see "ai-settings-save-settings"
    Then I see "ai-settings-test-connection"

  @R13 @journey @role:dm @page:campagne @el:session-list @el:session-list-create-session @el:campaign-elements @el:to-create-list @el:to-create-list-create-from-brief @el:note-import @el:note-import-extract-from-notes @el:note-import-create-entities-from-note
  Scenario: Campagne shows its blocks and actions
    Given I am a "dm"
    And I am on "campagne"
    Then I see "session-list"
    Then I see "session-list-create-session"
    Then I see "campaign-elements"
    Then I see "to-create-list"
    Then I see "to-create-list-create-from-brief"
    Then I see "note-import"
    Then I see "note-import-extract-from-notes"
    Then I see "note-import-create-entities-from-note"

  @R14 @journey @role:dm @page:fiche-entite @el:campaign-elements @el:version-history @el:version-history-restore-entity-version @el:entity-editor @el:entity-editor-save-entity @el:entity-editor-propose-character @el:entity-editor-import-character @el:entity-editor-resync-character
  Scenario: Fiche d’entité shows its blocks and actions
    Given I am a "dm"
    And I am on "fiche-entite"
    Then I see "campaign-elements"
    Then I see "version-history"
    Then I see "version-history-restore-entity-version"
    Then I see "entity-editor"
    Then I see "entity-editor-save-entity"
    Then I see "entity-editor-propose-character"
    Then I see "entity-editor-import-character"
    Then I see "entity-editor-resync-character"

  @R15 @journey @role:dm @page:preparation-seance @el:previous-summary @el:oral-brief @el:oral-brief-analyze-brief @el:scene-board @el:scene-board-add-present-character @el:scene-board-remove-present-character @el:scene-board-add-scene @el:scene-board-reorder-scenes @el:scene-board-update-scene-notes @el:scene-board-create-battlemap-instance @el:version-history @el:version-history-restore-entity-version @el:to-create-list @el:to-create-list-create-from-brief @el:battlemap @el:battlemap-move-token @el:battlemap-place-tokens @el:battlemap-remove-token @el:battlemap-rename-token @el:battlemap-set-token-visibility @el:battlemap-set-token-condition @el:battlemap-show-on-player-view @el:battlemap-change-hit-points @el:battlemap-start-combat @el:battlemap-next-turn @el:battlemap-reorder-initiative @el:battlemap-add-participant @el:battlemap-remove-participant @el:battlemap-end-combat @el:battlemap-reset-battlemap
  Scenario: Préparation de séance shows its blocks and actions
    Given I am a "dm"
    And I am on "preparation-seance"
    Then I see "previous-summary"
    Then I see "oral-brief"
    Then I see "oral-brief-analyze-brief"
    Then I see "scene-board"
    Then I see "scene-board-add-present-character"
    Then I see "scene-board-remove-present-character"
    Then I see "scene-board-add-scene"
    Then I see "scene-board-reorder-scenes"
    Then I see "scene-board-update-scene-notes"
    Then I see "scene-board-create-battlemap-instance"
    Then I see "version-history"
    Then I see "version-history-restore-entity-version"
    Then I see "to-create-list"
    Then I see "to-create-list-create-from-brief"
    Then I see "battlemap"
    Then I see "battlemap-move-token"
    Then I see "battlemap-place-tokens"
    Then I see "battlemap-remove-token"
    Then I see "battlemap-rename-token"
    Then I see "battlemap-set-token-visibility"
    Then I see "battlemap-set-token-condition"
    Then I see "battlemap-show-on-player-view"
    Then I see "battlemap-change-hit-points"
    Then I see "battlemap-start-combat"
    Then I see "battlemap-next-turn"
    Then I see "battlemap-reorder-initiative"
    Then I see "battlemap-add-participant"
    Then I see "battlemap-remove-participant"
    Then I see "battlemap-end-combat"
    Then I see "battlemap-reset-battlemap"

  @R16 @journey @role:dm @page:medias @el:media-library @el:media-library-upload-media @el:media-library-set-media-place @el:media-library-add-place-to-session @el:grid-settings @el:grid-settings-save-grid-settings
  Scenario: Médias et réglage de battlemap shows its blocks and actions
    Given I am a "dm"
    And I am on "medias"
    Then I see "media-library"
    Then I see "media-library-upload-media"
    Then I see "media-library-set-media-place"
    Then I see "media-library-add-place-to-session"
    Then I see "grid-settings"
    Then I see "grid-settings-save-grid-settings"

  @R17 @journey @role:dm @page:soundbox @el:sound-library @el:sound-library-add-sound @el:sound-library-update-sound @el:sound-library-remove-sound @el:live-soundbox @el:live-soundbox-play-sound @el:live-soundbox-stop-all @el:live-soundbox-set-sound-volume @el:live-soundbox-set-master-volume
  Scenario: Soundbox shows its blocks and actions
    Given I am a "dm"
    And I am on "soundbox"
    Then I see "sound-library"
    Then I see "sound-library-add-sound"
    Then I see "sound-library-update-sound"
    Then I see "sound-library-remove-sound"
    Then I see "live-soundbox"
    Then I see "live-soundbox-play-sound"
    Then I see "live-soundbox-stop-all"
    Then I see "live-soundbox-set-sound-volume"
    Then I see "live-soundbox-set-master-volume"

  @R18 @journey @role:dm @page:dm-view @el:live-session-bar @el:live-session-bar-show-cover @el:live-session-bar-close-window @el:live-session-bar-close-session @el:elements-panel @el:elements-panel-show-on-player-view @el:elements-panel-show-window-on-player-view @el:table-sheet @el:table-sheet-show-on-player-view @el:table-sheet-show-window-on-player-view @el:battlemap @el:battlemap-move-token @el:battlemap-place-tokens @el:battlemap-remove-token @el:battlemap-rename-token @el:battlemap-set-token-visibility @el:battlemap-set-token-condition @el:battlemap-show-on-player-view @el:battlemap-change-hit-points @el:battlemap-start-combat @el:battlemap-next-turn @el:battlemap-reorder-initiative @el:battlemap-add-participant @el:battlemap-remove-participant @el:battlemap-end-combat @el:battlemap-reset-battlemap @el:live-soundbox @el:live-soundbox-play-sound @el:live-soundbox-stop-all @el:live-soundbox-set-sound-volume @el:live-soundbox-set-master-volume @el:suggestion-pill @el:suggestion-pill-set-microphone @el:suggestion-pill-play-sound
  Scenario: DM view shows its blocks and actions
    Given I am a "dm"
    And I am on "dm-view"
    Then I see "live-session-bar"
    Then I see "live-session-bar-show-cover"
    Then I see "live-session-bar-close-window"
    Then I see "live-session-bar-close-session"
    Then I see "elements-panel"
    Then I see "elements-panel-show-on-player-view"
    Then I see "elements-panel-show-window-on-player-view"
    Then I see "table-sheet"
    Then I see "table-sheet-show-on-player-view"
    Then I see "table-sheet-show-window-on-player-view"
    Then I see "battlemap"
    Then I see "battlemap-move-token"
    Then I see "battlemap-place-tokens"
    Then I see "battlemap-remove-token"
    Then I see "battlemap-rename-token"
    Then I see "battlemap-set-token-visibility"
    Then I see "battlemap-set-token-condition"
    Then I see "battlemap-show-on-player-view"
    Then I see "battlemap-change-hit-points"
    Then I see "battlemap-start-combat"
    Then I see "battlemap-next-turn"
    Then I see "battlemap-reorder-initiative"
    Then I see "battlemap-add-participant"
    Then I see "battlemap-remove-participant"
    Then I see "battlemap-end-combat"
    Then I see "battlemap-reset-battlemap"
    Then I see "live-soundbox"
    Then I see "live-soundbox-play-sound"
    Then I see "live-soundbox-stop-all"
    Then I see "live-soundbox-set-sound-volume"
    Then I see "live-soundbox-set-master-volume"
    Then I see "suggestion-pill"
    Then I see "suggestion-pill-set-microphone"
    Then I see "suggestion-pill-play-sound"

  @R19 @journey @role:dm @page:player-view @el:player-stage @el:player-stage-move-window @el:player-stage-resize-window @el:battlemap @el:battlemap-move-token @el:battlemap-place-tokens @el:battlemap-remove-token @el:battlemap-rename-token @el:battlemap-set-token-visibility @el:battlemap-set-token-condition @el:battlemap-show-on-player-view @el:battlemap-change-hit-points @el:battlemap-start-combat @el:battlemap-next-turn @el:battlemap-reorder-initiative @el:battlemap-add-participant @el:battlemap-remove-participant @el:battlemap-end-combat @el:battlemap-reset-battlemap
  Scenario: Player view shows its blocks and actions
    Given I am a "dm"
    And I am on "player-view"
    Then I see "player-stage"
    Then I see "player-stage-move-window"
    Then I see "player-stage-resize-window"
    Then I see "battlemap"
    Then I see "battlemap-move-token"
    Then I see "battlemap-place-tokens"
    Then I see "battlemap-remove-token"
    Then I see "battlemap-rename-token"
    Then I see "battlemap-set-token-visibility"
    Then I see "battlemap-set-token-condition"
    Then I see "battlemap-show-on-player-view"
    Then I see "battlemap-change-hit-points"
    Then I see "battlemap-start-combat"
    Then I see "battlemap-next-turn"
    Then I see "battlemap-reorder-initiative"
    Then I see "battlemap-add-participant"
    Then I see "battlemap-remove-participant"
    Then I see "battlemap-end-combat"
    Then I see "battlemap-reset-battlemap"
