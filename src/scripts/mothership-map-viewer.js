/**
 * Mothership Map Viewer for Foundry VTT
 * Displays maps created with the Mothership Map Creator tool
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

import { drawHallwayMarker, drawRoomMarker } from "./map-icons.js";
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

  #onDisplayMap(mapData) {
    if (game.user.isGM) return;
    const instance = PlayerMapDisplay.getInstance({ mapData });
    instance.render(true);
  }

  #onUpdateMap(mapData) {
    if (game.user.isGM) return;
    const app = PlayerMapDisplay.getInstance();
    if (app) {
      app.mapData = mapData;
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
      gmViewer.updatePlayerViewStatus(payload.userId, payload.status);
    }
  }
}

// Player Map Display (read-only)
class PlayerMapDisplay extends HandlebarsApplicationMixin(ApplicationV2) {
  static _instance = null;
  constructor(
    options = {
      mapData: null,
    }
  ) {
    super(options);
    if (options.mapData) {
      this.mapData = options.mapData;
    }

    // Scroll state
    this.scrollOffset = { x: 0, y: 0 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };

    // Zoom state
    this.scale = 1.0;
    this.minScale = 0.1;
    this.maxScale = 5.0;

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

  _prepareContext() {
    return {
      hasMap: this.mapData !== null,
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    if (this.mapData) {
      const canvas = document.getElementById("player-map-canvas");
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

  _setupCanvasResize(canvas) {
    const container = canvas.parentElement;

    // Clean up any existing observer
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }

    let resizeTimeout = null;
    let lastWidth = 0;
    let lastHeight = 0;

    // Create a resize observer to adjust canvas when container size changes
    this._resizeObserver = new ResizeObserver((entries) => {
      // Clear any pending resize
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }

      // Debounce the actual resize operation
      resizeTimeout = setTimeout(() => {
        for (const entry of entries) {
          const rect = entry.contentRect;
          const newWidth = Math.max(800, Math.floor(rect.width));
          const newHeight = Math.max(600, Math.floor(rect.height));

          // Only update if size actually changed significantly (avoid sub-pixel changes)
          if (
            Math.abs(lastWidth - newWidth) > 1 ||
            Math.abs(lastHeight - newHeight) > 1
          ) {
            lastWidth = newWidth;
            lastHeight = newHeight;

            // Temporarily disconnect to prevent loops
            this._resizeObserver.disconnect();

            canvas.width = newWidth;
            canvas.height = newHeight;
            this._renderMap(canvas);

            // Reconnect after a brief delay
            setTimeout(() => {
              if (this._resizeObserver) {
                this._resizeObserver.observe(container);
              }
            }, 150);
          }
        }
      }, 100);
    });

    this._resizeObserver.observe(container);
  }

  _fitCanvasToContainer(canvas) {
    // Make it visually fill the positioned parent
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    // ...then set the internal size to match
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  _setupCanvasDragScroll(canvas) {
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 2) {
        // Right mouse button
        this.isDragging = true;
        this.dragStart = {
          x: e.clientX - this.scrollOffset.x,
          y: e.clientY - this.scrollOffset.y,
        };
        canvas.style.cursor = "grabbing";
      }
    });

    canvas.addEventListener("mousemove", (e) => {
      if (this.isDragging) {
        this.scrollOffset = {
          x: e.clientX - this.dragStart.x,
          y: e.clientY - this.dragStart.y,
        };
        this._renderMap(canvas);
      }
    });

    canvas.addEventListener("mouseup", (e) => {
      if (e.button === 2) {
        this.isDragging = false;
        canvas.style.cursor = "default";
      }
    });

    canvas.addEventListener("mouseleave", () => {
      if (this.isDragging) {
        this.isDragging = false;
        canvas.style.cursor = "default";
      }
    });
  }

  _setupCanvasZoom(canvas) {
    canvas.addEventListener(
      "wheel",
      (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Zoom in/out
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(
          this.minScale,
          Math.min(this.maxScale, this.scale * delta)
        );

        // Zoom towards cursor position
        const scaleDiff = newScale / this.scale;
        this.scrollOffset.x =
          mouseX - (mouseX - this.scrollOffset.x) * scaleDiff;
        this.scrollOffset.y =
          mouseY - (mouseY - this.scrollOffset.y) * scaleDiff;

        this.scale = newScale;
        this._renderMap(canvas);
      },
      { passive: true }
    );
  }

  _renderMap(canvas) {
    if (!canvas || !this.mapData) return;

    const ctx = canvas.getContext("2d");
    const WALL_THICKNESS = 10;

    // Clear canvas
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply scroll offset and zoom
    ctx.save();
    ctx.translate(this.scrollOffset.x, this.scrollOffset.y);
    ctx.scale(this.scale, this.scale);

    // Collect room markers to draw them last (on top of hallways)
    const roomMarkersToRender = [];

    // Draw only visible rooms
    if (this.mapData.rooms) {
      this.mapData.rooms.forEach((room) => {
        if (!room.visible) return;

        if (room.shape === "circle") {
          // Circle room
          const centerX = room.x + room.width / 2;
          const centerY = room.y + room.height / 2;
          const radius = Math.min(room.width, room.height) / 2;

          // Fill
          ctx.fillStyle = "#000000";
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fill();

          // Border
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = WALL_THICKNESS;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Rectangle room (default)
          // Fill
          ctx.fillStyle = "#000000";
          ctx.fillRect(room.x, room.y, room.width, room.height);

          // Border
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = WALL_THICKNESS;
          ctx.strokeRect(room.x, room.y, room.width, room.height);
        }

        // Collect visible markers for later rendering
        if (room.markers) {
          room.markers.forEach((marker) => {
            if (marker.visible) {
              roomMarkersToRender.push({
                x: room.x + marker.x,
                y: room.y + marker.y,
                type: marker.type,
              });
            }
          });
        }

        // Label
        if (room.label) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 14px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            room.label,
            room.x + room.width / 2,
            room.y + room.height / 2
          );
        }
      });
    }

    // Draw hallways and markers
    if (this.mapData.hallways) {
      this.mapData.hallways.forEach((hallway) => {
        // Draw hallway body only if visible
        if (hallway.visible) {
          if (hallway.isSecret) {
            this._drawSecretHallway(ctx, hallway);
          } else {
            this._drawRegularHallway(ctx, hallway);
          }

          // // Label (only when hallway is visible)
          // if (hallway.label && hallway.segments.length > 0) {
          //   const midSegment =
          //     hallway.segments[Math.floor(hallway.segments.length / 2)];
          //   const midX = (midSegment.x1 + midSegment.x2) / 2;
          //   const midY = (midSegment.y1 + midSegment.y2) / 2;
          //   ctx.fillStyle = "#000000";
          //   ctx.strokeStyle = "#ffffff";
          //   ctx.lineWidth = 3;
          //   ctx.font = "bold 12px sans-serif";
          //   ctx.textAlign = "center";
          //   ctx.textBaseline = "middle";
          //   ctx.strokeText(hallway.label, midX, midY);
          //   ctx.fillText(hallway.label, midX, midY);
          // }
        }

        // Draw endpoint markers independently of hallway visibility
        if (hallway.nodes && hallway.nodes.length >= 2) {
          const firstNode = hallway.nodes[0];
          const lastNode = hallway.nodes[hallway.nodes.length - 1];

          if (
            hallway.startMarker &&
            hallway.startMarker.type !== "none" &&
            hallway.startMarker.visible
          ) {
            this._drawHallwayMarker(
              ctx,
              firstNode.x,
              firstNode.y,
              hallway.startMarker.type,
              hallway.width
            );
          }
          if (
            hallway.endMarker &&
            hallway.endMarker.type !== "none" &&
            hallway.endMarker.visible
          ) {
            this._drawHallwayMarker(
              ctx,
              lastNode.x,
              lastNode.y,
              hallway.endMarker.type,
              hallway.width
            );
          }
        }
      });
    }

    // Draw standalone walls (only visible ones)
    if (this.mapData.walls) {
      this.mapData.walls.forEach((wall) => {
        if (wall.visible !== false) {
          this._drawWall(ctx, wall);
        }
      });
    }

    // Draw room walls (always visible for visible rooms in player view)
    if (this.mapData.rooms) {
      this.mapData.rooms.forEach((room) => {
        if (room.visible && room.walls && room.walls.length > 0) {
          room.walls.forEach((wall) => {
            this._drawWall(ctx, wall);
          });
        }
      });
    }

    // Draw room markers last (on top of hallways)
    roomMarkersToRender.forEach((marker) => {
      this._drawRoomMarker(ctx, marker.x, marker.y, marker.type);
    });

    // Restore context
    ctx.restore();
  }

  _drawRegularHallway(ctx, hallway) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = hallway.width;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";

    hallway.segments.forEach((segment) => {
      ctx.beginPath();
      ctx.moveTo(segment.x1, segment.y1);
      ctx.lineTo(segment.x2, segment.y2);
      ctx.stroke();
    });
  }

  _drawSecretHallway(ctx, hallway) {
    const lineWidth = hallway.width;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.lineCap = "butt";

    hallway.segments.forEach((segment) => {
      const isHorizontal = segment.y1 === segment.y2;
      const dashLength = 8;
      const gapLength = 12;
      const dashSpacing = dashLength + gapLength;

      if (isHorizontal) {
        const startX = Math.min(segment.x1, segment.x2);
        const endX = Math.max(segment.x1, segment.x2);
        const y = segment.y1;

        for (let x = startX; x <= endX; x += dashSpacing) {
          ctx.beginPath();
          ctx.moveTo(x, y - lineWidth / 2);
          ctx.lineTo(Math.min(x + dashLength, endX), y - lineWidth / 2);
          ctx.moveTo(x, y + lineWidth / 2);
          ctx.lineTo(Math.min(x + dashLength, endX), y + lineWidth / 2);
          ctx.stroke();
        }
      } else {
        const startY = Math.min(segment.y1, segment.y2);
        const endY = Math.max(segment.y1, segment.y2);
        const x = segment.x1;

        for (let y = startY; y <= endY; y += dashSpacing) {
          ctx.beginPath();
          ctx.moveTo(x - lineWidth / 2, y);
          ctx.lineTo(x - lineWidth / 2, Math.min(y + dashLength, endY));
          ctx.moveTo(x + lineWidth / 2, y);
          ctx.lineTo(x + lineWidth / 2, Math.min(y + dashLength, endY));
          ctx.stroke();
        }
      }
    });
  }

  _drawWall(ctx, wall) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = wall.width || 10; // Default to 10 if width is missing
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";

    if (!wall.segments || wall.segments.length === 0) return;

    wall.segments.forEach((segment) => {
      ctx.beginPath();
      ctx.moveTo(segment.x1, segment.y1);
      ctx.lineTo(segment.x2, segment.y2);
      ctx.stroke();
    });
  }

  _drawRoomMarker(ctx, x, y, type) {
    drawRoomMarker(ctx, x, y, type);
  }

  _drawHallwayMarker(ctx, x, y, type, hallwayWidth) {
    drawHallwayMarker(ctx, x, y, type, hallwayWidth);
  }

  _notifyViewStatus(status) {
    if (game.user.isGM) return;
    game.modules
      .get("mothership-map-viewer")
      .socketHandler.emit("playerViewStatus", {
        userId: game.user.id,
        status: status,
      });
  }

  async close(options = {}) {
    // Notify GM that this player has closed the map
    this._notifyViewStatus("closed");

    // Clean up resize observer
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    return super.close(options);
  }
}

// GM Map Viewer with controls
class MothershipMapViewer extends HandlebarsApplicationMixin(ApplicationV2) {
  static _instance = null;
  constructor(options = {}) {
    super(options);
    this.mapData = null;

    // Scroll state
    this.scrollOffset = { x: 0, y: 0 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };

    // Zoom state
    this.scale = 1.0;
    this.minScale = 0.1;
    this.maxScale = 5.0;

    // Track which players are viewing the map
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
    },
  };

  static onBugReport() {
    window.open(
      "https://github.com/eddiedover/mothership-map-viewer/issues/new",
      "_blank"
    );
  }

  static onFeedback() {
    window.open(
      "https://github.com/eddiedover/mothership-map-viewer/issues/new",
      "_blank"
    );
  }

  static onDiscord() {
    window.open("https://discord.gg/hshfZA73fG", "_blank");
  }

  static PARTS = {
    main: {
      template: "modules/mothership-map-viewer/templates/map-viewer.hbs",
    },
  };

  _prepareContext() {
    return {
      mapData: this.mapData,
      hasMap: this.mapData !== null,
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
      const canvas = document.getElementById("map-canvas");
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

  _setupCanvasResize(canvas) {
    const container = canvas.parentElement;

    // Clean up any existing observer
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }

    let resizeTimeout = null;
    let lastWidth = 0;
    let lastHeight = 0;

    // Create a resize observer to adjust canvas when container size changes
    this._resizeObserver = new ResizeObserver((entries) => {
      // Clear any pending resize
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }

      // Debounce the actual resize operation
      resizeTimeout = setTimeout(() => {
        for (const entry of entries) {
          const rect = entry.contentRect;
          const newWidth = Math.max(800, Math.floor(rect.width));
          const newHeight = Math.max(600, Math.floor(rect.height));

          // Only update if size actually changed significantly (avoid sub-pixel changes)
          if (
            Math.abs(lastWidth - newWidth) > 1 ||
            Math.abs(lastHeight - newHeight) > 1
          ) {
            lastWidth = newWidth;
            lastHeight = newHeight;

            // Temporarily disconnect to prevent loops
            this._resizeObserver.disconnect();

            canvas.width = newWidth;
            canvas.height = newHeight;
            this._renderMap(canvas);

            // Reconnect after a brief delay
            setTimeout(() => {
              if (this._resizeObserver) {
                this._resizeObserver.observe(container);
              }
            }, 150);
          }
        }
      }, 100);
    });

    this._resizeObserver.observe(container);
  }

  _fitCanvasToContainer(canvas) {
    // Make it visually fill the positioned parent
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    // ...then set the internal size to match
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  _setupCanvasDragScroll(canvas) {
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 2) {
        // Right mouse button
        this.isDragging = true;
        this.dragStart = {
          x: e.clientX - this.scrollOffset.x,
          y: e.clientY - this.scrollOffset.y,
        };
        canvas.style.cursor = "grabbing";
      }
    });

    canvas.addEventListener("mousemove", (e) => {
      if (this.isDragging) {
        this.scrollOffset = {
          x: e.clientX - this.dragStart.x,
          y: e.clientY - this.dragStart.y,
        };
        this._renderMap(canvas);
      }
    });

    canvas.addEventListener("mouseup", (e) => {
      if (e.button === 2) {
        this.isDragging = false;
        canvas.style.cursor = "default";
      }
    });

    canvas.addEventListener("mouseleave", () => {
      if (this.isDragging) {
        this.isDragging = false;
        canvas.style.cursor = "default";
      }
    });
  }

  _setupCanvasZoom(canvas) {
    canvas.addEventListener(
      "wheel",
      (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Zoom in/out
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(
          this.minScale,
          Math.min(this.maxScale, this.scale * delta)
        );

        // Zoom towards cursor position
        const scaleDiff = newScale / this.scale;
        this.scrollOffset.x =
          mouseX - (mouseX - this.scrollOffset.x) * scaleDiff;
        this.scrollOffset.y =
          mouseY - (mouseY - this.scrollOffset.y) * scaleDiff;

        this.scale = newScale;
        this._renderMap(canvas);
      },
      { passive: true }
    );
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
          this.mapData = JSON.parse(text);
          this._initializeVisibilityFlags();
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
        this.mapData = await decodeShareString(shareString);
        this._initializeVisibilityFlags();
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

  _initializeVisibilityFlags() {
    if (!this.mapData) return;

    // Initialize room visibility flags
    if (this.mapData.rooms) {
      this.mapData.rooms.forEach((room) => {
        if (room.visible === undefined) room.visible = true;
        if (room.markers) {
          room.markers.forEach((marker) => {
            if (marker.visible === undefined) marker.visible = true;
          });
        }
      });
    }

    // Initialize hallway visibility flags
    if (this.mapData.hallways) {
      this.mapData.hallways.forEach((hallway) => {
        if (hallway.visible === undefined) hallway.visible = true;
        if (hallway.startMarker && hallway.startMarker.visible === undefined) {
          hallway.startMarker.visible = true;
        }
        if (hallway.endMarker && hallway.endMarker.visible === undefined) {
          hallway.endMarker.visible = true;
        }
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

    controlsHTML += "</div>";
    controlsContainer.innerHTML = controlsHTML;

    // Attach event listeners
    controlsContainer
      .querySelectorAll(".room-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const index = parseInt(e.target.dataset.index);
          this.mapData.rooms[index].visible = e.target.checked;
          this._renderMap(document.getElementById("map-canvas"));
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
          this._renderMap(document.getElementById("map-canvas"));
          this._autoUpdatePlayers();
        });
      });

    controlsContainer
      .querySelectorAll(".hallway-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const index = parseInt(e.target.dataset.index);
          this.mapData.hallways[index].visible = e.target.checked;
          this._renderMap(document.getElementById("map-canvas"));
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
          this._renderMap(document.getElementById("map-canvas"));
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
          this._renderMap(document.getElementById("map-canvas"));
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
          this._renderMap(document.getElementById("map-canvas"));
          this._autoUpdatePlayers();
        });
      });

    controlsContainer
      .querySelectorAll(".wall-visibility")
      .forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const index = parseInt(e.target.dataset.index);
          this.mapData.walls[index].visible = e.target.checked;
          this._renderMap(document.getElementById("map-canvas"));
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

    game.modules
      .get("mothership-map-viewer")
      .socketHandler.emit("displayMap", this.mapData);
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
        .socketHandler.emit("updateMap", this.mapData);
    }
  }

  updatePlayerViewStatus(userId, status) {
    if (status === "opened") {
      this.activeViewers.add(userId);
    } else if (status === "closed") {
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

      html += `
        <div class="viewer-item ${!isOnline ? "offline" : ""}">
          <span class="viewer-status ${statusClass}"></span>
          <span class="viewer-name">${user.name}</span>
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
  }

  _reopenMapForPlayer(userId) {
    if (!this.mapData) return;

    // Emit to specific user
    game.socket.emit(
      "module.mothership-map-viewer",
      { type: "displayMap", payload: this.mapData },
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

  _renderMap(canvas) {
    if (!canvas || !this.mapData) return;

    const ctx = canvas.getContext("2d");
    const WALL_THICKNESS = 10;

    // Clear canvas
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply scroll offset and zoom
    ctx.save();
    ctx.translate(this.scrollOffset.x, this.scrollOffset.y);
    ctx.scale(this.scale, this.scale);

    // Collect room markers to draw them last (on top of hallways)
    const roomMarkersToRender = [];

    // Draw rooms first
    if (this.mapData.rooms) {
      this.mapData.rooms.forEach((room) => {
        if (!room.visible) return;

        if (room.shape === "circle") {
          // Circle room
          const centerX = room.x + room.width / 2;
          const centerY = room.y + room.height / 2;
          const radius = room.radius || Math.min(room.width, room.height) / 2;

          // Fill
          ctx.fillStyle = "#000000";
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fill();

          // Border
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = WALL_THICKNESS;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Rectangle room (default)
          // Fill
          ctx.fillStyle = "#000000";
          ctx.fillRect(room.x, room.y, room.width, room.height);

          // Border
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = WALL_THICKNESS;
          ctx.strokeRect(room.x, room.y, room.width, room.height);
        }

        // Collect visible markers for later rendering
        if (room.markers) {
          room.markers.forEach((marker) => {
            if (marker.visible) {
              roomMarkersToRender.push({
                x: room.x + marker.x,
                y: room.y + marker.y,
                type: marker.type,
              });
            }
          });
        }

        // Label
        if (room.label) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 14px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            room.label,
            room.x + room.width / 2,
            room.y + room.height / 2
          );
        }
      });
    }

    // Draw hallways and markers
    if (this.mapData.hallways) {
      this.mapData.hallways.forEach((hallway) => {
        // Draw hallway body only if visible
        if (hallway.visible) {
          if (hallway.isSecret) {
            this._drawSecretHallway(ctx, hallway);
          } else {
            this._drawRegularHallway(ctx, hallway);
          }

          // Label (commented out in GM view)
          // if (hallway.label && hallway.segments.length > 0) {
          //   const midSegment =
          //     hallway.segments[Math.floor(hallway.segments.length / 2)];
          //   const midX = (midSegment.x1 + midSegment.x2) / 2;
          //   const midY = (midSegment.y1 + midSegment.y2) / 2;
          //   ctx.fillStyle = "#000000";
          //   ctx.strokeStyle = "#ffffff";
          //   ctx.lineWidth = 3;
          //   ctx.font = "bold 12px sans-serif";
          //   ctx.textAlign = "center";
          //   ctx.textBaseline = "middle";
          //   ctx.strokeText(hallway.label, midX, midY);
          //   ctx.fillText(hallway.label, midX, midY);
          // }
        }

        // Draw endpoint markers independently of hallway visibility
        if (hallway.nodes && hallway.nodes.length >= 2) {
          const firstNode = hallway.nodes[0];
          const lastNode = hallway.nodes[hallway.nodes.length - 1];

          if (
            hallway.startMarker &&
            hallway.startMarker.type !== "none" &&
            hallway.startMarker.visible
          ) {
            this._drawHallwayMarker(
              ctx,
              firstNode.x,
              firstNode.y,
              hallway.startMarker.type,
              hallway.width
            );
          }
          if (
            hallway.endMarker &&
            hallway.endMarker.type !== "none" &&
            hallway.endMarker.visible
          ) {
            this._drawHallwayMarker(
              ctx,
              lastNode.x,
              lastNode.y,
              hallway.endMarker.type,
              hallway.width
            );
          }
        }
      });
    }

    // Draw standalone walls (only visible ones)
    if (this.mapData.walls) {
      this.mapData.walls.forEach((wall) => {
        if (wall.visible !== false) {
          this._drawWall(ctx, wall);
        }
      });
    }

    // Draw room walls (only for visible rooms)
    if (this.mapData.rooms) {
      this.mapData.rooms.forEach((room) => {
        if (room.visible && room.walls && room.walls.length > 0) {
          room.walls.forEach((wall) => {
            this._drawWall(ctx, wall);
          });
        }
      });
    }

    // Draw room markers last (on top of hallways)
    roomMarkersToRender.forEach((marker) => {
      this._drawRoomMarker(ctx, marker.x, marker.y, marker.type);
    });

    // Restore context
    ctx.restore();
  }

  _drawRegularHallway(ctx, hallway) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = hallway.width;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";

    hallway.segments.forEach((segment) => {
      ctx.beginPath();
      ctx.moveTo(segment.x1, segment.y1);
      ctx.lineTo(segment.x2, segment.y2);
      ctx.stroke();
    });
  }

  _drawSecretHallway(ctx, hallway) {
    const lineWidth = hallway.width;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.lineCap = "butt";

    hallway.segments.forEach((segment) => {
      const isHorizontal = segment.y1 === segment.y2;
      const dashLength = 8;
      const gapLength = 12;
      const dashSpacing = dashLength + gapLength;

      if (isHorizontal) {
        const startX = Math.min(segment.x1, segment.x2);
        const endX = Math.max(segment.x1, segment.x2);
        const y = segment.y1;

        for (let x = startX; x <= endX; x += dashSpacing) {
          ctx.beginPath();
          ctx.moveTo(x, y - lineWidth / 2);
          ctx.lineTo(Math.min(x + dashLength, endX), y - lineWidth / 2);
          ctx.moveTo(x, y + lineWidth / 2);
          ctx.lineTo(Math.min(x + dashLength, endX), y + lineWidth / 2);
          ctx.stroke();
        }
      } else {
        const startY = Math.min(segment.y1, segment.y2);
        const endY = Math.max(segment.y1, segment.y2);
        const x = segment.x1;

        for (let y = startY; y <= endY; y += dashSpacing) {
          ctx.beginPath();
          ctx.moveTo(x - lineWidth / 2, y);
          ctx.lineTo(x - lineWidth / 2, Math.min(y + dashLength, endY));
          ctx.moveTo(x + lineWidth / 2, y);
          ctx.lineTo(x + lineWidth / 2, Math.min(y + dashLength, endY));
          ctx.stroke();
        }
      }
    });
  }

  _drawWall(ctx, wall) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = wall.width || 10; // Default to 10 if width is missing
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";

    if (!wall.segments || wall.segments.length === 0) return;

    wall.segments.forEach((segment) => {
      ctx.beginPath();
      ctx.moveTo(segment.x1, segment.y1);
      ctx.lineTo(segment.x2, segment.y2);
      ctx.stroke();
    });
  }

  _drawRoomMarker(ctx, x, y, type) {
    drawRoomMarker(ctx, x, y, type);
  }

  _drawHallwayMarker(ctx, x, y, type, hallwayWidth) {
    drawHallwayMarker(ctx, x, y, type, hallwayWidth);
  }

  async close(options = {}) {
    // Clean up resize observer
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    return super.close(options);
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
