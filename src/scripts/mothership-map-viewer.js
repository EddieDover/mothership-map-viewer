/**
 * Mothership Map Viewer for Foundry VTT
 * Displays maps created with the Mothership Map Creator tool
 */

import { BaseMapRenderer } from "./base-map-renderer.js";
import { decodeShareString } from "./utils.js";

// Socket handler for syncing map data to players
class MothershipMapSocketHandler {
  identifier = "module.mothership-map-viewer";
  constructor() {
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
        case "updateViewMode":
          this.#onUpdateViewMode(payload);
          break;
        case "updatePlayerLocations":
          this.#onUpdatePlayerLocations(payload);
          break;
        default:
          throw new Error("unknown type");
      }
    });
  }

  emit(type, payload) {
    return game.socket.emit(this.identifier, { type, payload });
  }

  async #onDisplayMap(payload) {
    if (game.user.isGM) return;
    // payload can be either { mapId, mapData } or just mapData (legacy)
    const mapData = payload.mapData || payload;
    const mapId = payload.mapId || null;
    const instance = PlayerMapDisplay.getInstance({ mapData, mapId });
    instance.shouldCenter = true;
    await instance.render(true);

    // Sync view mode if provided
    if (payload.is3DMode !== undefined) {
      instance.set3DMode(payload.is3DMode);
    }
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

      if (app.rendered) {
        app.refreshMap();
      } else {
        app.render({ force: true });
      }
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

  #onUpdateViewMode(payload) {
    if (game.user.isGM) return;
    const app = PlayerMapDisplay.getInstance();
    if (app) {
      app.set3DMode(payload.is3DMode);
    }
  }

  #onUpdatePlayerLocations(payload) {
    if (game.user.isGM) return;
    const app = PlayerMapDisplay.getInstance();
    if (app) {
      app.updatePlayerLocations(payload);
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
    this.playerLocations = {};

    PlayerMapDisplay._instance = this;
  }

  static DEFAULT_OPTIONS = {
    tag: "div",
    window: {
      title: "MOTHERSHIP_MAP_VIEWER.PlayerMapTitle",
      resizable: true,
    },
    position: { width: 1200, height: 900 },
    classes: ["mothership-player-map"],
  };

  static PARTS = {
    main: {
      template: "modules/mothership-map-viewer/templates/player-map.hbs",
    },
  };

  static getInstance(options) {
    // If an instance exists and is rendered, bring it to focus
    if (PlayerMapDisplay._instance?.rendered) {
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

    // 3D Toggle
    const toggle3dBtn = this.element.querySelector("#toggle-3d-btn");
    if (toggle3dBtn) {
      toggle3dBtn.addEventListener("click", () => this.toggle3DMode());
    }

    // Center View
    const centerBtn = this.element.querySelector("#center-view-btn");
    if (centerBtn) {
      centerBtn.addEventListener("click", () => this.centerView());
    }

    // Floor controls
    const floorUpBtn = this.element.querySelector("#floor-up-btn");
    if (floorUpBtn) {
      floorUpBtn.addEventListener("click", () => {
        this.setFloor(this.currentFloor + 1);
      });
    }
    const floorDownBtn = this.element.querySelector("#floor-down-btn");
    if (floorDownBtn) {
      floorDownBtn.addEventListener("click", () => {
        this.setFloor(this.currentFloor - 1);
      });
    }

    if (this.mapData) {
      const canvas = document.getElementById(this.getCanvasId());
      if (canvas) {
        this._setupCanvasResize(canvas);
        this._setupCanvasDragScroll(canvas);
        this._setupCanvasZoom(canvas);
        this._renderMap(canvas);

        if (this.shouldCenter) {
          this.centerView();
          this.shouldCenter = false;
        }
      }
    }

    // Notify GM that this player has opened the map
    this._notifyViewStatus("opened");

    // Restore 3D mode if active (force update as DOM was replaced)
    if (this.is3DMode) {
      this.set3DMode(true, true);
    }
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

  updatePlayerLocations(locations) {
    this.playerLocations = locations;
    if (this.is3DMode && this.renderer3d) {
      this.renderer3d.updatePlayerMarkers(this.playerLocations);
    }
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

    // Load saved maps
    const savedMaps =
      game.settings.get("mothership-map-viewer", "savedMaps") || [];
    if (Array.isArray(savedMaps) && savedMaps.length > 0) {
      this.maps = savedMaps.map((m) => ({
        ...m,
        activeViewers: new Set(),
      }));

      // Set current map to the first one if available
      if (this.maps.length > 0) {
        this._setCurrentMap(this.maps[0].id);

        // Update nextMapId to avoid collisions
        const maxId = this.maps.reduce((max, m) => {
          const idNum = parseInt(m.id.replace("map-", ""));
          return isNaN(idNum) ? max : Math.max(max, idNum);
        }, 0);
        this.nextMapId = maxId + 1;
      }
    }

    // Load 3D mode preference
    this.is3DMode =
      game.settings.get("mothership-map-viewer", "default3DMode") || false;

    // Initialize active map state (required by BaseMapRenderer)
    if (!this.mapData) {
      this.mapData = null;
      this.activeViewers = new Set();
    }
    this.mapShownToPlayers = false;
    this.playerLocations = {}; // Map of userId -> roomIndex
    this.filterText = "";

    MothershipMapViewer._instance = this;
  }

  static getInstance(options) {
    // If an instance exists and is rendered, bring it to focus
    if (MothershipMapViewer._instance?.rendered) {
      MothershipMapViewer._instance.bringToTop();
      return MothershipMapViewer._instance;
    }
    // Otherwise create a new instance
    return new MothershipMapViewer(options);
  }

  getCanvasId() {
    return "map-canvas";
  }

  setFilterText(text) {
    this.filterText = text.toLowerCase().trim();
    this._filterVisibilityList();
  }

  _filterVisibilityList() {
    const container = document.getElementById("visibility-controls");
    if (!container) return;

    const items = container.querySelectorAll(".visibility-item");
    const filter = this.filterText.toLowerCase();

    items.forEach((item) => {
      const label = item.textContent.toLowerCase();
      if (label.includes(filter)) {
        item.style.display = "block";
      } else {
        item.style.display = "none";
      }
    });
  }

  // Helper methods for multi-map management
  _saveMaps() {
    // Prepare maps for saving (remove Sets)
    const mapsToSave = this.maps.map((m) => {
      // eslint-disable-next-line no-unused-vars
      const { activeViewers, ...rest } = m;
      return rest;
    });
    game.settings.set("mothership-map-viewer", "savedMaps", mapsToSave);
  }

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
    this._saveMaps();
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
      // Sync active map data for BaseMapRenderer
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
      this._saveMaps();
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
    position: { width: 1200, height: 900 },
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
    document
      .getElementById("import-json-btn")
      .addEventListener("click", () => this._onImportJSON());
    document
      .getElementById("import-share-btn")
      .addEventListener("click", () => this._onImportShareString());

    const toggle3dBtn = this.element.querySelector("#toggle-3d-btn");
    if (toggle3dBtn) {
      toggle3dBtn.addEventListener("click", () => this.toggle3DMode());
    }

    const centerBtn = this.element.querySelector("#center-view-btn");
    if (centerBtn) {
      centerBtn.addEventListener("click", () => this.centerView());
    }

    const floorUpBtn = this.element.querySelector("#floor-up-btn");
    if (floorUpBtn) {
      floorUpBtn.addEventListener("click", () => {
        this.setFloor(this.currentFloor + 1);
      });
    }
    const floorDownBtn = this.element.querySelector("#floor-down-btn");
    if (floorDownBtn) {
      floorDownBtn.addEventListener("click", () => {
        this.setFloor(this.currentFloor - 1);
      });
    }

    const mapSelector = document.getElementById("map-selector-dropdown");
    if (mapSelector) {
      mapSelector.addEventListener("change", (e) => {
        this._onMapChange(e.target.value);
      });
    }

    const deleteMapBtn = document.getElementById("delete-map-btn");
    if (deleteMapBtn) {
      deleteMapBtn.addEventListener("click", () => this._onDeleteMap());
    }

    const showAllBtn = document.getElementById("show-all-players-btn");
    const closeAllBtn = document.getElementById("close-all-players-btn");

    if (showAllBtn) {
      showAllBtn.addEventListener("click", () => this._onShowToPlayers());
    }
    if (closeAllBtn) {
      closeAllBtn.addEventListener("click", () => this._onClosePlayerView());
    }

    if (this.mapData) {
      const canvas = document.getElementById(this.getCanvasId());
      if (canvas) {
        this._setupCanvasResize(canvas);
        this._setupCanvasDragScroll(canvas);
        this._setupCanvasZoom(canvas);
        this._renderMap(canvas);

        if (this.shouldCenter) {
          this.centerView();
          this.shouldCenter = false;
        }
      }
    }

    this._setupVisibilityControls(document);
    this._setupCollapsibleHeader(document);

    this._updateActiveViewersDisplay();
    this._updateButtonVisibility();

    const filterInput = document.getElementById("gm-room-filter");
    if (filterInput) {
      filterInput.value = this.filterText || "";
      filterInput.addEventListener("input", (e) => {
        this.setFilterText(e.target.value);
      });
      this._filterVisibilityList();
    }

    // Restore 3D mode if active (force update as DOM was replaced)
    if (this.is3DMode) {
      this.set3DMode(true, true);
    }
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
          this.shouldCenter = true;
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
        this.shouldCenter = true;
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

    if (targetMapData.rooms) {
      targetMapData.rooms.forEach((room) => {
        if (room.visible === undefined) room.visible = true;
        if (room.labelVisible === undefined) room.labelVisible = true;
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

    if (this.mapData.rooms && this.mapData.rooms.length > 0) {
      controlsHTML += "<h3>Rooms</h3>";

      this.mapData.rooms.forEach((room, index) => {
        const label = room.label || `Room ${index + 1}`;
        controlsHTML += `
          <div class="visibility-item">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label>
                <input type="checkbox" class="room-visibility" data-index="${index}" ${
                  room.visible ? "checked" : ""
                }>
                ${label}
              </label>
              <i class="fas fa-cog room-settings" data-index="${index}" title="${game.i18n.localize("MOTHERSHIP_MAP_VIEWER.forms.viewer.RoomSettings")}" style="cursor: pointer; color: #aaa;"></i>
            </div>
            <label style="margin-left: 20px; display: block; font-size: 0.9em;">
              <input type="checkbox" class="room-name-visibility" data-index="${index}" ${
                room.labelVisible ? "checked" : ""
              }>
              ${game.i18n.localize("MOTHERSHIP_MAP_VIEWER.forms.viewer.ShowName") || "Show Name"}
            </label>
        `;

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

        controlsHTML += "</div>";
      });
    }

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

    const updateVisibility = () => {
      this._renderMap(document.getElementById(this.getCanvasId()));
      if (this.is3DMode && this.renderer3d) {
        this.renderer3d.update(this.mapData, this.currentFloor);
      }
      this._autoUpdatePlayers();
    };

    controlsContainer
      .querySelectorAll(".room-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const index = parseInt(e.target.dataset.index);
          this.mapData.rooms[index].visible = e.target.checked;
          updateVisibility();
        });
      });

    controlsContainer.querySelectorAll(".room-settings").forEach((icon) => {
      icon.addEventListener("click", (e) => {
        const index = parseInt(e.target.dataset.index);
        const room = this.mapData.rooms[index];
        this._showRoomContext(room, index);
      });
    });

    controlsContainer
      .querySelectorAll(".room-name-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const index = parseInt(e.target.dataset.index);
          this.mapData.rooms[index].labelVisible = e.target.checked;
          updateVisibility();
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
          updateVisibility();
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
          updateVisibility();
        });
      });

    controlsContainer
      .querySelectorAll(".hallway-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const index = parseInt(e.target.dataset.index);
          this.mapData.hallways[index].visible = e.target.checked;
          updateVisibility();
        });
      });

    controlsContainer
      .querySelectorAll(".hallway-start-marker-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const hallwayIndex = parseInt(e.target.dataset.hallway);
          this.mapData.hallways[hallwayIndex].startMarker.visible =
            e.target.checked;
          updateVisibility();
        });
      });

    controlsContainer
      .querySelectorAll(".hallway-end-marker-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const hallwayIndex = parseInt(e.target.dataset.hallway);
          this.mapData.hallways[hallwayIndex].endMarker.visible =
            e.target.checked;
          updateVisibility();
        });
      });

    controlsContainer
      .querySelectorAll(".hallway-marker-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const hallwayIndex = parseInt(e.target.dataset.hallway);
          const markerIndex = parseInt(e.target.dataset.marker);
          this.mapData.hallways[hallwayIndex].markers[markerIndex].visible =
            e.target.checked;
          updateVisibility();
        });
      });

    controlsContainer
      .querySelectorAll(".wall-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const index = parseInt(e.target.dataset.index);
          this.mapData.walls[index].visible = e.target.checked;
          updateVisibility();
        });
      });

    controlsContainer
      .querySelectorAll(".standalone-marker-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const index = parseInt(e.target.dataset.index);
          this.mapData.standaloneMarkers[index].visible = e.target.checked;
          updateVisibility();
        });
      });

    controlsContainer
      .querySelectorAll(".standalone-label-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const index = parseInt(e.target.dataset.index);
          this.mapData.standaloneLabels[index].visible = e.target.checked;
          updateVisibility();
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
      is3DMode: this.is3DMode,
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

      let roomOptions = "";
      if (this.mapData && this.mapData.rooms) {
        roomOptions = this.mapData.rooms
          .map((room, index) => {
            const isSelected = this.playerLocations[user.id] === index;
            return `<option value="${index}" ${
              isSelected ? "selected" : ""
            }>${room.label || `Room ${index + 1}`}</option>`;
          })
          .join("");
      }

      html += `
        <div class="viewer-item ${!isOnline ? "offline" : ""}">
          <span class="viewer-status ${statusClass}"></span>
          <div class="viewer-info" style="flex-grow: 1; display: flex; flex-direction: column;">
            <span class="viewer-name">
              ${user.name}${
                playerName
                  ? ` (<span class="character-link" data-character-id="${characterName}" style="cursor: pointer; text-decoration: underline;">${playerName}</span>)`
                  : ""
              }
            </span>
            ${
              isOnline && this.mapData
                ? `<select class="player-location-select" data-user-id="${user.id}" style="margin-top: 4px; font-size: 0.8em; max-width: 150px;">
                    <option value="">-- No Location --</option>
                    ${roomOptions}
                  </select>`
                : ""
            }
          </div>
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

    container.querySelectorAll(".player-location-select").forEach((select) => {
      select.addEventListener("change", (e) => {
        const userId = e.currentTarget.dataset.userId;
        const value = e.currentTarget.value;
        const roomIndex = value === "" ? null : parseInt(value);
        this._updatePlayerLocation(userId, roomIndex);
      });
    });

    container.querySelectorAll(".viewer-reopen-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = e.currentTarget.dataset.userId;
        this._reopenMapForPlayer(userId);
      });
    });

    container.querySelectorAll(".viewer-close-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = e.currentTarget.dataset.userId;
        this._closeMapForPlayer(userId);
      });
    });

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

  _updatePlayerLocation(userId, roomIndex) {
    if (roomIndex === null) {
      delete this.playerLocations[userId];
    } else {
      this.playerLocations[userId] = roomIndex;
    }

    if (this.is3DMode && this.renderer3d) {
      this.renderer3d.updatePlayerMarkers(this.playerLocations);
    }

    if (this.mapShownToPlayers) {
      game.modules
        .get("mothership-map-viewer")
        .socketHandler.emit("updatePlayerLocations", this.playerLocations);
    }
  }

  _reopenMapForPlayer(userId) {
    if (!this.mapData) return;

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
    game.socket.emit(
      "module.mothership-map-viewer",
      { type: "closeMap", payload: null },
      [userId]
    );

    ui.notifications.info(
      `Map closed for ${game.users.get(userId)?.name || "player"}`
    );

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

  getRoomAtPosition(x, y) {
    if (!this.mapData || !this.mapData.rooms) return null;

    for (let i = 0; i < this.mapData.rooms.length; i++) {
      const room = this.mapData.rooms[i];
      if ((room.floor !== undefined ? room.floor : 1) !== this.currentFloor)
        continue;
      if (room.shape === "circle") {
        const centerX = room.x + room.radius;
        const centerY = room.y + room.radius;
        const dx = x - centerX;
        const dy = y - centerY;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared <= room.radius * room.radius) {
          return { room, index: i };
        }
      } else {
        if (
          x >= room.x &&
          x <= room.x + room.width &&
          y >= room.y &&
          y <= room.y + room.height
        ) {
          return { room, index: i };
        }
      }
    }
    return null;
  }

  _showRoomContext(room, index) {
    const d = new foundry.applications.api.DialogV2({
      window: {
        title: game.i18n.localize(
          "MOTHERSHIP_MAP_VIEWER.forms.viewer.RoomSettings"
        ),
      },
      content: `
        <form>
          <div class="form-group">
            <label class="room-color-label">${game.i18n.localize("MOTHERSHIP_MAP_VIEWER.forms.viewer.RoomColor")}</label>
            <select name="color">
              <option value="">${game.i18n.localize("MOTHERSHIP_MAP_VIEWER.forms.viewer.DefaultColor")}</option>
              <option value="#ff0000" ${room.color === "#ff0000" ? "selected" : ""}>${game.i18n.localize("MOTHERSHIP_MAP_VIEWER.forms.viewer.Red")}</option>
              <option value="#ffa500" ${room.color === "#ffa500" ? "selected" : ""}>${game.i18n.localize("MOTHERSHIP_MAP_VIEWER.forms.viewer.Orange")}</option>
              <option value="#ffff00" ${room.color === "#ffff00" ? "selected" : ""}>${game.i18n.localize("MOTHERSHIP_MAP_VIEWER.forms.viewer.Yellow")}</option>
              <option value="#0000ff" ${room.color === "#0000ff" ? "selected" : ""}>${game.i18n.localize("MOTHERSHIP_MAP_VIEWER.forms.viewer.Blue")}</option>
            </select>
          </div>
        </form>
      `,
      buttons: [
        {
          action: "save",
          label: game.i18n.localize(
            "MOTHERSHIP_MAP_VIEWER.forms.viewer.Update"
          ),
          default: true,
          callback: (event, button) => {
            const form = button.form;
            const color = form.elements.color.value;

            if (color) {
              this.mapData.rooms[index].color = color;
            } else {
              delete this.mapData.rooms[index].color;
            }

            this._saveMaps();
            this.render();

            game.socket.emit("module.mothership-map-viewer", {
              type: "updateMap",
              payload: { mapId: this.currentMapId, mapData: this.mapData },
            });
          },
        },
      ],
    });
    d.render(true);
  }
}

Hooks.once("ready", () => {
  console.log("Mothership Map Viewer | Module loaded");
});

Hooks.once("init", () => {
  const myPackage = game.modules.get("mothership-map-viewer");
  myPackage.socketHandler = new MothershipMapSocketHandler();

  game.settings.register("mothership-map-viewer", "savedMaps", {
    name: "Saved Maps",
    scope: "world",
    config: false,
    type: Object,
    default: [],
  });

  game.settings.register("mothership-map-viewer", "default3DMode", {
    name: "Default 3D Mode",
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
  });
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

// eslint-disable-next-line no-unused-vars
Hooks.on("userConnected", (user, connected) => {
  if (MothershipMapViewer._instance && MothershipMapViewer._instance.rendered) {
    MothershipMapViewer._instance._updateActiveViewersDisplay();
  }
});
