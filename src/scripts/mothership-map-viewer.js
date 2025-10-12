/**
 * Mothership Map Viewer for Foundry VTT
 * Displays maps created with the Mothership Map Creator tool
 */

import { BaseMapRenderer } from "./base-map-renderer.js";
import { decodeShareString } from "./utils.js";

// Socket handler for syncing map data to players
class MothershipMapSocketHandler {
  constructor() {
    this.identifier = "module.mothership-map-viewer";
    this.registerSocketListeners();
    console.log("Mothership Map Viewer | Socket handler initialized");
  }

  registerSocketListeners() {
    game.socket.on(this.identifier, ({ type, payload }) => {
      switch (type) {
        case "displayMap":
          this.#onDisplayMap(payload);
          break;
        case "updateMap":
          this.#onUpdateMap(payload);
          break;
        case "closeMap":
          this.#onCloseMap();
          break;
        case "playerViewStatus":
          this.#onPlayerViewStatus(payload);
          break;
        default:
          throw new Error("unknown type");
      }
    });
  }

  emit(type, payload) {
    return game.socket.emit(this.identifier, { type, payload });
  }

  #onDisplayMap(payload) {
    if (game.user.isGM) return;
    // payload can be either { mapId, mapData } or just mapData (legacy)
    const mapData = payload.mapData || payload;
    const mapId = payload.mapId || null;
    const instance = PlayerMapDisplay.getInstance({ mapData, mapId });
    instance.render(true);
  }

  #onUpdateMap(payload) {
    if (game.user.isGM) return;
    // payload can be either { mapId, mapData } or just mapData (legacy)
    const mapData = payload.mapData || payload;
    const mapId = payload.mapId || null;
    const app = PlayerMapDisplay.getInstance();
    if (app) {
      app.mapData = mapData;
      app.mapId = mapId;
      app.render();
    }
  }

  #onCloseMap() {
    if (game.user.isGM) return;
    const app = PlayerMapDisplay.getInstance();
    if (app) app.close();
  }

  #onPlayerViewStatus(payload) {
    if (!game.user.isGM) return;
    const gmViewer = MothershipMapViewer._instance;
    if (gmViewer) {
      gmViewer.updatePlayerViewStatus(
        payload.userId,
        payload.status,
        payload.mapId
      );
    }
  }
}

// Player Map Display (read-only)
class PlayerMapDisplay extends BaseMapRenderer {
  static _instance = null;
  constructor(
    options = {
      mapData: null,
      mapId: null,
    }
  ) {
    super(options);
    if (options.mapData) {
      this.mapData = options.mapData;
    }
    this.mapId = options.mapId || null;

    PlayerMapDisplay._instance = this;
  }

  static DEFAULT_OPTIONS = {
    tag: "div",
    window: {
      title: "MOTHERSHIP_MAP_VIEWER.PlayerMapTitle",
      resizable: true,
    },
    position: { width: 1000, height: 900 },
    classes: ["mothership-player-map"],
  };

  static PARTS = {
    main: {
      template: "modules/mothership-map-viewer/templates/player-map.hbs",
    },
  };

  static getInstance(options) {
    // If an instance exists and is rendered, bring it to focus
    if (PlayerMapDisplay._instance && PlayerMapDisplay._instance.rendered) {
      PlayerMapDisplay._instance.bringToFront();
      return PlayerMapDisplay._instance;
    }
    // Otherwise create a new instance
    return new PlayerMapDisplay(options);
  }

  getCanvasId() {
    return "player-map-canvas";
  }

  _prepareContext() {
    return {
      hasMap: this.mapData !== null,
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    if (this.mapData) {
      const canvas = document.getElementById(this.getCanvasId());
      if (canvas) {
        this._setupCanvasResize(canvas);
        this._setupCanvasDragScroll(canvas);
        this._setupCanvasZoom(canvas);
        this._renderMap(canvas);
      }
    }

    // Notify GM that this player has opened the map
    this._notifyViewStatus("opened");
  }

  _notifyViewStatus(status) {
    if (game.user.isGM) return;
    game.modules
      .get("mothership-map-viewer")
      .socketHandler.emit("playerViewStatus", {
        userId: game.user.id,
        status: status,
        mapId: this.mapId,
      });
  }

  async close(options = {}) {
    // Notify GM that this player has closed the map
    this._notifyViewStatus("closed");

    return super.close(options);
  }
}

// GM Map Viewer with controls
class MothershipMapViewer extends BaseMapRenderer {
  static _instance = null;
  constructor(options = {}) {
    super(options);

    // Multi-map support
    this.maps = []; // Array of { id, name, mapData, activeViewers: Set() }
    this.currentMapId = null;
    this.nextMapId = 1;

    // Legacy support - will be removed once migration is complete
    this.mapData = null;
    this.activeViewers = new Set();
    this.mapShownToPlayers = false;

    MothershipMapViewer._instance = this;
  }

  static getInstance(options) {
    // If an instance exists and is rendered, bring it to focus
    if (
      MothershipMapViewer._instance &&
      MothershipMapViewer._instance.rendered
    ) {
      MothershipMapViewer._instance.bringToTop();
      return MothershipMapViewer._instance;
    }
    // Otherwise create a new instance
    return new MothershipMapViewer(options);
  }

  getCanvasId() {
    return "map-canvas";
  }

  // Helper methods for multi-map management
  _generateMapId() {
    return `map-${this.nextMapId++}`;
  }

  _addMap(mapData, mapName = null) {
    const id = this._generateMapId();
    const name = mapName || mapData.mapName || `Map ${this.maps.length + 1}`;
    const map = {
      id,
      name,
      mapData,
      activeViewers: new Set(),
    };
    this.maps.push(map);
    return id;
  }

  _getCurrentMap() {
    if (!this.currentMapId) return null;
    return this.maps.find((m) => m.id === this.currentMapId);
  }

  _setCurrentMap(mapId) {
    const map = this.maps.find((m) => m.id === mapId);
    if (map) {
      this.currentMapId = mapId;
      // Update legacy properties for backward compatibility
      this.mapData = map.mapData;
      this.activeViewers = map.activeViewers;
      return true;
    }
    return false;
  }

  _deleteMap(mapId) {
    const index = this.maps.findIndex((m) => m.id === mapId);
    if (index !== -1) {
      // Close player views for this map
      const map = this.maps[index];
      if (map.activeViewers.size > 0) {
        game.modules
          .get("mothership-map-viewer")
          .socketHandler.emit("closeMap", { mapId });
      }

      this.maps.splice(index, 1);

      // If we deleted the current map, switch to another or clear
      if (this.currentMapId === mapId) {
        if (this.maps.length > 0) {
          this._setCurrentMap(this.maps[0].id);
        } else {
          this.currentMapId = null;
          this.mapData = null;
          this.activeViewers = new Set();
        }
      }
      return true;
    }
    return false;
  }

  static DEFAULT_OPTIONS = {
    tag: "div",
    id: "mothership-map-viewer",
    window: {
      title: "MOTHERSHIP_MAP_VIEWER.Title",
      resizable: true,
    },
    position: { width: 900, height: 900 },
    classes: ["mothership-map-viewer"],
    actions: {
      onBugReport: MothershipMapViewer.onBugReport,
      onFeedback: MothershipMapViewer.onFeedback,
      onDiscord: MothershipMapViewer.onDiscord,
      onGoToMapCreator: MothershipMapViewer.onGoToMapCreator,
      onGoToCommunityMaps: MothershipMapViewer.onGoToCommunityMaps,
    },
  };

  static onBugReport() {
    window.open(
      "https://github.com/EddieDover/mothership-map-viewer/issues/new?template=bug_report.yaml",
      "_blank"
    );
  }

  static onFeedback() {
    window.open(
      "https://github.com/EddieDover/mothership-map-viewer/issues/new",
      "_blank"
    );
  }

  static onDiscord() {
    window.open("https://discord.gg/hshfZA73fG", "_blank");
  }

  static onGoToMapCreator() {
    window.open("https://eddiedover.github.io/mothership-map-viewer", "_blank");
  }

  static onGoToCommunityMaps() {
    window.open(
      "https://github.com/EddieDover/mothership-map-viewer/wiki/Map-Share-Strings",
      "_blank"
    );
  }

  static PARTS = {
    main: {
      template: "modules/mothership-map-viewer/templates/map-viewer.hbs",
    },
  };

  _prepareContext() {
    const currentMap = this._getCurrentMap();
    return {
      mapData: this.mapData,
      hasMap: this.mapData !== null,
      maps: this.maps,
      currentMapId: this.currentMapId,
      hasMultipleMaps: this.maps.length > 0,
      currentMapName: currentMap ? currentMap.name : null,
    };
  }

  // eslint-disable-next-line no-unused-vars
  async _onRender(context, options) {
    // Import buttons
    document
      .getElementById("import-json-btn")
      .addEventListener("click", () => this._onImportJSON());
    document
      .getElementById("import-share-btn")
      .addEventListener("click", () => this._onImportShareString());

    // Map selector
    const mapSelector = document.getElementById("map-selector-dropdown");
    if (mapSelector) {
      mapSelector.addEventListener("change", (e) => {
        this._onMapChange(e.target.value);
      });
    }

    // Delete map button
    const deleteMapBtn = document.getElementById("delete-map-btn");
    if (deleteMapBtn) {
      deleteMapBtn.addEventListener("click", () => this._onDeleteMap());
    }

    // Player view buttons
    const showAllBtn = document.getElementById("show-all-players-btn");
    const closeAllBtn = document.getElementById("close-all-players-btn");

    if (showAllBtn) {
      showAllBtn.addEventListener("click", () => this._onShowToPlayers());
    }
    if (closeAllBtn) {
      closeAllBtn.addEventListener("click", () => this._onClosePlayerView());
    }

    // Canvas rendering
    if (this.mapData) {
      const canvas = document.getElementById(this.getCanvasId());
      if (canvas) {
        this._setupCanvasResize(canvas);
        this._setupCanvasDragScroll(canvas);
        this._setupCanvasZoom(canvas);
        this._renderMap(canvas);
      }
    }

    // Visibility controls
    this._setupVisibilityControls(document);
    this._setupCollapsibleHeader(document);

    // Initialize active viewers display
    this._updateActiveViewersDisplay();
    this._updateButtonVisibility();
  }

  _setupCollapsibleHeader(document) {
    const header = document.getElementById("visibility-header");
    const panel = document.querySelector(".visibility-panel");

    if (!header || !panel) return;

    header.addEventListener("click", () => {
      panel.classList.toggle("collapsed");
    });
  }

  _onMapChange(mapId) {
    if (this._setCurrentMap(mapId)) {
      this.render();
    }
  }

  async _onDeleteMap() {
    const currentMap = this._getCurrentMap();
    if (!currentMap) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: "Delete Map",
      },
      content: `<p>Are you sure you want to delete the map "<strong>${currentMap.name}</strong>"?</p><p>This cannot be undone.</p>`,
      rejectClose: false,
      modal: true,
    });

    if (confirmed) {
      this._deleteMap(currentMap.id);
      ui.notifications.info(`Map "${currentMap.name}" deleted`);
      this.render();
    }
  }

  async _onImportJSON() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        const text = await file.text();
        try {
          const mapData = JSON.parse(text);
          this._initializeVisibilityFlags(mapData);

          // Add map to collection instead of replacing
          const mapId = this._addMap(mapData);
          this._setCurrentMap(mapId);

          ui.notifications.info(
            game.i18n.localize(
              "MOTHERSHIP_MAP_VIEWER.notifications.ImportSuccess"
            )
          );
          this.render();
        } catch (err) {
          ui.notifications.error(
            game.i18n.localize(
              "MOTHERSHIP_MAP_VIEWER.notifications.ImportError"
            )
          );
          console.error(err);
        }
      }
    };
    input.click();
  }

  async _onImportShareString() {
    let shareString;
    try {
      shareString = await foundry.applications.api.DialogV2.prompt({
        window: {
          title: "MOTHERSHIP_MAP_VIEWER.ImportShareString",
        },
        content:
          '<div class="form-group"><label>Share String:</label><textarea id="share-string" rows="5" style="width: 100%;"></textarea></div>',
        ok: {
          label: "MOTHERSHIP_MAP_VIEWER.Import",
          // eslint-disable-next-line no-unused-vars
          callback: (event, html, dialog) =>
            document.getElementById("share-string").value.trim(),
        },
      });
      // eslint-disable-next-line no-unused-vars
    } catch (err) {
      // probably cancelled
    }

    if (shareString) {
      try {
        const mapData = await decodeShareString(shareString);
        this._initializeVisibilityFlags(mapData);

        // Add map to collection instead of replacing
        const mapId = this._addMap(mapData);
        this._setCurrentMap(mapId);

        ui.notifications.info(
          game.i18n.localize(
            "MOTHERSHIP_MAP_VIEWER.notifications.ImportSuccess"
          )
        );
        this.render();
      } catch (err) {
        ui.notifications.error(
          game.i18n.localize("MOTHERSHIP_MAP_VIEWER.notifications.ImportError")
        );
        console.error(err);
      }
    }
  }

  _initializeVisibilityFlags(mapData = null) {
    const targetMapData = mapData || this.mapData;
    if (!targetMapData) return;

    // Initialize room visibility flags
    if (targetMapData.rooms) {
      targetMapData.rooms.forEach((room) => {
        if (room.visible === undefined) room.visible = true;
        if (room.markers) {
          room.markers.forEach((marker) => {
            if (marker.visible === undefined) marker.visible = true;
          });
        }
        if (room.labels) {
          room.labels.forEach((label) => {
            if (label.visible === undefined) label.visible = true;
          });
        }
      });
    }

    // Initialize hallway visibility flags
    if (targetMapData.hallways) {
      targetMapData.hallways.forEach((hallway) => {
        if (hallway.visible === undefined) hallway.visible = true;
        if (hallway.startMarker && hallway.startMarker.visible === undefined) {
          hallway.startMarker.visible = true;
        }
        if (hallway.endMarker && hallway.endMarker.visible === undefined) {
          hallway.endMarker.visible = true;
        }
      });
    }

    // Initialize standalone marker visibility flags
    if (!targetMapData.standaloneMarkers) {
      targetMapData.standaloneMarkers = [];
    } else {
      targetMapData.standaloneMarkers.forEach((marker) => {
        if (marker.visible === undefined) marker.visible = true;
      });
    }
  }

  _setupVisibilityControls(document) {
    if (!this.mapData) return;

    const controlsContainer = document.getElementById("visibility-controls");
    if (!controlsContainer) return;

    let controlsHTML = '<div class="visibility-section">';

    // Room controls
    if (this.mapData.rooms && this.mapData.rooms.length > 0) {
      controlsHTML += "<h3>Rooms</h3>";

      this.mapData.rooms.forEach((room, index) => {
        const label = room.label || `Room ${index + 1}`;
        controlsHTML += `
          <div class="visibility-item">
            <label>
              <input type="checkbox" class="room-visibility" data-index="${index}" ${
                room.visible ? "checked" : ""
              }>
              ${label}
            </label>
        `;

        // Room markers
        if (room.markers && room.markers.length > 0) {
          controlsHTML +=
            '<div class="marker-controls" style="margin-left: 20px;">';
          room.markers.forEach((marker, markerIndex) => {
            const markerLabel =
              marker.label || `${marker.type} ${markerIndex + 1}`;
            controlsHTML += `
              <label style="display: block; font-size: 0.9em;">
                <input type="checkbox" class="room-marker-visibility" data-room="${index}" data-marker="${markerIndex}" ${
                  marker.visible ? "checked" : ""
                }>
                ${markerLabel}
              </label>
            `;
          });
          controlsHTML += "</div>";
        }

        // Room labels
        if (room.labels && room.labels.length > 0) {
          controlsHTML +=
            '<div class="label-controls" style="margin-left: 20px;">';
          room.labels.forEach((label, labelIndex) => {
            const labelText = label.text || `Label ${labelIndex + 1}`;
            controlsHTML += `
              <label style="display: block; font-size: 0.9em;">
                <input type="checkbox" class="room-label-visibility" data-room="${index}" data-label="${labelIndex}" ${
                  label.visible !== false ? "checked" : ""
                }>
                ${labelText}
              </label>
            `;
          });
          controlsHTML += "</div>";
        }

        // Room walls // Commented out because room walls are always visible in player view
        // if (room.walls && room.walls.length > 0) {
        //   controlsHTML +=
        //     '<div class="wall-controls" style="margin-left: 20px;">';
        //   room.walls.forEach((wall, wallIndex) => {
        //     controlsHTML += `
        //       <label style="display: block; font-size: 0.9em; color: #888;">
        //         Wall ${wallIndex + 1} (always visible)
        //       </label>
        //     `;
        //   });
        // }

        controlsHTML += "</div>";
      });
    }

    // Hallway controls
    if (this.mapData.hallways && this.mapData.hallways.length > 0) {
      controlsHTML += `<h3 style="margin-top: 20px;">${game.i18n.localize("MOTHERSHIP_MAP_VIEWER.forms.viewer.HallwayVisibility")}</h3>`;
      this.mapData.hallways.forEach((hallway, index) => {
        const label = hallway.label || `Hallway ${index + 1}`;
        const type = hallway.isSecret ? "(Secret)" : "";
        controlsHTML += `
          <div class="visibility-item">
            <label>
              <input type="checkbox" class="hallway-visibility" data-index="${index}" ${
                hallway.visible ? "checked" : ""
              }>
              ${label} ${type}
            </label>`;

        // Hallway start marker
        if (hallway.startMarker) {
          const startMarker = hallway.startMarker;
          controlsHTML += `
            <div class="marker-controls" style="margin-left: 20px;">
              <label style="display: block; font-size: 0.9em;">
                <input type="checkbox" class="hallway-start-marker-visibility" data-hallway="${index}" data-marker="start" ${
                  startMarker.visible ? "checked" : ""
                }>
                Start Marker
              </label>
            </div>`;
        }

        // Hallway end marker
        if (hallway.endMarker) {
          const endMarker = hallway.endMarker;
          controlsHTML += `
            <div class="marker-controls" style="margin-left: 20px;">
              <label style="display: block; font-size: 0.9em;">
                <input type="checkbox" class="hallway-end-marker-visibility" data-hallway="${index}" data-marker="end" ${
                  endMarker.visible ? "checked" : ""
                }>
                End Marker
              </label>
            </div>`;
        }

        // Hallway markers
        const hallwayAllMarkers = [...(hallway.markers ?? [])].filter(
          (m) => m && m.type !== "none"
        );
        if (hallwayAllMarkers.length > 0) {
          controlsHTML +=
            '<div class="marker-controls" style="margin-left: 20px;">';
          hallwayAllMarkers.forEach((marker, markerIndex) => {
            const markerLabel =
              marker.label || `${marker.type} ${markerIndex + 1}`;
            controlsHTML += `
              <label style="display: block; font-size: 0.9em;">
                <input type="checkbox" class="hallway-marker-visibility" data-hallway="${index}" data-marker="${markerIndex}" ${
                  marker.visible ? "checked" : ""
                }>
                ${markerLabel}
              </label>
            `;
          });
          controlsHTML += "</div>";
        }

        controlsHTML += `</div>`;
      });
    }

    if (this.mapData.walls && this.mapData.walls.length > 0) {
      controlsHTML += `<h3 style="margin-top: 20px;">${game.i18n.localize("MOTHERSHIP_MAP_VIEWER.forms.viewer.StandaloneWalls")}</h3>`;
      this.mapData.walls.forEach((wall, index) => {
        const label = wall.label || `Wall ${index + 1}`;
        controlsHTML += `
          <div class="visibility-item">
            <label>
              <input type="checkbox" class="wall-visibility" data-index="${index}" ${
                wall.visible ? "checked" : ""
              }>
              ${label}
            </label>
        `;

        controlsHTML += "</div>";
      });
    }

    if (
      this.mapData.standaloneMarkers &&
      this.mapData.standaloneMarkers.length > 0
    ) {
      controlsHTML += `<h3 style="margin-top: 20px;">Standalone Markers</h3>`;
      this.mapData.standaloneMarkers.forEach((marker, index) => {
        const label = marker.label || `${marker.type} ${index + 1}`;
        controlsHTML += `
          <div class="visibility-item">
            <label>
              <input type="checkbox" class="standalone-marker-visibility" data-index="${index}" ${
                marker.visible !== false ? "checked" : ""
              }>
              ${label}
            </label>
          </div>
        `;
      });
    }

    if (
      this.mapData.standaloneLabels &&
      this.mapData.standaloneLabels.length > 0
    ) {
      controlsHTML += `<h3 style="margin-top: 20px;">Standalone Labels</h3>`;
      this.mapData.standaloneLabels.forEach((label, index) => {
        const labelText = label.text || `Label ${index + 1}`;
        controlsHTML += `
          <div class="visibility-item">
            <label>
              <input type="checkbox" class="standalone-label-visibility" data-index="${index}" ${
                label.visible !== false ? "checked" : ""
              }>
              ${labelText}
            </label>
          </div>
        `;
      });
    }

    controlsHTML += "</div>";
    controlsContainer.innerHTML = controlsHTML;

    // Attach event listeners
    controlsContainer
      .querySelectorAll(".room-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const index = parseInt(e.target.dataset.index);
          this.mapData.rooms[index].visible = e.target.checked;
          this._renderMap(document.getElementById(this.getCanvasId()));
          this._autoUpdatePlayers();
        });
      });

    controlsContainer
      .querySelectorAll(".room-marker-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const roomIndex = parseInt(e.target.dataset.room);
          const markerIndex = parseInt(e.target.dataset.marker);
          this.mapData.rooms[roomIndex].markers[markerIndex].visible =
            e.target.checked;
          this._renderMap(document.getElementById(this.getCanvasId()));
          this._autoUpdatePlayers();
        });
      });

    controlsContainer
      .querySelectorAll(".room-label-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const roomIndex = parseInt(e.target.dataset.room);
          const labelIndex = parseInt(e.target.dataset.label);
          this.mapData.rooms[roomIndex].labels[labelIndex].visible =
            e.target.checked;
          this._renderMap(document.getElementById(this.getCanvasId()));
          this._autoUpdatePlayers();
        });
      });

    controlsContainer
      .querySelectorAll(".hallway-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const index = parseInt(e.target.dataset.index);
          this.mapData.hallways[index].visible = e.target.checked;
          this._renderMap(document.getElementById(this.getCanvasId()));
          this._autoUpdatePlayers();
        });
      });

    // Hallway start marker
    controlsContainer
      .querySelectorAll(".hallway-start-marker-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const hallwayIndex = parseInt(e.target.dataset.hallway);
          this.mapData.hallways[hallwayIndex].startMarker.visible =
            e.target.checked;
          this._renderMap(document.getElementById(this.getCanvasId()));
          this._autoUpdatePlayers();
        });
      });

    // Hallway end marker
    controlsContainer
      .querySelectorAll(".hallway-end-marker-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const hallwayIndex = parseInt(e.target.dataset.hallway);
          this.mapData.hallways[hallwayIndex].endMarker.visible =
            e.target.checked;
          this._renderMap(document.getElementById(this.getCanvasId()));
          this._autoUpdatePlayers();
        });
      });

    // Hallway other markers
    controlsContainer
      .querySelectorAll(".hallway-marker-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const hallwayIndex = parseInt(e.target.dataset.hallway);
          const markerIndex = parseInt(e.target.dataset.marker);
          this.mapData.hallways[hallwayIndex].markers[markerIndex].visible =
            e.target.checked;
          this._renderMap(document.getElementById(this.getCanvasId()));
          this._autoUpdatePlayers();
        });
      });

    controlsContainer
      .querySelectorAll(".wall-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const index = parseInt(e.target.dataset.index);
          this.mapData.walls[index].visible = e.target.checked;
          this._renderMap(document.getElementById(this.getCanvasId()));
          this._autoUpdatePlayers();
        });
      });

    controlsContainer
      .querySelectorAll(".standalone-marker-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const index = parseInt(e.target.dataset.index);
          this.mapData.standaloneMarkers[index].visible = e.target.checked;
          this._renderMap(document.getElementById(this.getCanvasId()));
          this._autoUpdatePlayers();
        });
      });

    controlsContainer
      .querySelectorAll(".standalone-label-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const index = parseInt(e.target.dataset.index);
          this.mapData.standaloneLabels[index].visible = e.target.checked;
          this._renderMap(document.getElementById(this.getCanvasId()));
          this._autoUpdatePlayers();
        });
      });
  }

  _onShowToPlayers() {
    if (!this.mapData) {
      ui.notifications.warn(
        game.i18n.localize("MOTHERSHIP_MAP_VIEWER.notifications.NoMapLoaded")
      );
      return;
    }

    game.modules.get("mothership-map-viewer").socketHandler.emit("displayMap", {
      mapId: this.currentMapId,
      mapData: this.mapData,
    });
    ui.notifications.info(
      game.i18n.localize("MOTHERSHIP_MAP_VIEWER.notifications.MapShown")
    );
  }

  _onClosePlayerView() {
    game.modules
      .get("mothership-map-viewer")
      .socketHandler.emit("closeMap", null);
    ui.notifications.info(
      game.i18n.localize("MOTHERSHIP_MAP_VIEWER.notifications.PlayerViewClosed")
    );

    // Clear active viewers and update button visibility
    this.activeViewers.clear();
    this._updateActiveViewersDisplay();
    this._updateButtonVisibility();
  }

  _autoUpdatePlayers() {
    // Automatically update player view if it's currently shown
    if (this.mapShownToPlayers) {
      game.modules
        .get("mothership-map-viewer")
        .socketHandler.emit("updateMap", {
          mapId: this.currentMapId,
          mapData: this.mapData,
        });
    }
  }

  updatePlayerViewStatus(userId, status, mapId = null) {
    // Find the map by mapId (or use current map if not specified)
    const targetMapId = mapId || this.currentMapId;
    const map = this.maps.find((m) => m.id === targetMapId);

    if (status === "opened") {
      // Remove user from all other maps first (they can only view one map at a time)
      this.maps.forEach((m) => {
        if (m.id !== targetMapId) {
          m.activeViewers.delete(userId);
        }
      });

      // Add user to the target map
      if (map) {
        map.activeViewers.add(userId);
      }

      // Update legacy property if viewing current map
      if (targetMapId === this.currentMapId) {
        this.activeViewers.add(userId);
      } else {
        this.activeViewers.delete(userId);
      }
    } else if (status === "closed") {
      // Remove user from all maps
      this.maps.forEach((m) => {
        m.activeViewers.delete(userId);
      });

      // Update legacy property
      this.activeViewers.delete(userId);
    }

    this._updateActiveViewersDisplay();
    this._updateButtonVisibility();
  }

  _updateActiveViewersDisplay() {
    const container = document.getElementById("active-viewers-list");
    if (!container) return;

    // Get all non-GM users
    const players = game.users.filter((user) => !user.isGM);

    if (players.length === 0) {
      container.innerHTML = '<p class="no-viewers">No players online</p>';
      return;
    }

    let html = "";
    players.forEach((user) => {
      const isActive = this.activeViewers.has(user.id);
      const isOnline = user.active;
      const statusClass = isActive
        ? "active"
        : isOnline
          ? "inactive"
          : "offline";
      const buttonText = isActive ? "Refresh" : "Open";
      const buttonIcon = isActive ? "fa-sync" : "fa-eye";

      const character = user.character;
      const playerName = character ? character.name : null;
      const characterName = character ? character.id : null;

      html += `
        <div class="viewer-item ${!isOnline ? "offline" : ""}">
          <span class="viewer-status ${statusClass}"></span>
          <span class="viewer-name">
            ${user.name}${
              playerName
                ? ` (<span class="character-link" data-character-id="${characterName}" style="cursor: pointer; text-decoration: underline;">${playerName}</span>)`
                : ""
            }
          </span>
          ${
            isOnline
              ? `<div class="viewer-actions">
                  <button class="viewer-reopen-btn" data-user-id="${user.id}" title="${buttonText} map for this player">
                    <i class="fas ${buttonIcon}"></i>
                  </button>
                  ${
                    isActive
                      ? `<button class="viewer-close-btn" data-user-id="${user.id}" title="Close map for this player">
                          <i class="fas fa-times"></i>
                        </button>`
                      : ""
                  }
                </div>`
              : '<span class="offline-label">Offline</span>'
          }
        </div>
      `;
    });

    container.innerHTML = html;

    // Attach event listeners to re-open buttons
    container.querySelectorAll(".viewer-reopen-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = e.currentTarget.dataset.userId;
        this._reopenMapForPlayer(userId);
      });
    });

    // Attach event listeners to close buttons
    container.querySelectorAll(".viewer-close-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = e.currentTarget.dataset.userId;
        this._closeMapForPlayer(userId);
      });
    });

    // Attach event listeners to character links
    container.querySelectorAll(".character-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        const characterId = e.currentTarget.dataset.characterId;
        const actor = game.actors.get(characterId);
        if (actor) {
          actor.sheet.render(true);
        }
      });
    });
  }

  _reopenMapForPlayer(userId) {
    if (!this.mapData) return;

    // Emit to specific user
    game.socket.emit(
      "module.mothership-map-viewer",
      {
        type: "displayMap",
        payload: { mapId: this.currentMapId, mapData: this.mapData },
      },
      [userId]
    );

    ui.notifications.info(
      `Map re-opened for ${game.users.get(userId)?.name || "player"}`
    );
  }

  _closeMapForPlayer(userId) {
    // Emit close to specific user
    game.socket.emit(
      "module.mothership-map-viewer",
      { type: "closeMap", payload: null },
      [userId]
    );

    ui.notifications.info(
      `Map closed for ${game.users.get(userId)?.name || "player"}`
    );

    // Update the viewer status locally
    this.activeViewers.delete(userId);
    this._updateActiveViewersDisplay();
    this._updateButtonVisibility();
  }

  _updateButtonVisibility() {
    const showBtn = document.getElementById("show-all-players-btn");
    const closeBtn = document.getElementById("close-all-players-btn");

    if (!showBtn || !closeBtn) return;

    // Show close button if any players are viewing, otherwise show open button
    if (this.activeViewers.size > 0) {
      showBtn.style.display = "none";
      closeBtn.style.display = "flex";
      this.mapShownToPlayers = true;
    } else {
      showBtn.style.display = "flex";
      closeBtn.style.display = "none";
      this.mapShownToPlayers = false;
    }
  }
}

// Hook to add button to sidebar
Hooks.once("ready", () => {
  console.log("Mothership Map Viewer | Module loaded");
});

Hooks.once("init", () => {
  const myPackage = game.modules.get("mothership-map-viewer");
  myPackage.socketHandler = new MothershipMapSocketHandler();
});

Hooks.on("renderSceneDirectory", (app, html) => {
  if (!game.user.isGM) return;

  const button = document.createElement("button");
  button.classList.add("mothership-map-viewer-btn");
  button.type = "button";
  button.innerHTML = `<i class="fas fa-map"></i> Mothership Map Viewer`;

  button.addEventListener("click", () => {
    new MothershipMapViewer().render(true);
  });

  html.querySelector(".directory-header .action-buttons").append(button);
});
