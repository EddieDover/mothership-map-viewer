/**
 * Scene Converter for Mothership Map Viewer
 * Converts a map (one floor) into a Foundry VTT Scene with:
 *   - A 2D canvas screenshot as the scene background
 *   - Wall documents matching room borders, hallways, and standalone walls
 *   - Note documents for markers and labels
 */

import { drawHallwayMarker, drawRoomMarker } from "./map-icons.js";

const MAP_GRID_SIZE = 20;

const MARKER_ICON_MAP = {
  terminal: "icons/svg/computer.svg",
  hazard: "icons/svg/hazard.svg",
  loot: "icons/svg/chest.svg",
  npc: "icons/svg/mystery-man.svg",
  door: "icons/svg/door-steel-locked.svg",
  ladder: "icons/svg/ladder.svg",
  window: "icons/svg/window.svg",
  airlock: "icons/svg/radiation.svg",
  elevator: "icons/svg/circle.svg",
};

/**
 * Render one floor of a map to an OffscreenCanvas and return the canvas.
 */
function renderFloorToCanvas(mapData, floor) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  const expandBounds = (x, y) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  const itemFloor = (item) => (item.floor !== undefined ? item.floor : 1);

  mapData.rooms.forEach((room) => {
    if (itemFloor(room) !== floor) return;
    if (!room.visible) return;
    if (room.shape === "circle") {
      expandBounds(room.x, room.y);
      expandBounds(room.x + room.radius * 2, room.y + room.radius * 2);
    } else {
      expandBounds(room.x, room.y);
      expandBounds(room.x + room.width, room.y + room.height);
    }
  });

  mapData.hallways.forEach((h) => {
    if (itemFloor(h) !== floor) return;
    if (!h.visible) return;
    h.segments.forEach((s) => {
      expandBounds(s.x1, s.y1);
      expandBounds(s.x2, s.y2);
    });
  });

  mapData.walls.forEach((w) => {
    if (itemFloor(w) !== floor) return;
    if (!w.visible) return;
    w.segments.forEach((s) => {
      expandBounds(s.x1, s.y1);
      expandBounds(s.x2, s.y2);
    });
  });

  if (mapData.standaloneMarkers) {
    mapData.standaloneMarkers.forEach((m) => {
      if (itemFloor(m) !== floor) return;
      expandBounds(m.x, m.y);
    });
  }

  if (mapData.standaloneLabels) {
    mapData.standaloneLabels.forEach((l) => {
      if (itemFloor(l) !== floor) return;
      expandBounds(l.x, l.y);
    });
  }

  if (!isFinite(minX)) {
    const blank = new OffscreenCanvas(MAP_GRID_SIZE, MAP_GRID_SIZE);
    return { canvas: blank, offsetX: 0, offsetY: 0 };
  }

  const padding = MAP_GRID_SIZE * 2;
  const offsetX = minX - padding;
  const offsetY = minY - padding;
  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;

  const canvas = new OffscreenCanvas(Math.ceil(width), Math.ceil(height));
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-offsetX, -offsetY);

  const deferredLabels = [];
  const deferredMarkers = [];

  mapData.rooms.forEach((room) => {
    if (itemFloor(room) !== floor) return;
    if (!room.visible) return;

    if (room.shape === "circle") {
      const cx = room.x + room.radius;
      const cy = room.y + room.radius;
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(cx, cy, room.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, room.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#000000";
      ctx.fillRect(room.x, room.y, room.width, room.height);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 10;
      ctx.strokeRect(room.x, room.y, room.width, room.height);
    }

    if (room.label && room.labelVisible === true) {
      const lx =
        room.shape === "circle"
          ? room.x + room.radius
          : room.x + room.width / 2;
      const ly =
        room.shape === "circle"
          ? room.y + room.radius
          : room.y + room.height / 2;
      deferredLabels.push({ x: lx, y: ly, text: room.label });
    }

    if (room.labels) {
      room.labels.forEach((label) => {
        if (label.visible === false) return;
        deferredLabels.push({
          x: room.x + label.x,
          y: room.y + label.y,
          text: label.text,
        });
      });
    }

    if (room.markers) {
      room.markers.forEach((marker) => {
        if (marker.visible === false) return;
        deferredMarkers.push({
          x: room.x + marker.x,
          y: room.y + marker.y,
          type: marker.type,
          rotation: marker.rotation || 0,
        });
      });
    }

    if (room.walls) {
      room.walls.forEach((wall) => {
        _drawWallOnCtx(ctx, wall);
      });
    }
  });

  mapData.hallways.forEach((hallway) => {
    if (itemFloor(hallway) !== floor) return;
    if (!hallway.visible) return;

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = hallway.width;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";

    hallway.segments.forEach((seg) => {
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();
    });

    if (hallway.nodes && hallway.nodes.length >= 2) {
      if (
        hallway.startMarker &&
        hallway.startMarker.type !== "none" &&
        hallway.startMarker.visible !== false
      ) {
        deferredMarkers.push({
          x: hallway.nodes[0].x,
          y: hallway.nodes[0].y,
          type: hallway.startMarker.type,
          rotation: hallway.startMarker.rotation || 0,
          hallwayWidth: hallway.width,
          isHallway: true,
        });
      }
      if (
        hallway.endMarker &&
        hallway.endMarker.type !== "none" &&
        hallway.endMarker.visible !== false
      ) {
        const last = hallway.nodes[hallway.nodes.length - 1];
        deferredMarkers.push({
          x: last.x,
          y: last.y,
          type: hallway.endMarker.type,
          rotation: hallway.endMarker.rotation || 0,
          hallwayWidth: hallway.width,
          isHallway: true,
        });
      }
    }
  });

  if (mapData.walls) {
    mapData.walls.forEach((wall) => {
      if (itemFloor(wall) !== floor) return;
      if (!wall.visible) return;
      _drawWallOnCtx(ctx, wall);
    });
  }

  if (mapData.standaloneMarkers) {
    mapData.standaloneMarkers.forEach((marker) => {
      if (itemFloor(marker) !== floor) return;
      if (marker.visible === false) return;
      deferredMarkers.push({
        x: marker.x,
        y: marker.y,
        type: marker.type,
        rotation: marker.rotation || 0,
      });
    });
  }

  if (mapData.standaloneLabels) {
    mapData.standaloneLabels.forEach((label) => {
      if (itemFloor(label) !== floor) return;
      if (label.visible === false) return;
      deferredLabels.push({ x: label.x, y: label.y, text: label.text });
    });
  }

  deferredMarkers.forEach((m) => {
    if (m.isHallway) {
      drawHallwayMarker(ctx, m.x, m.y, m.type, m.hallwayWidth, m.rotation);
    } else {
      drawRoomMarker(ctx, m.x, m.y, m.type, 16, m.rotation);
    }
  });

  deferredLabels.forEach((l) => {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText(l.text, l.x, l.y);
    ctx.fillText(l.text, l.x, l.y);
  });

  ctx.restore();

  return { canvas, offsetX, offsetY };
}

function _drawWallOnCtx(ctx, wall) {
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = wall.width || 10;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  wall.segments.forEach((seg) => {
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    ctx.stroke();
  });
}

async function uploadCanvasAsBackground(canvas, fileName, folderPath) {
  const blob = await canvas.convertToBlob({ type: "image/png" });
  const file = new File([blob], fileName, { type: "image/png" });

  const FP = foundry.applications.apps.FilePicker.implementation;

  try {
    await FP.createDirectory("data", folderPath, {});
  } catch (_e) {
    // ignore – directory likely already exists
  }

  const result = await FP.upload("data", folderPath, file, {});
  return result.path;
}

function buildWallData(mapData, floor, offsetX, offsetY) {
  const walls = [];

  const tx = (x) => x - offsetX;
  const ty = (y) => y - offsetY;

  const addSeg = (x1, y1, x2, y2, isDoor = false) => {
    walls.push({
      c: [tx(x1), ty(y1), tx(x2), ty(y2)],
      move: 20,
      sight: 20,
      sound: 0,
      door: isDoor ? 1 : 0,
      ds: isDoor ? 0 : undefined,
    });
  };

  const itemFloor = (item) => (item.floor !== undefined ? item.floor : 1);

  // Room borders
  mapData.rooms.forEach((room) => {
    if (itemFloor(room) !== floor) return;
    if (room.visible === false) return;

    if (room.shape === "circle") {
      const cx = room.x + room.radius;
      const cy = room.y + room.radius;
      const segments = 16;
      for (let i = 0; i < segments; i++) {
        const a1 = (i / segments) * Math.PI * 2;
        const a2 = ((i + 1) / segments) * Math.PI * 2;
        addSeg(
          cx + Math.cos(a1) * room.radius,
          cy + Math.sin(a1) * room.radius,
          cx + Math.cos(a2) * room.radius,
          cy + Math.sin(a2) * room.radius
        );
      }
    } else {
      addSeg(room.x, room.y, room.x + room.width, room.y);
      addSeg(
        room.x + room.width,
        room.y,
        room.x + room.width,
        room.y + room.height
      );
      addSeg(
        room.x + room.width,
        room.y + room.height,
        room.x,
        room.y + room.height
      );
      addSeg(room.x, room.y + room.height, room.x, room.y);
    }

    // Internal walls
    if (room.walls) {
      room.walls.forEach((wall) => {
        wall.segments.forEach((seg) => {
          addSeg(seg.x1, seg.y1, seg.x2, seg.y2);
        });
      });
    }
  });

  mapData.hallways.forEach((hallway) => {
    if (itemFloor(hallway) !== floor) return;
    if (hallway.visible === false) return;

    const halfW = hallway.width / 2;

    hallway.segments.forEach((seg) => {
      const dx = seg.x2 - seg.x1;
      const dy = seg.y2 - seg.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return;
      const nx = (-dy / len) * halfW;
      const ny = (dx / len) * halfW;

      addSeg(seg.x1 + nx, seg.y1 + ny, seg.x2 + nx, seg.y2 + ny);
      addSeg(seg.x1 - nx, seg.y1 - ny, seg.x2 - nx, seg.y2 - ny);
    });

    if (hallway.nodes && hallway.nodes.length >= 2) {
      const addHallwayEndpointDoor = (node, markerDef) => {
        if (!markerDef || markerDef.type === "none") return;
        const isDoor = markerDef.type === "door";
        const halfW2 = hallway.width / 2;
        const segs = hallway.segments;
        const refSeg =
          node === hallway.nodes[0] ? segs[0] : segs[segs.length - 1];
        if (!refSeg) return;
        const dx = refSeg.x2 - refSeg.x1;
        const dy = refSeg.y2 - refSeg.y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return;
        const nx2 = (-dy / len) * halfW2;
        const ny2 = (dx / len) * halfW2;
        addSeg(node.x + nx2, node.y + ny2, node.x - nx2, node.y - ny2, isDoor);
      };

      if (hallway.startMarker && hallway.startMarker.visible !== false) {
        addHallwayEndpointDoor(hallway.nodes[0], hallway.startMarker);
      }
      if (hallway.endMarker && hallway.endMarker.visible !== false) {
        addHallwayEndpointDoor(
          hallway.nodes[hallway.nodes.length - 1],
          hallway.endMarker
        );
      }
    }
  });

  if (mapData.walls) {
    mapData.walls.forEach((wall) => {
      if (itemFloor(wall) !== floor) return;
      if (wall.visible === false) return;
      wall.segments.forEach((seg) => {
        addSeg(seg.x1, seg.y1, seg.x2, seg.y2);
      });
    });
  }

  return walls;
}

function buildNoteData(mapData, floor, offsetX, offsetY) {
  const notes = [];
  const itemFloor = (item) => (item.floor !== undefined ? item.floor : 1);

  const tx = (x) => x - offsetX;
  const ty = (y) => y - offsetY;

  mapData.rooms.forEach((room) => {
    if (itemFloor(room) !== floor) return;
    if (room.visible === false) return;
    if (!room.markers) return;

    room.markers.forEach((marker) => {
      if (marker.visible === false) return;
      notes.push({
        x: tx(room.x + marker.x),
        y: ty(room.y + marker.y),
        texture: { src: MARKER_ICON_MAP[marker.type] || "icons/svg/book.svg" },
        iconSize: 32,
        text: marker.label || marker.type,
        fontSize: 24,
        entryId: null,
      });
    });
  });

  if (mapData.standaloneMarkers) {
    mapData.standaloneMarkers.forEach((marker) => {
      if (itemFloor(marker) !== floor) return;
      if (marker.visible === false) return;
      notes.push({
        x: tx(marker.x),
        y: ty(marker.y),
        texture: { src: MARKER_ICON_MAP[marker.type] || "icons/svg/book.svg" },
        iconSize: 32,
        text: marker.label || marker.type,
        fontSize: 24,
        entryId: null,
      });
    });
  }

  if (mapData.standaloneLabels) {
    mapData.standaloneLabels.forEach((label) => {
      if (itemFloor(label) !== floor) return;
      if (label.visible === false) return;
      notes.push({
        x: tx(label.x),
        y: ty(label.y),
        texture: { src: "icons/svg/hanging-sign.svg" },
        iconSize: 32,
        text: label.text,
        fontSize: 24,
        entryId: null,
      });
    });
  }

  return notes;
}

export async function convertMapToScene(mapData, floor, sceneName) {
  const name =
    sceneName || `${mapData.mapName || "Mothership Map"} – Floor ${floor}`;

  const { canvas, offsetX, offsetY } = renderFloorToCanvas(mapData, floor);

  // 2. Upload background image
  const safeMapName = (mapData.mapName || "mothership-map")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .toLowerCase();
  const fileName = `${safeMapName}_floor${floor}.png`;
  const folderPath = "mothership-maps";

  let backgroundPath;
  try {
    backgroundPath = await uploadCanvasAsBackground(
      canvas,
      fileName,
      folderPath
    );
  } catch (err) {
    ui.notifications.error(
      game.i18n.localize(
        "MOTHERSHIP_MAP_VIEWER.notifications.SceneExportUploadError"
      )
    );
    console.error("Mothership Map Viewer | Scene export upload failed:", err);
    return null;
  }

  const wallData = buildWallData(mapData, floor, offsetX, offsetY);
  const noteData = buildNoteData(mapData, floor, offsetX, offsetY);

  const sceneData = {
    name,
    width: canvas.width,
    height: canvas.height,
    grid: { size: MAP_GRID_SIZE },
    background: { src: backgroundPath },
    walls: wallData,
    notes: noteData,
    padding: 0,
  };

  try {
    const existing = game.scenes.find((s) => s.name === name);

    if (existing) {
      await existing.update({
        background: { src: backgroundPath },
        width: canvas.width,
        height: canvas.height,
        walls: wallData,
        notes: noteData,
      });
      ui.notifications.info(
        game.i18n.format(
          "MOTHERSHIP_MAP_VIEWER.notifications.SceneExportUpdated",
          { name }
        )
      );
      existing.sheet.render(true);
      return existing;
    }

    const scene = await Scene.create(sceneData);
    ui.notifications.info(
      game.i18n.format(
        "MOTHERSHIP_MAP_VIEWER.notifications.SceneExportSuccess",
        { name }
      )
    );
    scene.sheet.render(true);
    return scene;
  } catch (err) {
    ui.notifications.error(
      game.i18n.localize("MOTHERSHIP_MAP_VIEWER.notifications.SceneExportError")
    );
    console.error("Mothership Map Viewer | Scene creation failed:", err);
    return null;
  }
}
