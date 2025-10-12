/**
 * Map Icons Module for Foundry VTT
 * Centralized icon drawing functions for Mothership Map Viewer
 */

/**
 * Draw a room marker icon
 * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} type - Marker type (terminal, hazard, loot, npc, door, ladder, window, airlock, custom)
 * @param {number} size - Size of the marker (default 16)
 */
export function drawRoomMarker(ctx, x, y, type, size = 16, rotation = 0) {
  ctx.save(); // Save the current state

  // Apply rotation if specified
  if (rotation !== 0) {
    ctx.translate(x, y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-x, -y);
  }

  ctx.strokeStyle = "#ffffff";
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 2;

  switch (type) {
    case "terminal":
      ctx.strokeRect(x - size / 2, y - size / 2, size, size);
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(">", x, y);
      break;

    case "hazard":
      ctx.beginPath();
      ctx.moveTo(x, y - size / 2);
      ctx.lineTo(x - size / 2, y + size / 2);
      ctx.lineTo(x + size / 2, y + size / 2);
      ctx.closePath();
      ctx.stroke();
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", x, y + 2);
      break;

    case "loot":
      ctx.fillRect(x - size / 2, y - size / 3, size, (size * 2) / 3);
      ctx.strokeRect(x - size / 2, y - size / 3, size, (size * 2) / 3);
      break;

    case "npc":
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case "door":
      // Draw door marker - rectangle with arc (swinging door)
      ctx.strokeRect(x - size / 2, y - size / 2, size / 4, size);
      ctx.beginPath();
      ctx.arc(x - size / 2, y - size / 2, size, 0, Math.PI / 2);
      ctx.stroke();
      break;

    case "ladder":
      // Draw ladder marker - two vertical lines with rungs
      ctx.strokeRect(x - size / 2, y - size / 2, size, size);
      ctx.beginPath();
      ctx.moveTo(x - size / 4, y - size / 2);
      ctx.lineTo(x - size / 4, y + size / 2);
      ctx.moveTo(x + size / 4, y - size / 2);
      ctx.lineTo(x + size / 4, y + size / 2);
      for (let i = -size / 2; i <= size / 2; i += size / 4) {
        ctx.moveTo(x - size / 4, y + i);
        ctx.lineTo(x + size / 4, y + i);
      }
      ctx.stroke();
      break;

    case "window":
      // Draw window marker - rectangle with cross
      ctx.strokeRect(x - size / 2, y - size / 2, size, size);
      ctx.beginPath();
      ctx.moveTo(x, y - size / 2);
      ctx.lineTo(x, y + size / 2);
      ctx.moveTo(x - size / 2, y);
      ctx.lineTo(x + size / 2, y);
      ctx.stroke();
      break;

    case "airlock":
      // Draw airlock marker - circle with slanted spokes
      ctx.strokeRect(x - size / 2, y - size / 2, size, size);
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.moveTo(x, y);
      ctx.lineTo(x + size / 4, y - size / 4);
      ctx.moveTo(x, y);
      ctx.lineTo(x - size / 4, y - size / 4);
      ctx.moveTo(x, y);
      ctx.lineTo(x + size / 4, y + size / 4);
      ctx.moveTo(x, y);
      ctx.lineTo(x - size / 4, y + size / 4);
      ctx.stroke();
      break;

    case "elevator":
      // Draw elevator marker - rectangle with up/down arrows
      ctx.strokeRect(x - size / 2, y - size / 2, size, size);
      ctx.beginPath();
      ctx.moveTo(x, y - size / 2);
      ctx.lineTo(x, y + size / 2);
      ctx.moveTo(x - size / 4, y - size / 4);
      ctx.lineTo(x + size / 4, y + size / 4);
      ctx.moveTo(x - size / 4, y + size / 4);
      ctx.lineTo(x + size / 4, y - size / 4);
      ctx.stroke();
      break;

    case "custom":
    default:
      // Draw a star for custom markers
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const px = x + (Math.cos(angle) * size) / 2;
        const py = y + (Math.sin(angle) * size) / 2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      break;
  }

  ctx.restore(); // Restore the context state after rotation
}

/**
 * Draw a hallway marker icon
 * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} type - Marker type (door, grate, airlock)
 * @param {number} hallwayWidth - Width of the hallway (affects marker size)
 */
export function drawHallwayMarker(ctx, x, y, type, hallwayWidth) {
  const size = hallwayWidth * 1.5;

  if (type === "door") {
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#000000";
    ctx.lineWidth = 2;

    // Fill black background
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    ctx.strokeRect(x - size / 2, y - size / 2, size, size);

    ctx.beginPath();
    ctx.moveTo(x, y - size / 2);
    ctx.lineTo(x, y + size / 2);
    ctx.stroke();
  } else if (type === "grate") {
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#000000";
    ctx.lineWidth = 2;

    // Fill black background
    ctx.fillRect(x - size / 2, y - size / 2, size, size);

    const gridSize = size / 3;
    for (let i = 0; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x - size / 2 + i * gridSize, y - size / 2);
      ctx.lineTo(x - size / 2 + i * gridSize, y + size / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x - size / 2, y - size / 2 + i * gridSize);
      ctx.lineTo(x + size / 2, y - size / 2 + i * gridSize);
      ctx.stroke();
    }
  } else if (type === "airlock") {
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#000000";
    ctx.lineWidth = 2;

    // Fill black background
    ctx.fillRect(x - size / 2, y - size / 2, size, size);

    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.moveTo(x, y);
    ctx.lineTo(x + size / 4, y - size / 4);
    ctx.moveTo(x, y);
    ctx.lineTo(x - size / 4, y - size / 4);
    ctx.moveTo(x, y);
    ctx.lineTo(x + size / 4, y + size / 4);
    ctx.moveTo(x, y);
    ctx.lineTo(x - size / 4, y + size / 4);
    ctx.stroke();
  }
}
