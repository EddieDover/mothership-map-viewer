/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/**
 * Handles rendering of the map on the canvas
 */

/** @type {import("./types").MapRenderer} */
class MapRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.gridSize = GRID_SIZE;
    this.showGrid = true;
    this.snapToGridEnabled = false; // Grid snapping toggle
    this.offsetX = 0;
    this.offsetY = 0;
  }

  /**
   * Clear the canvas
   *
   * @memberof MapRenderer
   */
  clear() {
    // Save the current transformation
    this.ctx.save();
    // Reset transformation to clear entire canvas
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // Restore transformation
    this.ctx.restore();
  }

  /**
   * Draw the grid on the canvas (with offset transformation applied)
   *
   * @memberof MapRenderer
   */
  drawGrid() {
    this.ctx.strokeStyle = "#222222";
    this.ctx.lineWidth = 0.5;

    // Calculate visible grid bounds
    const startX = Math.floor(-this.offsetX / this.gridSize) * this.gridSize;
    const endX =
      Math.floor((this.canvas.width - this.offsetX) / this.gridSize) *
        this.gridSize +
      this.gridSize;
    const startY = Math.floor(-this.offsetY / this.gridSize) * this.gridSize;
    const endY =
      Math.floor((this.canvas.height - this.offsetY) / this.gridSize) *
        this.gridSize +
      this.gridSize;

    // Vertical lines
    for (let x = startX; x <= endX; x += this.gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, endY);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += this.gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
      this.ctx.stroke();
    }
  }

  /**
   * Render the entire map
   *
   * @param {import("./types").MapData} mapData
   * @param {import("./types").Room|import("./types").Hallway|null} [selectedItem=null]
   * @memberof MapRenderer
   */
  render(mapData, selectedItem = null) {
    this.clear();

    // Apply offset transformation
    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);

    // Draw grid with offset transformation
    if (this.showGrid) {
      this.drawGrid();
    }

    // Draw rooms first, then hallways (so hallways are on top)
    mapData.rooms.forEach((room) => {
      const isRoomSelected =
        selectedItem?.type === "room" && selectedItem?.id === room.id;
      // Pass selected marker info if a marker in this room is selected
      const selectedMarkerIndex =
        selectedItem?.type === "marker" && selectedItem?.room.id === room.id
          ? selectedItem.markerIndex
          : null;
      // Pass selected label info if a label in this room is selected
      const selectedLabelIndex =
        selectedItem?.type === "roomLabel" && selectedItem?.room.id === room.id
          ? selectedItem.labelIndex
          : null;

      this.drawRoom(
        room,
        isRoomSelected,
        selectedMarkerIndex,
        selectedLabelIndex
      );
    });

    mapData.hallways.forEach((hallway) => {
      const isHallwaySelected =
        selectedItem?.type === "hallway" && selectedItem?.id === hallway.id;
      this.drawHallway(hallway, isHallwaySelected);
    });

    // Draw standalone walls (not in rooms)
    mapData.walls.forEach((wall) => {
      const isWallSelected =
        selectedItem?.type === "wall" && selectedItem?.id === wall.id;
      this.drawWall(wall, isWallSelected);
    });

    // Draw walls inside rooms
    mapData.rooms.forEach((room) => {
      if (room.walls && room.walls.length > 0) {
        // Always show walls in rooms
        room.walls.forEach((wall) => {
          const isWallSelected =
            selectedItem?.type === "wall" && selectedItem?.id === wall.id;
          this.drawWall(wall, isWallSelected);
        });
      }
    });

    // Draw standalone markers (not in rooms)
    if (mapData.standaloneMarkers && mapData.standaloneMarkers.length > 0) {
      mapData.standaloneMarkers.forEach((marker) => {
        const isMarkerSelected =
          selectedItem?.type === "standaloneMarker" &&
          selectedItem?.marker.id === marker.id;
        this.drawRoomMarker(
          this.ctx,
          marker.x,
          marker.y,
          marker.type,
          isMarkerSelected,
          16,
          marker.rotation || 0
        );
      });
    }

    // Draw standalone labels
    if (mapData.standaloneLabels && mapData.standaloneLabels.length > 0) {
      mapData.standaloneLabels.forEach((label) => {
        const isLabelSelected =
          selectedItem?.type === "standaloneLabel" &&
          selectedItem?.label.id === label.id;
        this.drawStandaloneLabel(
          this.ctx,
          label.x,
          label.y,
          label.text,
          isLabelSelected
        );
      });
    }

    // Restore transformation
    this.ctx.restore();
  }

  /**
   * Draw a single room
   *
   * @param {import("./types").Room} room
   * @param {boolean} isSelected
   * @param {number|null} selectedMarkerIndex - Index of selected marker, or null
   * @param {number|null} selectedLabelIndex - Index of selected label, or null
   * @memberof MapRenderer
   */
  drawRoom(
    room,
    isSelected,
    selectedMarkerIndex = null,
    selectedLabelIndex = null
  ) {
    if (room.shape === "circle") {
      // Circle room
      const centerX = room.x + room.radius;
      const centerY = room.y + room.radius;
      const radius = room.radius;

      // Fill - black
      this.ctx.fillStyle = "#000000";
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Border - thick white (or thicker if selected)
      this.ctx.strokeStyle = isSelected ? "#0051ffff" : "#ffffff";
      this.ctx.lineWidth = isSelected ? WALL_THICKNESS + 4 : WALL_THICKNESS;
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.stroke();

      // Draw room markers
      if (room.markers && room.markers.length > 0) {
        room.markers.forEach((marker, index) => {
          const isMarkerSelected = selectedMarkerIndex === index;
          this.drawRoomMarker(
            this.ctx,
            room.x + marker.x,
            room.y + marker.y,
            marker.type,
            isMarkerSelected,
            16,
            marker.rotation || 0
          );
        });
      }

      // Draw room labels
      if (room.labels && room.labels.length > 0) {
        room.labels.forEach((label, index) => {
          const isLabelSelected = selectedLabelIndex === index;
          this.drawRoomLabel(
            this.ctx,
            room.x + label.x,
            room.y + label.y,
            label.text,
            isLabelSelected
          );
        });
      }

      // Label - white (drawn last so it's on top)
      if (room.label) {
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "bold 14px sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(room.label, centerX, centerY);
      }
    } else {
      // Rectangle room (default)
      // Fill - black
      this.ctx.fillStyle = "#000000";
      this.ctx.fillRect(room.x, room.y, room.width, room.height);

      // Border - thick white (or thicker if selected)
      this.ctx.strokeStyle = isSelected ? "#0051ffff" : "#ffffff";
      this.ctx.lineWidth = isSelected ? WALL_THICKNESS + 4 : WALL_THICKNESS;
      this.ctx.strokeRect(room.x, room.y, room.width, room.height);

      // Draw room markers
      if (room.markers && room.markers.length > 0) {
        room.markers.forEach((marker, index) => {
          const isMarkerSelected = selectedMarkerIndex === index;
          this.drawRoomMarker(
            this.ctx,
            room.x + marker.x,
            room.y + marker.y,
            marker.type,
            isMarkerSelected,
            16,
            marker.rotation || 0
          );
        });
      }

      // Draw room labels
      if (room.labels && room.labels.length > 0) {
        room.labels.forEach((label, index) => {
          const isLabelSelected = selectedLabelIndex === index;
          this.drawRoomLabel(
            this.ctx,
            room.x + label.x,
            room.y + label.y,
            label.text,
            isLabelSelected
          );
        });
      }

      // Label - white (drawn last so it's on top)
      if (room.label) {
        const labelText =
          room.labelVisible !== false ? room.label : `(${room.label})`;
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "bold 14px sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(
          labelText,
          room.x + room.width / 2,
          room.y + room.height / 2
        );
      }
    }
  }

  /**
   * Draw a room marker icon
   * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {string} type - Marker type (terminal, hazard, loot, npc, door, ladder, window, airlock)
   * @param {boolean} isSelected - Whether the marker is selected (for highlighting)
   * @param {number} size - Size of the marker (default 16)
   */

  drawRoomMarker(ctx, x, y, type, isSelected = false, size = 16, rotation = 0) {
    const markerDef = ROOM_MARKER_PATHS[type] || ROOM_MARKER_PATHS.terminal;

    // Calculate scale factor
    // Paths use coordinates around 8-24 range, centered at 16,16
    const scale = size / 16;

    // Save context state
    ctx.save();

    // Apply rotation if specified (before other transforms)
    if (rotation !== 0) {
      ctx.translate(x, y);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-x, -y);
    }

    // Translate to marker position
    // Paths are centered at 16,16 in path coordinate space
    // We translate so that point 16,16 aligns with x,y in canvas space
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.translate(-16, -16);

    // Set drawing styles
    ctx.strokeStyle = isSelected ? "#0051ffff" : "#ffffff";
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = 2 / scale; // Adjust line width to maintain visual weight

    // Draw each path
    for (const pathData of markerDef.paths) {
      const path = new Path2D(pathData);
      if (markerDef.fill) {
        ctx.fill(path);
      }
      if (markerDef.stroke) {
        ctx.stroke(path);
      }
    }

    // Draw text if defined
    if (markerDef.text) {
      ctx.font = markerDef.text.font;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(markerDef.text.content, markerDef.text.x, markerDef.text.y);
    }

    ctx.restore(); // Restore the context state after rotation
  }

  /**
   * Draw a standalone label
   * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {string} text - Label text
   * @param {boolean} isSelected - Whether the label is selected (for highlighting)
   */
  drawStandaloneLabel(ctx, x, y, text, isSelected = false) {
    ctx.fillStyle = isSelected ? "#0051ffff" : "#ffffff";
    ctx.strokeStyle = "#000000";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;

    // Draw text with outline
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  /**
   * Draw a label inside a room
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - Absolute X coordinate
   * @param {number} y - Absolute Y coordinate
   * @param {string} text - Label text
   * @param {boolean} isSelected - Whether the label is selected
   */
  drawRoomLabel(ctx, x, y, text, isSelected = false) {
    ctx.fillStyle = isSelected ? "#0051ffff" : "#ffffff";
    ctx.strokeStyle = "#000000";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;

    // Draw text with outline
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  /**
   * Draw dashed lines for segments (used by secret hallways and dotted walls)
   * @param {Array} segments - Array of line segments
   * @param {number} lineWidth - Width of the line
   * @param {boolean} isSelected - Whether the item is selected
   * @private
   */
  _drawDashedSegments(segments, lineWidth, isSelected) {
    this.ctx.strokeStyle = isSelected ? "#0051ffff" : "#ffffff";
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = "butt";

    segments.forEach((segment) => {
      const isHorizontal = segment.y1 === segment.y2;
      const dashLength = DASH_LENGTH;
      const gapLength = DASH_GAP_LENGTH;
      const dashSpacing = dashLength + gapLength;

      if (isHorizontal) {
        // For horizontal lines (left to right), draw horizontal dashes
        const startX = Math.min(segment.x1, segment.x2);
        const endX = Math.max(segment.x1, segment.x2);
        const y = segment.y1;

        for (let x = startX; x <= endX; x += dashSpacing) {
          this.ctx.beginPath();
          this.ctx.moveTo(x, y - lineWidth / 2);
          this.ctx.lineTo(Math.min(x + dashLength, endX), y - lineWidth / 2);
          this.ctx.moveTo(x, y + lineWidth / 2);
          this.ctx.lineTo(Math.min(x + dashLength, endX), y + lineWidth / 2);
          this.ctx.stroke();
        }
      } else {
        // For vertical lines (top to bottom), draw vertical dashes
        const startY = Math.min(segment.y1, segment.y2);
        const endY = Math.max(segment.y1, segment.y2);
        const x = segment.x1;

        for (let y = startY; y <= endY; y += dashSpacing) {
          this.ctx.beginPath();
          this.ctx.moveTo(x - lineWidth / 2, y);
          this.ctx.lineTo(x - lineWidth / 2, Math.min(y + dashLength, endY));
          this.ctx.moveTo(x + lineWidth / 2, y);
          this.ctx.lineTo(x + lineWidth / 2, Math.min(y + dashLength, endY));
          this.ctx.stroke();
        }
      }
    });
  }

  /**
   * Draw a hallway marker icon
   * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {string} type - Marker type (door, grate, airlock)
   * @param {number} hallwayWidth - Width of the hallway (affects marker size)
   * @param {boolean} isSelected - Whether the marker is selected (for highlighting)
   * @param {number} rotation - Rotation angle in degrees (default 0)
   */

  drawHallwayMarker(
    ctx,
    x,
    y,
    type,
    hallwayWidth,
    isSelected = false,
    rotation = 0
  ) {
    const markerDef = HALLWAY_MARKER_PATHS[type];
    if (!markerDef) return;

    const size = hallwayWidth * 1.5;

    // Calculate scale factor
    // Paths are 16x16 (from 8 to 24), so we scale based on 16
    const scale = size / 16;

    // Save context state
    ctx.save();

    // Apply rotation if specified (before other transforms)
    if (rotation !== 0) {
      ctx.translate(x, y);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-x, -y);
    }

    // Translate to marker position
    // Paths go from 8-24, so center is at 16 in the original coordinate space
    // We translate so that point 16,16 in path space aligns with x,y in canvas space
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.translate(-16, -16);

    // Draw black background if defined
    if (markerDef.hasBackground && markerDef.background) {
      ctx.fillStyle = "#000000";
      const bgPath = new Path2D(markerDef.background);
      ctx.fill(bgPath);
    }

    // Set drawing styles for paths
    ctx.strokeStyle = isSelected ? "#0051ffff" : "#ffffff";
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = 2 / scale; // Adjust line width to maintain visual weight

    // Draw each path
    for (const pathData of markerDef.paths) {
      const path = new Path2D(pathData);
      if (markerDef.fill) {
        ctx.fill(path);
      }
      if (markerDef.stroke) {
        ctx.stroke(path);
      }
    }

    // Restore context state
    ctx.restore();
  }

  /**
   * Draw a single hallway
   *
   * @param {import("./types").Hallway} hallway
   * @param {boolean} isSelected
   * @memberof MapRenderer
   */
  drawHallway(hallway, isSelected) {
    if (hallway.isSecret) {
      // Secret passages are drawn with dashes parallel to direction
      const lineWidth = isSelected ? hallway.width + 4 : hallway.width;
      this._drawDashedSegments(hallway.segments, lineWidth, isSelected);
    } else {
      // Regular hallways are drawn with solid lines
      this.ctx.strokeStyle = isSelected ? "#0051ffff" : "#ffffff";
      this.ctx.lineWidth = isSelected ? hallway.width + 4 : hallway.width;
      this.ctx.lineCap = "butt";
      this.ctx.lineJoin = "miter";

      hallway.segments.forEach((segment, index) => {
        this.ctx.beginPath();
        this.ctx.moveTo(segment.x1, segment.y1);
        this.ctx.lineTo(segment.x2, segment.y2);
        this.ctx.stroke();
      });
    }

    // Draw endpoint markers if present
    if (hallway.segments.length > 0 && hallway.nodes.length >= 2) {
      const firstNode = hallway.nodes[0];
      const lastNode = hallway.nodes[hallway.nodes.length - 1];

      if (hallway.startMarker && hallway.startMarker.type !== "none") {
        this.drawHallwayMarker(
          this.ctx,
          firstNode.x,
          firstNode.y,
          hallway.startMarker.type,
          hallway.width,
          isSelected,
          hallway.startMarker.rotation || 0
        );
      }
      if (hallway.endMarker && hallway.endMarker.type !== "none") {
        this.drawHallwayMarker(
          this.ctx,
          lastNode.x,
          lastNode.y,
          hallway.endMarker.type,
          hallway.width,
          isSelected,
          hallway.endMarker.rotation || 0
        );
      }
    }

    // Label at midpoint of path
    if (hallway.label && hallway.segments.length > 0) {
      const midSegment =
        hallway.segments[Math.floor(hallway.segments.length / 2)];
      const midX = (midSegment.x1 + midSegment.x2) / 2;
      const midY = (midSegment.y1 + midSegment.y2) / 2;
      this.ctx.fillStyle = "#000000";
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = 3;
      this.ctx.font = "bold 12px sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.strokeText(hallway.label, midX, midY);
      this.ctx.fillText(hallway.label, midX, midY);
    }
  }

  /**
   * Draw a wall
   *
   * @param {import("./types").Wall} wall
   * @param {boolean} isSelected
   * @memberof MapRenderer
   */
  drawWall(wall, isSelected) {
    if (wall.isDotted) {
      // Dotted walls are drawn with dashes parallel to direction
      const lineWidth = isSelected ? wall.width + 4 : wall.width;
      this._drawDashedSegments(wall.segments, lineWidth, isSelected);
    } else {
      // Regular walls are drawn with solid lines (no markers)
      this.ctx.strokeStyle = isSelected ? "#0051ffff" : "#ffffff";
      this.ctx.lineWidth = isSelected ? wall.width + 4 : wall.width;
      this.ctx.lineCap = "butt";
      this.ctx.lineJoin = "miter";

      wall.segments.forEach((segment) => {
        this.ctx.beginPath();
        this.ctx.moveTo(segment.x1, segment.y1);
        this.ctx.lineTo(segment.x2, segment.y2);
        this.ctx.stroke();
      });
    }

    // Label at midpoint of path
    if (wall.label && wall.segments.length > 0) {
      const midSegment = wall.segments[Math.floor(wall.segments.length / 2)];
      const midX = (midSegment.x1 + midSegment.x2) / 2;
      const midY = (midSegment.y1 + midSegment.y2) / 2;
      this.ctx.fillStyle = "#000000";
      this.ctx.strokeStyle = "#ffffff";
      this.ctx.lineWidth = 3;
      this.ctx.font = "bold 12px sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.strokeText(wall.label, midX, midY);
      this.ctx.fillText(wall.label, midX, midY);
    }
  }

  /**
   * Snap a coordinate to the nearest grid line
   *
   * @param {number} coord
   * @return {number}
   * @memberof MapRenderer
   */
  snapToGrid(coord) {
    if (!this.snapToGridEnabled) {
      return coord; // Grid snapping disabled - return coordinate as-is
    }
    return Math.round(coord / this.gridSize) * this.gridSize;
  }
}
