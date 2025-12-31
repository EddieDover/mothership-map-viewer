/**
 * Base Map Renderer for Foundry VTT
 * Shared functionality for both GM and Player map views
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { drawHallwayMarker, drawRoomMarker } from "./map-icons.js";
import { MapRenderer3D } from "./map-renderer-3d.js";

/**
 * Base class for map rendering with canvas management
 */
export class BaseMapRenderer extends HandlebarsApplicationMixin(ApplicationV2) {
  // Shared constants
  static WALL_THICKNESS = 10;
  static DEFAULT_SCALE = 1;
  static MIN_SCALE = 0.1;
  static MAX_SCALE = 5;

  constructor(options = {}) {
    super(options);

    this.scrollOffset = { x: 0, y: 0 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };

    this.scale = BaseMapRenderer.DEFAULT_SCALE;
    this.minScale = BaseMapRenderer.MIN_SCALE;
    this.maxScale = BaseMapRenderer.MAX_SCALE;

    this.currentFloor = 1;
    this.is3DMode = false;
    this.renderer3d = null;
  }

  setFloor(floor) {
    this.currentFloor = floor;
    const display = this.element.querySelector("#currentFloorDisplay");
    if (display) {
      display.textContent = `Floor ${floor}`;
    }

    if (this.is3DMode && this.renderer3d) {
      this.renderer3d.update(this.mapData, this.currentFloor);
      if (this.playerLocations) {
        this.renderer3d.updatePlayerMarkers(this.playerLocations);
      }
    } else {
      const canvas = document.getElementById(this.getCanvasId());
      if (canvas) {
        this._renderMap(canvas);
      }
    }
  }

  /**
   * Refresh the map display (2D or 3D) without full re-render
   */
  refreshMap() {
    if (this.is3DMode && this.renderer3d) {
      this.renderer3d.update(this.mapData, this.currentFloor);
      if (this.playerLocations) {
        this.renderer3d.updatePlayerMarkers(this.playerLocations);
      }
    } else {
      const canvas = document.getElementById(this.getCanvasId());
      if (canvas) {
        this._renderMap(canvas);
      }
    }
  }

  set3DMode(enabled, force = false) {
    if (this.is3DMode === enabled && !force) return;
    this.is3DMode = enabled;

    // Save preference if this is the GM viewer
    if (game.user.isGM && this.constructor.name === "MothershipMapViewer") {
      game.settings.set("mothership-map-viewer", "default3DMode", enabled);
    }

    const btn = this.element.querySelector("#toggle-3d-btn");
    const canvas = document.getElementById(this.getCanvasId());
    const container = this.element.querySelector("#map-container");

    if (this.is3DMode) {
      if (btn) {
        btn.innerHTML = '<i class="fas fa-layer-group"></i> 2D Mode';
        btn.title = "Switch to 2D Mode";
      }
      if (canvas) canvas.style.display = "none";

      // Capture camera state if re-initializing
      let cameraState = null;
      if (
        force &&
        this.renderer3d &&
        this.renderer3d.camera &&
        this.renderer3d.controls
      ) {
        cameraState = {
          position: this.renderer3d.camera.position.clone(),
          target: this.renderer3d.controls.target.clone(),
        };
      }

      // If forcing, dispose old renderer first
      if (force && this.renderer3d) {
        this.renderer3d.dispose();
        this.renderer3d = null;
      }

      if (!this.renderer3d) {
        this.renderer3d = new MapRenderer3D(container);
      }

      this.renderer3d.init();

      // Force a resize check after a short delay to ensure correct sizing after DOM settlement
      setTimeout(() => {
        if (this.renderer3d) {
          this.renderer3d.onWindowResize();
        }
      }, 100);

      if (cameraState) {
        this.renderer3d.camera.position.copy(cameraState.position);
        this.renderer3d.controls.target.copy(cameraState.target);
        this.renderer3d.controls.update();
      }

      this.renderer3d.update(this.mapData, this.currentFloor);
      if (this.playerLocations) {
        this.renderer3d.updatePlayerMarkers(this.playerLocations);
      }
    } else {
      if (btn) {
        btn.innerHTML = '<i class="fas fa-cube"></i> 3D Mode';
        btn.title = "Switch to 3D Mode";
      }
      if (canvas) {
        canvas.style.display = "block";
        this._fitCanvasToContainer(canvas);
      }

      if (this.renderer3d) {
        this.renderer3d.dispose();
        this.renderer3d = null;
      }

      if (canvas) this._renderMap(canvas);
    }
  }

  toggle3DMode() {
    this.set3DMode(!this.is3DMode);
  }

  /**
   * Center the view on all rooms on the current floor
   */
  centerView() {
    if (!this.mapData || !this.mapData.rooms) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let hasRooms = false;

    this.mapData.rooms.forEach((room) => {
      const roomFloor = room.floor !== undefined ? room.floor : 1;
      if (roomFloor !== this.currentFloor) return;

      hasRooms = true;
      // Use width/height for bounds calculation as they are populated for both shapes
      // (Circle rooms have width/height = radius * 2 in some contexts, or we use x/y as top-left)
      const width = room.width || (room.radius ? room.radius * 2 : 0);
      const height = room.height || (room.radius ? room.radius * 2 : 0);

      minX = Math.min(minX, room.x);
      minY = Math.min(minY, room.y);
      maxX = Math.max(maxX, room.x + width);
      maxY = Math.max(maxY, room.y + height);
    });

    const canvas = document.getElementById(this.getCanvasId());
    if (hasRooms) {
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      if (this.is3DMode && this.renderer3d) {
        this.renderer3d.focusOn(centerX, 0, centerY);
      } else if (canvas) {
        this.scrollOffset.x = canvas.width / 2 - centerX * this.scale;
        this.scrollOffset.y = canvas.height / 2 - centerY * this.scale;
        this._renderMap(canvas);
      }
    } else if (canvas) {
      this.scrollOffset.x = 0;
      this.scrollOffset.y = 0;
      this._renderMap(canvas);
    }
  }

  /**
   * Get the canvas element ID (to be overridden by subclasses)
   */
  getCanvasId() {
    throw new Error("getCanvasId() must be implemented by subclass");
  }

  /**
   * Setup canvas resize observer with debouncing
   */
  _setupCanvasResize(canvas) {
    const container = canvas.parentElement;

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }

    let resizeTimeout = null;
    let lastWidth = 0;
    let lastHeight = 0;

    this._resizeObserver = new ResizeObserver((entries) => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }

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

            if (this.is3DMode && this.renderer3d) {
              this.renderer3d.onWindowResize();
            } else {
              // Temporarily disconnect to prevent loops
              this._resizeObserver.disconnect();

              canvas.width = newWidth;
              canvas.height = newHeight;
              this._renderMap(canvas);

              setTimeout(() => {
                if (this._resizeObserver) {
                  this._resizeObserver.observe(container);
                }
              }, 150);
            }
          }
        }
      }, 100);
    });

    this._resizeObserver.observe(container);
  }

  /**
   * Fit canvas to its container
   */
  _fitCanvasToContainer(canvas) {
    // Make it visually fill the positioned parent
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    // ...then set the internal size to match
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  /**
   * Setup canvas drag scrolling with right mouse button
   */
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

  /**
   * Setup canvas zoom with mouse wheel
   */
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

  /**
   * Render the map on the canvas
   */
  _renderMap(canvas) {
    if (!canvas || !this.mapData) return;

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(this.scrollOffset.x, this.scrollOffset.y);
    ctx.scale(this.scale, this.scale);

    // Collect room markers to draw them last (on top of hallways)
    const roomMarkersToRender = [];
    const roomLabelsToRender = [];

    if (this.mapData.rooms) {
      this.mapData.rooms.forEach((room) => {
        if (!room.visible) return;

        const roomFloor = room.floor !== undefined ? room.floor : 1;
        if (roomFloor !== this.currentFloor) return;

        if (room.shape === "circle") {
          const centerX = room.x + room.width / 2;
          const centerY = room.y + room.height / 2;
          const radius = room.radius || Math.min(room.width, room.height) / 2;

          ctx.fillStyle = "#000000";
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = BaseMapRenderer.WALL_THICKNESS;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = "#000000";
          ctx.fillRect(room.x, room.y, room.width, room.height);

          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = BaseMapRenderer.WALL_THICKNESS;
          ctx.strokeRect(room.x, room.y, room.width, room.height);
        }

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

        if (room.labels) {
          room.labels.forEach((label) => {
            if (label.visible !== false) {
              roomLabelsToRender.push({
                x: room.x + label.x,
                y: room.y + label.y,
                text: label.text,
              });
            }
          });
        }

        let shouldRenderLabel = false;
        let labelText = room.label;

        if (room.label) {
          if (room.labelVisible !== false) {
            shouldRenderLabel = true;
          } else if (game.user.isGM) {
            shouldRenderLabel = true;
            labelText = `(${room.label})`;
          }
        }

        if (shouldRenderLabel) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 14px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            labelText,
            room.x + room.width / 2,
            room.y + room.height / 2
          );
        }
      });
    }

    if (this.mapData.hallways) {
      this.mapData.hallways.forEach((hallway) => {
        const hallwayFloor = hallway.floor !== undefined ? hallway.floor : 1;
        if (hallwayFloor !== this.currentFloor) return;

        if (hallway.visible) {
          if (hallway.isSecret) {
            this._drawSecretHallway(ctx, hallway);
          } else {
            this._drawRegularHallway(ctx, hallway);
          }
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
              hallway.width,
              hallway.startMarker.rotation
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
              hallway.width,
              hallway.endMarker.rotation
            );
          }
        }
      });
    }

    if (this.mapData.walls) {
      this.mapData.walls.forEach((wall) => {
        const wallFloor = wall.floor !== undefined ? wall.floor : 1;
        if (wallFloor !== this.currentFloor) return;

        if (wall.visible !== false) {
          this._drawWall(ctx, wall);
        }
      });
    }

    // Draw room walls (always visible for visible rooms in player view)
    if (this.mapData.rooms) {
      this.mapData.rooms.forEach((room) => {
        const roomFloor = room.floor !== undefined ? room.floor : 1;
        if (roomFloor !== this.currentFloor) return;

        if (room.visible && room.walls && room.walls.length > 0) {
          room.walls.forEach((wall) => {
            this._drawWall(ctx, wall);
          });
        }
      });
    }

    roomMarkersToRender.forEach((marker) => {
      this._drawRoomMarker(ctx, marker.x, marker.y, marker.type);
    });

    roomLabelsToRender.forEach((label) => {
      this._drawRoomLabel(ctx, label.x, label.y, label.text);
    });

    if (
      this.mapData.standaloneMarkers &&
      this.mapData.standaloneMarkers.length > 0
    ) {
      this.mapData.standaloneMarkers.forEach((marker) => {
        const markerFloor = marker.floor !== undefined ? marker.floor : 1;
        if (markerFloor !== this.currentFloor) return;

        if (marker.visible !== false) {
          this._drawRoomMarker(ctx, marker.x, marker.y, marker.type);
        }
      });
    }

    if (
      this.mapData.standaloneLabels &&
      this.mapData.standaloneLabels.length > 0
    ) {
      this.mapData.standaloneLabels.forEach((label) => {
        const labelFloor = label.floor !== undefined ? label.floor : 1;
        if (labelFloor !== this.currentFloor) return;

        if (label.visible !== false) {
          this._drawStandaloneLabel(ctx, label.x, label.y, label.text);
        }
      });
    }

    ctx.restore();
  }

  /**
   * Draw a regular hallway
   */
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

  /**
   * Draw a secret hallway with dashed lines
   */
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

  /**
   * Draw a wall (regular or dotted)
   */
  _drawWall(ctx, wall) {
    if (wall.isDotted) {
      // Dotted walls are drawn with dashes parallel to direction
      const lineWidth = wall.width || 10;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.lineCap = "butt";

      if (!wall.segments || wall.segments.length === 0) return;

      wall.segments.forEach((segment) => {
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
    } else {
      // Regular walls are drawn with solid lines
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
  }

  /**
   * Draw a room marker
   */
  _drawRoomMarker(ctx, x, y, type) {
    drawRoomMarker(ctx, x, y, type);
  }

  /**
   * Draw a room label (inside a room)
   */
  _drawRoomLabel(ctx, x, y, text) {
    // Draw text with white fill and black outline (same as standalone labels)
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw black outline
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.strokeText(text, x, y);

    // Draw white fill
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, x, y);
  }

  /**
   * Draw a standalone label
   */
  _drawStandaloneLabel(ctx, x, y, text) {
    // Draw text with white fill and black outline
    ctx.font = "16px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw black outline
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.strokeText(text, x, y);

    // Draw white fill
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, x, y);
  }

  /**
   * Draw a hallway marker
   */
  _drawHallwayMarker(ctx, x, y, type, hallwayWidth, rotation) {
    drawHallwayMarker(ctx, x, y, type, hallwayWidth, rotation);
  }

  /**
   * Clean up resources on close
   */
  async close(options = {}) {
    // Clean up resize observer
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    return super.close(options);
  }
}
