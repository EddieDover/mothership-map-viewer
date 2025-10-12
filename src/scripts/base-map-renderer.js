/**
 * Base Map Renderer for Foundry VTT
 * Shared functionality for both GM and Player map views
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { drawHallwayMarker, drawRoomMarker } from "./map-icons.js";

/**
 * Base class for map rendering with canvas management
 */
export class BaseMapRenderer extends HandlebarsApplicationMixin(ApplicationV2) {
  // Shared constants
  static WALL_THICKNESS = 10;
  static DEFAULT_SCALE = 1.0;
  static MIN_SCALE = 0.1;
  static MAX_SCALE = 5.0;

  constructor(options = {}) {
    super(options);

    // Scroll state
    this.scrollOffset = { x: 0, y: 0 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };

    // Zoom state
    this.scale = BaseMapRenderer.DEFAULT_SCALE;
    this.minScale = BaseMapRenderer.MIN_SCALE;
    this.maxScale = BaseMapRenderer.MAX_SCALE;
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

    // Clear canvas
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply scroll offset and zoom
    ctx.save();
    ctx.translate(this.scrollOffset.x, this.scrollOffset.y);
    ctx.scale(this.scale, this.scale);

    // Collect room markers to draw them last (on top of hallways)
    const roomMarkersToRender = [];
    const roomLabelsToRender = [];

    // Draw only visible rooms
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
          ctx.lineWidth = BaseMapRenderer.WALL_THICKNESS;
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
          ctx.lineWidth = BaseMapRenderer.WALL_THICKNESS;
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

        // Collect visible labels for later rendering
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

    // Draw room labels (on top of markers)
    roomLabelsToRender.forEach((label) => {
      this._drawRoomLabel(ctx, label.x, label.y, label.text);
    });

    // Draw standalone markers (not in rooms)
    if (
      this.mapData.standaloneMarkers &&
      this.mapData.standaloneMarkers.length > 0
    ) {
      this.mapData.standaloneMarkers.forEach((marker) => {
        if (marker.visible !== false) {
          this._drawRoomMarker(ctx, marker.x, marker.y, marker.type);
        }
      });
    }

    // Draw standalone labels (not in rooms)
    if (
      this.mapData.standaloneLabels &&
      this.mapData.standaloneLabels.length > 0
    ) {
      this.mapData.standaloneLabels.forEach((label) => {
        if (label.visible !== false) {
          this._drawStandaloneLabel(ctx, label.x, label.y, label.text);
        }
      });
    }

    // Restore context
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
