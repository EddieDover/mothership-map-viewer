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
    const startX = Math.floor((-this.offsetX) / this.gridSize) * this.gridSize;
    const endX = Math.floor((this.canvas.width - this.offsetX) / this.gridSize) * this.gridSize + this.gridSize;
    const startY = Math.floor((-this.offsetY) / this.gridSize) * this.gridSize;
    const endY = Math.floor((this.canvas.height - this.offsetY) / this.gridSize) * this.gridSize + this.gridSize;

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

      this.drawRoom(room, isRoomSelected, selectedMarkerIndex);
    });

    mapData.hallways.forEach((hallway) => {
      const isHallwaySelected =
        selectedItem?.type === "hallway" && selectedItem?.id === hallway.id;
      this.drawHallway(hallway, isHallwaySelected);
    });

    // Restore transformation
    this.ctx.restore();
  }

  /**
   * Draw a single room
   *
   * @param {import("./types").Room} room
   * @param {boolean} isSelected
   * @param {number|null} selectedMarkerIndex - Index of selected marker, or null
   * @memberof MapRenderer
   */
  drawRoom(room, isSelected, selectedMarkerIndex = null) {
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
            room.x + marker.x,
            room.y + marker.y,
            marker.type,
            isMarkerSelected
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
            room.x + marker.x,
            room.y + marker.y,
            marker.type,
            isMarkerSelected
          );
        });
      }

      // Label - white (drawn last so it's on top)
      if (room.label) {
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = "bold 14px sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(
          room.label,
          room.x + room.width / 2,
          room.y + room.height / 2
        );
      }
    }
  }

  /**
   * Draw a room marker
   *
   * @param {number} x
   * @param {number} y
   * @param {import("./types").RoomMarkerType} type
   * @param {boolean} isSelected
   * @memberof MapRenderer
   */
  drawRoomMarker(x, y, type, isSelected = false) {
    const size = 16;
    this.ctx.strokeStyle = isSelected ? "#0051ffff" : "#ffffff";
    this.ctx.fillStyle = isSelected ? "#0051ffff" : "#ffffff";
    this.ctx.lineWidth = 2;

    switch (type) {
      case "terminal":
        // Draw terminal marker - rectangle with lines
        this.ctx.strokeRect(x - size / 2, y - size / 2, size, size);
        this.ctx.fillText(">", x, y);
        break;
      case "hazard":
        // Draw hazard marker - triangle with exclamation
        this.ctx.beginPath();
        this.ctx.moveTo(x, y - size / 2);
        this.ctx.lineTo(x - size / 2, y + size / 2);
        this.ctx.lineTo(x + size / 2, y + size / 2);
        this.ctx.closePath();
        this.ctx.stroke();
        this.ctx.font = "bold 12px sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("!", x, y + 2);
        break;
      case "loot":
        // Draw loot marker - chest/box
        this.ctx.fillRect(x - size / 2, y - size / 3, size, (size * 2) / 3);
        this.ctx.strokeRect(x - size / 2, y - size / 3, size, (size * 2) / 3);
        break;
      case "npc":
        // Draw NPC marker - circle (head)
        this.ctx.beginPath();
        this.ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        this.ctx.stroke();
        break;
      case "door":
        // Draw door marker - rectangle with arc (swinging door)
        this.ctx.strokeRect(x - size / 2, y - size / 2, size / 4, size);
        this.ctx.beginPath();
        this.ctx.arc(x - size / 2, y - size / 2, size, 0, Math.PI / 2);
        this.ctx.stroke();
        break;
      case "window":
        // Draw window marker - rectangle with cross
        this.ctx.strokeRect(x - size / 2, y - size / 2, size, size);
        this.ctx.beginPath();
        this.ctx.moveTo(x, y - size / 2);
        this.ctx.lineTo(x, y + size / 2);
        this.ctx.moveTo(x - size / 2, y);
        this.ctx.lineTo(x + size / 2, y);
        this.ctx.stroke();
        break;
      case "custom":
      default:
        // Draw custom marker - star
        this.ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          const px = x + (Math.cos(angle) * size) / 2;
          const py = y + (Math.sin(angle) * size) / 2;
          if (i === 0) this.ctx.moveTo(px, py);
          else this.ctx.lineTo(px, py);
        }
        this.ctx.closePath();
        this.ctx.stroke();
        break;
    }
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
      this.ctx.strokeStyle = isSelected ? "#0051ffff" : "#ffffff";
      this.ctx.lineWidth = 2;
      this.ctx.lineCap = "butt";

      hallway.segments.forEach((segment, index) => {
        const isHorizontal = segment.y1 === segment.y2;
        const dashLength = 8;
        const gapLength = 12;
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
          firstNode.x,
          firstNode.y,
          hallway.startMarker.type,
          hallway.width,
          isSelected
        );
      }
      if (hallway.endMarker && hallway.endMarker.type !== "none") {
        this.drawHallwayMarker(
          lastNode.x,
          lastNode.y,
          hallway.endMarker.type,
          hallway.width,
          isSelected
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
   * Draw a hallway marker
   *
   * @param {number} x
   * @param {number} y
   * @param {import("./types").HallwayMarkerType} type
   * @param {number} hallwayWidth
   * @param {boolean} isSelected
   * @memberof MapRenderer
   */
  drawHallwayMarker(x, y, type, hallwayWidth, isSelected = false) {
    const size = hallwayWidth * 1.5;

    if (type === "door") {
      // Draw door marker - rectangle with line
      this.ctx.strokeStyle = isSelected ? "#0051ffff" : "#ffffff";
      this.ctx.fillStyle = "#000000";
      this.ctx.lineWidth = 2;

      this.ctx.fillRect(x - size / 2, y - size / 2, size, size);
      this.ctx.strokeRect(x - size / 2, y - size / 2, size, size);

      // Door line
      this.ctx.beginPath();
      this.ctx.moveTo(x, y - size / 2);
      this.ctx.lineTo(x, y + size / 2);
      this.ctx.stroke();
    } else if (type === "grate") {
      // Draw grate marker - grid pattern
      this.ctx.strokeStyle = isSelected ? "#0051ffff" : "#ffffff";
      this.ctx.lineWidth = 2;

      // Draw grid
      const gridSize = size / 3;
      for (let i = 0; i <= 3; i++) {
        // Vertical lines
        this.ctx.beginPath();
        this.ctx.moveTo(x - size / 2 + i * gridSize, y - size / 2);
        this.ctx.lineTo(x - size / 2 + i * gridSize, y + size / 2);
        this.ctx.stroke();

        // Horizontal lines
        this.ctx.beginPath();
        this.ctx.moveTo(x - size / 2, y - size / 2 + i * gridSize);
        this.ctx.lineTo(x + size / 2, y - size / 2 + i * gridSize);
        this.ctx.stroke();
      }
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
    // Grid snapping disabled - return coordinate as-is
    return coord;
  }
}
