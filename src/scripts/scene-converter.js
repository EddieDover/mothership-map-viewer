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
  const offsetX = Math.floor((minX - padding) / MAP_GRID_SIZE) * MAP_GRID_SIZE;
  const offsetY = Math.floor((minY - padding) / MAP_GRID_SIZE) * MAP_GRID_SIZE;
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

/**
 * Build the update payload needed to change an existing scene's background
 * image. In Foundry v14 the top-level `background` field was replaced by a
 * `levels` embedded collection, fall back to the legacy field for v13.
 */
function _applyBackgroundUpdate(scene, src, extra = {}) {
  const firstLevel = scene.levels?.size ? scene.firstLevel : null;
  if (firstLevel) {
    return {
      levels: [{ _id: firstLevel.id, background: { src } }],
      ...extra,
    };
  }
  return { background: { src }, ...extra };
}

/**
 * Regenerate the scene's navigation thumbnail from its current background.
 */
async function _refreshSceneThumbnail(scene) {
  try {
    if (typeof canvas === "undefined" || !canvas?.ready) return;
    const thumbData = await scene.createThumbnail();
    if (thumbData?.thumb) await scene.update({ thumb: thumbData.thumb });
  } catch (err) {
    console.error(
      "Mothership Map Viewer | Scene thumbnail generation failed:",
      err
    );
  }
}

/**
 * Force the game canvas to redraw if the given scene is the one currently
 * displayed.
 */
async function _redrawIfActive(scene) {
  try {
    if (
      typeof canvas !== "undefined" &&
      canvas?.ready &&
      canvas.scene?.id === scene.id
    ) {
      await canvas.draw();
    }
  } catch (err) {
    console.error("Mothership Map Viewer | Canvas redraw failed:", err);
  }
}

async function uploadCanvasAsBackground(canvas, fileName, folderPath) {
  const blob = await canvas.convertToBlob({ type: "image/png" });
  const file = new File([blob], fileName, { type: "image/png" });

  const FP = foundry.applications.apps.FilePicker.implementation;

  try {
    await FP.createDirectory("data", folderPath, {});
  } catch {
    // ignore - directory likely already exists
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
  const TOLERANCE = MAP_GRID_SIZE / 2;

  const doorCuts = [];
  mapData.hallways.forEach((hallway) => {
    if (itemFloor(hallway) !== floor) return;
    if (hallway.visible === false) return;
    if (!hallway.nodes || hallway.nodes.length < 2) return;

    const halfW = Math.max(hallway.width / 2, MAP_GRID_SIZE / 2);
    const segs = hallway.segments;

    const collectCut = (node, markerDef, refSeg) => {
      if (!markerDef || markerDef.type === "none" || markerDef.type !== "door")
        return;
      if (markerDef.visible === false) return;
      if (!refSeg) return;
      const dx = refSeg.x2 - refSeg.x1;
      const dy = refSeg.y2 - refSeg.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return;
      const nx = (-dy / len) * halfW;
      const ny = (dx / len) * halfW;
      doorCuts.push({ cx: node.x, cy: node.y, nx, ny });
    };

    collectCut(hallway.nodes[0], hallway.startMarker, segs[0]);
    collectCut(
      hallway.nodes[hallway.nodes.length - 1],
      hallway.endMarker,
      segs[segs.length - 1]
    );
  });

  const addEdgeWithCuts = (ax, ay, bx, by) => {
    const isHoriz = Math.abs(ay - by) < TOLERANCE;
    const cuts = [];

    doorCuts.forEach(({ cx, cy, nx, ny }) => {
      if (isHoriz) {
        // Door is horizontal if ny ≈ 0 and the cut's y matches the edge
        if (Math.abs(ny) < TOLERANCE && Math.abs(cy - ay) < TOLERANCE) {
          const minX = Math.min(cx + nx, cx - nx);
          const maxX = Math.max(cx + nx, cx - nx);
          const eMinX = Math.min(ax, bx);
          const eMaxX = Math.max(ax, bx);
          if (maxX > eMinX && minX < eMaxX) {
            cuts.push({
              from: Math.max(minX, eMinX),
              to: Math.min(maxX, eMaxX),
            });
          }
        }
      } else {
        // Door is vertical if nx ≈ 0 and the cut's x matches the edge
        if (Math.abs(nx) < TOLERANCE && Math.abs(cx - ax) < TOLERANCE) {
          const minY = Math.min(cy + ny, cy - ny);
          const maxY = Math.max(cy + ny, cy - ny);
          const eMinY = Math.min(ay, by);
          const eMaxY = Math.max(ay, by);
          if (maxY > eMinY && minY < eMaxY) {
            cuts.push({
              from: Math.max(minY, eMinY),
              to: Math.min(maxY, eMaxY),
            });
          }
        }
      }
    });

    if (cuts.length === 0) {
      addSeg(ax, ay, bx, by);
      return;
    }

    cuts.sort((a, b) => a.from - b.from);
    let pos = isHoriz ? Math.min(ax, bx) : Math.min(ay, by);
    const end = isHoriz ? Math.max(ax, bx) : Math.max(ay, by);

    for (const cut of cuts) {
      if (cut.from > pos) {
        // Wall segment before this door
        if (isHoriz) addSeg(pos, ay, cut.from, ay);
        else addSeg(ax, pos, ax, cut.from);
      }
      // Door segment
      if (isHoriz) addSeg(cut.from, ay, cut.to, ay, true);
      else addSeg(ax, cut.from, ax, cut.to, true);
      pos = cut.to;
    }

    if (pos < end) {
      if (isHoriz) addSeg(pos, ay, end, ay);
      else addSeg(ax, pos, ax, end);
    }
  };

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
      addEdgeWithCuts(room.x, room.y, room.x + room.width, room.y);
      addEdgeWithCuts(
        room.x + room.width,
        room.y,
        room.x + room.width,
        room.y + room.height
      );
      addEdgeWithCuts(
        room.x + room.width,
        room.y + room.height,
        room.x,
        room.y + room.height
      );
      addEdgeWithCuts(room.x, room.y + room.height, room.x, room.y);
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

  // Hallway walls intentionally omitted since they block player movement.
  mapData.hallways.forEach((hallway) => {
    if (itemFloor(hallway) !== floor) return;
    if (hallway.visible === false) return;
    if (!hallway.nodes || hallway.nodes.length < 2) return;

    const halfW = Math.max(hallway.width / 2, MAP_GRID_SIZE / 2);
    const segs = hallway.segments;

    const addFreestandingDoor = (node, markerDef, refSeg) => {
      if (!markerDef || markerDef.type === "none" || markerDef.type !== "door")
        return;
      if (markerDef.visible === false) return;
      if (!refSeg) return;
      const onRoomEdge = doorCuts.some(
        (cut) =>
          Math.abs(cut.cx - node.x) < TOLERANCE &&
          Math.abs(cut.cy - node.y) < TOLERANCE
      );
      if (onRoomEdge) return;
      const dx = refSeg.x2 - refSeg.x1;
      const dy = refSeg.y2 - refSeg.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return;
      const nx = (-dy / len) * halfW;
      const ny = (dx / len) * halfW;
      addSeg(node.x + nx, node.y + ny, node.x - nx, node.y - ny, true);
    };

    addFreestandingDoor(hallway.nodes[0], hallway.startMarker, segs[0]);
    addFreestandingDoor(
      hallway.nodes[hallway.nodes.length - 1],
      hallway.endMarker,
      segs[segs.length - 1]
    );
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
    sceneName || `${mapData.mapName || "Mothership Map"} - Floor ${floor}`;

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
      const cacheBustedBgPath = `${backgroundPath}?v=${Date.now()}`;
      await existing.update(
        _applyBackgroundUpdate(existing, cacheBustedBgPath, {
          width: canvas.width,
          height: canvas.height,
          walls: wallData,
          notes: noteData,
        })
      );
      await _refreshSceneThumbnail(existing);
      // Force a redraw if this scene is currently displayed.
      await _redrawIfActive(existing);
      ui.notifications.info(
        game.i18n.format(
          "MOTHERSHIP_MAP_VIEWER.notifications.SceneExportUpdated",
          { name }
        )
      );
      return existing;
    }

    const scene = await Scene.create(sceneData);
    const cacheBustedBgPath = `${backgroundPath}?v=${Date.now()}`;
    await scene.update(_applyBackgroundUpdate(scene, cacheBustedBgPath));
    await _refreshSceneThumbnail(scene);
    await _redrawIfActive(scene);
    ui.notifications.info(
      game.i18n.format(
        "MOTHERSHIP_MAP_VIEWER.notifications.SceneExportSuccess",
        { name }
      )
    );
    return scene;
  } catch (err) {
    ui.notifications.error(
      game.i18n.localize("MOTHERSHIP_MAP_VIEWER.notifications.SceneExportError")
    );
    console.error("Mothership Map Viewer | Scene creation failed:", err);
    return null;
  }
}

export async function convertMapToScene3D(
  screenshotBlob,
  sceneName,
  width,
  height,
  floor
) {
  try {
    const folderPath = "mothership-maps";
    const safeBaseName = sceneName.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
    const safeFileName = `${safeBaseName}_floor_${floor}.png`;
    const file = new File([screenshotBlob], safeFileName, {
      type: "image/png",
    });

    const FP = foundry.applications.apps.FilePicker.implementation;

    try {
      await FP.createDirectory("data", folderPath, {});
    } catch {
      // ignore - directory likely already exists
    }

    let bgPath;
    try {
      const result = await FP.upload("data", folderPath, file, {});
      bgPath = result.path;
    } catch (uploadErr) {
      ui.notifications.error(
        game.i18n.localize(
          "MOTHERSHIP_MAP_VIEWER.notifications.SceneExportUploadError"
        )
      );
      console.error(
        "Mothership Map Viewer | 3D screenshot upload failed:",
        uploadErr
      );
      return null;
    }

    const sceneData = {
      name: sceneName,
      width,
      height,
      background: { src: bgPath },
      grid: { type: 1, size: MAP_GRID_SIZE },
      padding: 0,
    };

    const existing = game.scenes.find((s) => s.name === sceneName);
    if (existing) {
      const cacheBustedPath = `${bgPath}?v=${Date.now()}`;
      await existing.update(
        _applyBackgroundUpdate(existing, cacheBustedPath, { width, height })
      );
      await _refreshSceneThumbnail(existing);
      await _redrawIfActive(existing);
      ui.notifications.info(
        game.i18n.format(
          "MOTHERSHIP_MAP_VIEWER.notifications.SceneExportUpdated",
          { name: sceneName }
        )
      );
      return existing;
    }

    const scene = await Scene.create(sceneData);
    const cacheBustedPath = `${bgPath}?v=${Date.now()}`;
    await scene.update(_applyBackgroundUpdate(scene, cacheBustedPath));
    await _refreshSceneThumbnail(scene);
    await _redrawIfActive(scene);
    ui.notifications.info(
      game.i18n.format(
        "MOTHERSHIP_MAP_VIEWER.notifications.SceneExportSuccess",
        { name: sceneName }
      )
    );
    return scene;
  } catch (err) {
    ui.notifications.error(
      game.i18n.localize("MOTHERSHIP_MAP_VIEWER.notifications.SceneExportError")
    );
    console.error("Mothership Map Viewer | 3D scene creation failed:", err);
    return null;
  }
}
