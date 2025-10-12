/**
 * Map Icons Module for Foundry VTT
 * Centralized icon drawing functions for Mothership Map Viewer
 */

import { HALLWAY_MARKER_PATHS, ROOM_MARKER_PATHS } from "./marker-paths.js";

/**
 * Draw a room marker icon using SVG paths
 * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} type - Marker type (terminal, hazard, loot, npc, door, ladder, window, airlock, elevator)
 * @param {number} size - Size of the marker (default 16)
 */

export function drawRoomMarker(ctx, x, y, type, size = 16, rotation = 0) {
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
  ctx.strokeStyle = "#ffffff";
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
 * Draw a hallway marker icon using SVG paths
 * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} type - Marker type (door, grate, airlock)
 * @param {number} hallwayWidth - Width of the hallway (affects marker size)
 * @param {number} rotation - Rotation angle in degrees (default 0)
 */
export function drawHallwayMarker(ctx, x, y, type, hallwayWidth, rotation = 0) {
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
  ctx.strokeStyle = "#ffffff";
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
