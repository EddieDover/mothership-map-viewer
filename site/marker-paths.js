/* eslint-disable no-unused-vars */

/**
 * SVG Path Definitions for Markers
 * All paths are defined in a 32x32 coordinate system centered at (16, 16)
 */

/**
 * Room marker path definitions
 * Each marker is defined with paths and optional text
 */
const ROOM_MARKER_PATHS = {
  terminal: {
    paths: [
      "M 8 8 L 24 8 L 24 24 L 8 24 Z", // Rectangle
    ],
    text: { content: ">", x: 16, y: 16, font: "bold 12px sans-serif" },
    stroke: true,
    fill: false,
  },
  hazard: {
    paths: [
      "M 16 6 L 8 26 L 24 26 Z", // Triangle
    ],
    text: { content: "!", x: 16, y: 18, font: "bold 12px sans-serif" },
    stroke: true,
    fill: false,
  },
  loot: {
    paths: [
      "M 8 11 L 24 11 L 24 22 L 8 22 Z", // Filled rectangle (chest)
    ],
    stroke: true,
    fill: true,
  },
  npc: {
    paths: [
      "M 16 16 m -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0", // Circle
    ],
    stroke: true,
    fill: false,
  },
  door: {
    paths: [
      "M 8 6 L 12 6 L 12 26 L 8 26 Z", // Door rectangle
      "M 8 6 A 18 18 0 0 0 26 6", // Arc (swinging door)
    ],
    stroke: true,
    fill: false,
  },
  ladder: {
    paths: [
      "M 12 6 L 12 26", // Left vertical line
      "M 20 6 L 20 26", // Right vertical line
      "M 12 10 L 20 10", // Rung 1
      "M 12 14 L 20 14", // Rung 2
      "M 12 18 L 20 18", // Rung 3
      "M 12 22 L 20 22", // Rung 4
    ],
    stroke: true,
    fill: false,
  },
  window: {
    paths: [
      "M 8 10 L 24 10 L 24 22 L 8 22 Z", // Rectangle
      "M 16 10 L 16 22", // Vertical cross
      "M 8 16 L 24 16", // Horizontal cross
    ],
    stroke: true,
    fill: false,
  },
  airlock: {
    paths: [
      "M 16 16 m -10 0 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0", // Circle
      "M 16 16 L 24.5 8.5", // Spoke NE
      "M 16 16 L 24.5 23.5", // Spoke SE
      "M 16 16 L 7.5 23.5", // Spoke SW
      "M 16 16 L 7.5 8.5", // Spoke NW
    ],
    stroke: true,
    fill: false,
  },
  elevator: {
    paths: [
      "M 8 8 L 24 8 L 24 24 L 8 24 Z", // Rectangle
      // Up arrow
      "M 16 10 L 12 14", // Up arrow left side
      "M 16 10 L 20 14", // Up arrow right side
      // Down arrow
      "M 16 22 L 12 18", // Down arrow left side
      "M 16 22 L 20 18", // Down arrow right side
    ],
    stroke: true,
    fill: false,
  },
  stairs: {
    paths: [
      "M 6 24 L 11 24 L 11 20 L 16 20 L 16 16 L 21 16 L 21 12 L 26 12 L 26 8", // Side Profile Stairs
    ],
    stroke: true,
    fill: false,
  },
};

/**
 * Hallway marker path definitions
 * These markers have a black background fill
 */
const HALLWAY_MARKER_PATHS = {
  door: {
    background: "M 8 8 L 24 8 L 24 24 L 8 24 Z", // Black background
    paths: [
      "M 16 8 L 16 24", // Vertical line
    ],
    stroke: true,
    fill: false,
    hasBackground: true,
  },
  grate: {
    background: "M 8 8 L 24 8 L 24 24 L 8 24 Z", // Black background
    paths: [
      // Grid lines - vertical
      "M 8 8 L 8 24",
      "M 13.33 8 L 13.33 24",
      "M 18.67 8 L 18.67 24",
      "M 24 8 L 24 24",
      // Grid lines - horizontal
      "M 8 8 L 24 8",
      "M 8 13.33 L 24 13.33",
      "M 8 18.67 L 24 18.67",
      "M 8 24 L 24 24",
    ],
    stroke: true,
    fill: false,
    hasBackground: true,
  },
  airlock: {
    background: "M 8 8 L 24 8 L 24 24 L 8 24 Z", // Black background
    paths: [
      "M 16 16 m -8 0 a 8 8 0 1 0 16 0 a 8 8 0 1 0 -16 0", // Circle
      "M 16 16 L 20 12", // Spoke NE
      "M 16 16 L 20 20", // Spoke SE
      "M 16 16 L 12 20", // Spoke SW
      "M 16 16 L 12 12", // Spoke NW
    ],
    stroke: true,
    fill: false,
    hasBackground: true,
  },
};
