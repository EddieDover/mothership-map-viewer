/** @typedef {'door' | 'grate' | 'none'} HallwayMarkerType */
/** @typedef {'terminal'|'hazard'|'loot'|'npc'} RoomMarkerType */
/** @typedef {'select'|'drawRoom'|'drawHallway'} ToolType */
/** @typedef {Array<{x1: number, y1: number, x2: number, y2: number}>} SegmentsArray */

/**
 * @typedef {object} HallwayMarker
 * @property {HallwayMarkerType} type - Type of marker
 * @property {boolean} visible - Whether the marker is visible to players
 */

/**
 * @typedef {object} Hallway
 * @property {string} id - Unique identifier for the hallway
 * @property {string} type - Should always be "hallway"
 * @property {SegmentsArray} segments - Array of line segments making up the hallway
 * @property {number} width - Width of the hallway
 * @property {string} label - Optional label for the hallway
 * @property {boolean} isSecret - Whether the hallway is a secret passage
 * @property {Array<{x: number, y: number}>} nodes - Intermediate points for complex hallways
 * @property {HallwayMarker|null} startMarker - Marker at the start of the hallway
 * @property {HallwayMarker|null} endMarker - Marker at the end of the hallway
 */

/**
 * @typedef {object} RoomMarker
 * @property {RoomMarkerType} type - Type of marker
 * @property {number} x - X position relative to the room
 * @property {number} y - Y position relative to the room
 * @property {boolean} visible - Whether the marker is visible to players
 * @property {string} label - Optional label for the marker
 */

/**
 * @typedef {object} Room
 * @property {string} id - Unique identifier for the room
 * @property {string} type - Should always be "room"
 * @property {number} x - X position of the room
 * @property {number} y - Y position of the room
 * @property {number} width - Width of the room
 * @property {number} height - Height of the room
 * @property {string} label - Optional label for the room
 * @property {Array<RoomMarker>} markers - Array of markers placed in the room
 */

/**
 * @typedef {object} MapData
 * @property {string} version - Version of the map schema
 * @property {string} mapName - Name of the map
 * @property {Array<Room>} rooms - Array of Room objects
 * @property {Array<Hallway>} hallways - Array of Hallway objects
 */

/**
 * @typedef {object} MapRenderer
 * @property {HTMLCanvasElement} canvas - The canvas element to render on
 * @property {CanvasRenderingContext2D} ctx - The 2D rendering context for the canvas
 * @property {number} gridSize;
 * @property {boolean} showGrid;
 */

/**
 * @typedef {object} MapCreator
 * @property {MapData} mapData - The current map data
 * @property {MapRenderer} renderer - The map renderer
 * @property {ToolType} selectedTool - The currently selected tool
 * @property {Room|Hallway|null} selectedItem - The currently selected room or hallway
 * @property {object} drawingState - State related to drawing new rooms or hallways
 * @property {object} hallwayCreationState - State specific to hallway creation
 * @property {number} nextId - Counter for generating unique IDs
 */

module.exports = {};
// The above is to make VSCode happy about the typedefs being used in other files.
