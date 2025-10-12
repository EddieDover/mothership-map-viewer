/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/**
 * JSON Schema for Mothership TTRPG Maps
 */

/** @type {import("./types").MapData} */
class MapData {
  constructor() {
    this.version = "1.0.0";
    this.mapName = "Untitled Map";
    this.rooms = [];
    this.hallways = [];
    this.walls = []; // Standalone walls not attached to rooms
    this.standaloneMarkers = []; // Standalone markers not attached to rooms
    this.standaloneLabels = []; // Standalone labels
  }

  /**
   * Add a room to the map
   *
   * @param {import("./types").Room} room
   * @memberof MapData
   */
  addRoom(room) {
    this.rooms.push(room);
  }

  /**
   * Add a hallway to the map
   *
   * @param {import("./types").Hallway} hallway
   * @memberof MapData
   */
  addHallway(hallway) {
    this.hallways.push(hallway);
  }

  /**
   * Add a wall to the map (or to a room if parentRoomId is provided)
   *
   * @param {import("./types").Wall} wall
   * @memberof MapData
   */
  addWall(wall) {
    if (wall.parentRoomId) {
      const room = this.rooms.find((r) => r.id === wall.parentRoomId);
      if (room) {
        // Ensure walls array exists
        if (!room.walls) {
          room.walls = [];
        }
        room.walls.push(wall);
      }
    } else {
      this.walls.push(wall);
    }
  }

  /**
   * Add a standalone marker to the map
   *
   * @param {import("./types").StandaloneMarker} marker
   * @memberof MapData
   */
  addStandaloneMarker(marker) {
    this.standaloneMarkers.push(marker);
  }

  /**
   * Add a standalone label to the map
   *
   * @param {import("./types").StandaloneLabel} label
   * @memberof MapData
   */
  addStandaloneLabel(label) {
    this.standaloneLabels.push(label);
  }

  /**
   * Remove an item (room, hallway, wall, standaloneMarker, or standaloneLabel) from the map by ID
   *
   * @param {string} type
   * @param {string} id
   * @memberof MapData
   */
  removeItem(type, id) {
    switch (type) {
      case "room":
        this.rooms = this.rooms.filter((r) => r.id !== id);
        break;
      case "hallway":
        this.hallways = this.hallways.filter((h) => h.id !== id);
        break;
      case "wall":
        // Remove from standalone walls
        this.walls = this.walls.filter((w) => w.id !== id);
        // Also check if it's in a room
        this.rooms.forEach((room) => {
          room.walls = room.walls.filter((w) => w.id !== id);
        });
        break;
      case "standaloneMarker":
        this.standaloneMarkers = this.standaloneMarkers.filter(
          (m) => m.id !== id
        );
        break;
      case "standaloneLabel":
        this.standaloneLabels = this.standaloneLabels.filter(
          (l) => l.id !== id
        );
        break;
    }
  }

  /**
   * Get an item (room, hallway, wall, or standaloneMarker) by ID
   *
   * @param {string} type
   * @param {string} id
   * @return {import("./types").Room|import("./types").Hallway|import("./types").Wall|import("./types").StandaloneMarker|null}
   * @memberof MapData
   */
  getItem(type, id) {
    switch (type) {
      case "room":
        return this.rooms.find((r) => r.id === id);
      case "hallway":
        return this.hallways.find((h) => h.id === id);
      case "wall":
        // Check standalone walls first
        const standaloneWall = this.walls.find((w) => w.id === id);
        if (standaloneWall) return standaloneWall;
        // Check room walls
        for (let room of this.rooms) {
          const roomWall = room.walls.find((w) => w.id === id);
          if (roomWall) return roomWall;
        }
        break;
      case "standaloneMarker":
        return this.standaloneMarkers.find((m) => m.id === id);
    }
    return null;
  }

  /**
   * Serialize to standard JSON format
   *
   * @return {import("./types").MapData}
   * @memberof MapData
   */
  toJSON() {
    return {
      version: this.version,
      mapName: this.mapName,
      rooms: this.rooms,
      hallways: this.hallways,
      walls: this.walls,
      standaloneMarkers: this.standaloneMarkers,
    };
  }

  /**
   * Deserialize from standard JSON format
   *
   * @param {*} json
   * @memberof MapData
   */
  fromJSON(json) {
    this.version = json.version || "1.0.0";
    this.mapName = json.mapName || "Untitled Map";

    // Properly reconstruct Room objects with shape support
    this.rooms = (json.rooms || []).map((r) => {
      const room = new Room(
        r.id,
        r.x,
        r.y,
        r.width,
        r.height,
        r.shape || "rectangle"
      );
      room.label = r.label || "";
      room.markers = r.markers || [];
      room.walls = r.walls || [];
      return room;
    });

    // Handle legacy format
    if (json.corridors || json.secretPassages) {
      this.hallways = [];
      if (json.corridors) {
        json.corridors.forEach((c) => {
          const hallway = new Hallway(c.id, c.segments, c.width);
          hallway.label = c.label;
          hallway.isSecret = false;
          this.hallways.push(hallway);
        });
      }
      if (json.secretPassages) {
        json.secretPassages.forEach((s) => {
          const hallway = new Hallway(s.id, s.segments, s.width);
          hallway.label = s.label;
          hallway.isSecret = true;
          this.hallways.push(hallway);
        });
      }
    } else {
      this.hallways = json.hallways || [];
    }

    // Load standalone walls
    this.walls = json.walls || [];

    // Load standalone markers
    this.standaloneMarkers = json.standaloneMarkers || [];
  }

  /**
   * Serialize to compact JSON format for sharing
   *
   * @return {*}
   * @memberof MapData
   */
  toCompactJSON() {
    return {
      v: this.version,
      n: this.mapName,
      r: this.rooms.map((room) => [
        room.id,
        room.x,
        room.y,
        room.width,
        room.height,
        room.label || "",
        room.visible !== false ? 1 : 0,
        room.markers
          ? room.markers.map((marker) => [
              marker.type,
              marker.x,
              marker.y,
              marker.visible !== false ? 1 : 0,
              marker.label || "",
            ])
          : [],
        room.shape || "rectangle",
        room.walls && room.walls.length > 0
          ? room.walls.map((wall) => [
              wall.id,
              wall.segments.map((s) => [s.x1, s.y1, s.x2, s.y2]),
              wall.width,
              wall.label || "",
              wall.nodes || [],
              wall.isDotted ? 1 : 0,
            ])
          : [],
      ]),
      h: this.hallways.map((hallway) => [
        hallway.id,
        hallway.segments.map((s) => [s.x1, s.y1, s.x2, s.y2]),
        hallway.width,
        hallway.label || "",
        hallway.isSecret ? 1 : 0,
        hallway.visible !== false ? 1 : 0,
        hallway.nodes || [],
        hallway.startMarker
          ? [
              hallway.startMarker.type,
              hallway.startMarker.visible !== false ? 1 : 0,
            ]
          : null,
        hallway.endMarker
          ? [
              hallway.endMarker.type,
              hallway.endMarker.visible !== false ? 1 : 0,
            ]
          : null,
      ]),
      w: this.walls.map((wall) => [
        wall.id,
        wall.segments.map((s) => [s.x1, s.y1, s.x2, s.y2]),
        wall.width,
        wall.label || "",
        wall.nodes || [],
        wall.visible !== false ? 1 : 0,
        wall.isDotted ? 1 : 0,
      ]),
      sm: this.standaloneMarkers.map((marker) => [
        marker.id,
        marker.type,
        marker.x,
        marker.y,
        marker.visible !== false ? 1 : 0,
        marker.label || "",
      ]),
      sl: this.standaloneLabels.map((label) => [
        label.id,
        label.text,
        label.x,
        label.y,
        label.visible !== false ? 1 : 0,
      ]),
    };
  }

  /**
   * Deserialize from compact JSON format
   *
   * @param {*} compact
   * @memberof MapData
   */
  fromCompactJSON(compact) {
    this.version = compact.v || "1.0.0";
    this.mapName = compact.n || "Untitled Map";

    this.rooms = (compact.r || []).map((r) => {
      const shape = r[8] || "rectangle";
      const markers = r[7] || [];
      const wallsData = r[9] || [];
      const room = {
        id: r[0],
        type: "room",
        shape: shape,
        x: r[1],
        y: r[2],
        width: r[3],
        height: r[4],
        label: r[5] || "",
        visible: r[6] !== 0,
        markers: markers.map((i) => ({
          type: i[0],
          x: i[1],
          y: i[2],
          visible: i[3] !== 0,
          label: i[4] || "",
        })),
        walls: wallsData.map((w) => ({
          id: w[0],
          type: "wall",
          segments: w[1].map((s) => ({
            x1: s[0],
            y1: s[1],
            x2: s[2],
            y2: s[3],
          })),
          width: w[2],
          label: w[3] || "",
          nodes: w[4] || [],
          isDotted: w[5] !== undefined ? w[5] !== 0 : false,
          parentRoomId: r[0], // Set parent room ID
        })),
      };
      // Calculate radius for circle rooms
      if (shape === "circle") {
        room.radius = Math.min(room.width, room.height) / 2;
      }
      return room;
    });

    this.hallways = (compact.h || []).map((h) => ({
      id: h[0],
      type: "hallway",
      segments: h[1].map((s) => ({ x1: s[0], y1: s[1], x2: s[2], y2: s[3] })),
      width: h[2],
      label: h[3] || "",
      isSecret: h[4] !== 0,
      visible: h[5] !== 0,
      nodes: h[6] || [],
      startMarker: h[7] ? { type: h[7][0], visible: h[7][1] !== 0 } : null,
      endMarker: h[8] ? { type: h[8][0], visible: h[8][1] !== 0 } : null,
    }));

    this.walls = (compact.w || []).map((w) => ({
      id: w[0],
      type: "wall",
      segments: w[1].map((s) => ({ x1: s[0], y1: s[1], x2: s[2], y2: s[3] })),
      width: w[2],
      label: w[3] || "",
      nodes: w[4] || [],
      visible: w[5] !== 0,
      isDotted: w[6] !== undefined ? w[6] !== 0 : false,
      parentRoomId: null, // Standalone walls have no parent
    }));

    this.standaloneMarkers = (compact.sm || []).map((m) => ({
      id: m[0],
      type: m[1],
      x: m[2],
      y: m[3],
      visible: m[4] !== 0,
      label: m[5] || "",
    }));

    this.standaloneLabels = (compact.sl || []).map((l) => ({
      id: l[0],
      type: "standaloneLabel",
      text: l[1],
      x: l[2],
      y: l[3],
      visible: l[4] !== 0,
    }));
  }

  /**
   * Serialize to compressed base64 share string
   *
   * @return {string}
   * @memberof MapData
   */
  toShareString() {
    const compact = this.toCompactJSON();
    const json = JSON.stringify(compact);

    // Use pako for gzip compression
    const compressed = pako.deflate(json);
    const binary = String.fromCharCode.apply(null, compressed);
    return btoa(binary);
  }

  /**
   * Deserialize from compressed base64 share string
   *
   * @param {string} shareString
   * @return {*}
   * @memberof MapData
   */
  fromShareString(shareString) {
    try {
      const binary = atob(shareString);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const decompressed = pako.inflate(bytes, { to: "string" });
      const compact = JSON.parse(decompressed);
      this.fromCompactJSON(compact);
      return true;
    } catch (e) {
      console.error("Failed to parse share string:", e);
      return false;
    }
  }
}

/** @type {import("./types").Room} */
class Room {
  constructor(id, x, y, width, height, shape = "rectangle") {
    this.id = id;
    this.type = "room";
    this.shape = shape; // "rectangle" or "circle"
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    // For circles, width and height represent the bounding box, and radius is calculated
    this.radius = shape === "circle" ? Math.min(width, height) / 2 : null;
    this.label = "";
    this.markers = []; // Array of {type, x, y, visible} for room markers
    this.walls = []; // Array of Wall objects for walls inside this room
  }
}

/** @type {import("./types").RoomMarker} */
class RoomMarker {
  constructor(type, x, y) {
    this.type = type;
    this.x = x; // Position relative to room
    this.y = y;
    this.visible = true; // Toggle for GM control
    this.label = ""; // Optional label for the marker
  }
}
/** @type {import("./types").Hallway} */
class Hallway {
  constructor(id, segments, width) {
    this.id = id;
    this.type = "hallway";
    this.segments = segments; // Array of {x1, y1, x2, y2} for each segment
    this.width = width || CORRIDOR_WIDTH;
    this.label = "";
    this.isSecret = false; // Toggle for secret passage appearance
    this.nodes = []; // Array of {x, y} for intermediate points
    this.startMarker = null; // {type: "door"|"grate"|"none", visible: true/false}
    this.endMarker = null; // {type: "door"|"grate"|"none", visible: true/false}
  }
}

/** @type {import("./types").HallwayMarker} */
class HallwayMarker {
  constructor(type) {
    this.type = type;
    this.visible = true; // Toggle for GM control in Foundry
  }
}

/** @type {import("./types").Wall} */
class Wall {
  constructor(id, segments, width, parentRoomId = null) {
    this.id = id;
    this.type = "wall";
    this.segments = segments; // Array of {x1, y1, x2, y2} for each segment
    this.width = width || CORRIDOR_WIDTH;
    this.label = "";
    this.isDotted = false; // Toggle for dotted line appearance
    this.nodes = []; // Array of {x, y} for intermediate points
    this.parentRoomId = parentRoomId; // ID of room this wall belongs to, null if standalone
  }
}

/** @type {import("./types").StandaloneMarker} */
class StandaloneMarker {
  constructor(id, type, x, y) {
    this.id = id;
    this.type = type;
    this.x = x; // Absolute position on map
    this.y = y;
    this.visible = true;
    this.label = "";
  }
}

/** @type {import("./types").StandaloneLabel} */
class StandaloneLabel {
  constructor(id, text, x, y) {
    this.id = id;
    this.type = "standaloneLabel";
    this.text = text;
    this.x = x; // Absolute position on map
    this.y = y;
    this.visible = true;
  }
}
