# Mothership Map Viewer for Foundry VTT

A Foundry VTT module for displaying and managing maps created with the Mothership Map Creator tool.

## Features

- **Import Maps**: Load maps via JSON file or share string
- **GM Visibility Controls**: Toggle visibility of:
  - Individual rooms
  - Room markers (terminals, hazards, loot, NPCs, custom)
  - Hallways (both regular and secret passages)
  - Hallway endpoint markers (doors and grates)
- **Accurate Rendering**: Maps render exactly as they appear in the creator tool
- **Canvas-based Display**: High-quality rendering on HTML canvas

## Requirements

- Foundry VTT v13 or higher
- Mothership RPG System (mosh) v0.6.0 or higher

## Installation

1. In Foundry VTT, go to the Add-on Modules tab
2. Click "Install Module"
3. Search for "Mothership Map Viewer" or paste the manifest URL
4. Click Install

## Usage

### Map Creator

1. Visit [https://eddiedover.github.io/mothership-map-viewer/](https://eddiedover.github.io/mothership-map-viewer/) and create a map.
   - Draw Rectangular or Circular Rooms
   - Draw Hallways, with full control over if they have icons for their endpoints or not, to represent doors or grates. Selecting None allows you to merge multiple hallways together.
   - Place Markers in rooms to represent terminals, npcs, hazards, etc. If you'd like a custom marker added, file an Issue and we'll see if I can figure out how to draw it.
   - Decide which Rooms, Hallways, and Markers should be visible by default in Foundry. All Rooms, Hallways, and Markers can have their visibility toggled at any time inside Foundry, this is just give the GM less work after importing.
2. Export as JSON or a Sharable String (Base64 encoded, gzip'd version of the same JSON).

### Map Viewer

0. **Install the module in Foundry**

1. **Open the Viewer**:
   - Navigate to the Scene sidebar
   - Click the "Mothership Map Viewer" button at the top

2. **Import a Map**:
   - Click "Import JSON" to load a `.json` file exported from the Map Creator
   - Or click "Import Share String" to paste a share code

3. **Control Visibility** (GM only):
   - Use the checkboxes in the right panel to show/hide elements.
   - Only checked elements are visible to players.
   - Room markers are nested under their parent rooms.
   - Changes update the canvas in real-time.
   - Making a room or hallway visible does not make it's children visible. This was a design decision to prevent secrets from being oops'd.

4. **View the Map**:
   - Right-click and move to scroll the canvas as needed.
