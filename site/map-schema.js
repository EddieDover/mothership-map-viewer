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
   * Remove an item (room or hallway) from the map by ID
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
    }
  }

  /**
   * Get an item (room or hallway) by ID
   *
   * @param {string} type
   * @param {string} id
   * @return {import("./types").Room|import("./types").Hallway|null}
   * @memberof MapData
   */
  getItem(type, id) {
    switch (type) {
      case "room":
        return this.rooms.find((r) => r.id === id);
      case "hallway":
        return this.hallways.find((h) => h.id === id);
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
        room.shape || "rectangle", // Add shape property
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
      const shape = r[8] || "rectangle"; // Get shape from index 9
      const markers = r[7] || [];
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
  }
}

/** @type {import("./types").RoomMarker} */
class RoomMarker {
  constructor(type, x, y) {
    this.type = type; // e.g., "terminal", "hazard", "loot", "npc", "custom"
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
