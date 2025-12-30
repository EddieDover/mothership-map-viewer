# Mothership Map Viewer for Foundry VTT

A Foundry VTT module for displaying and managing 2D and 3D maps created with the Mothership Map Creator tool.

## Features

### Foundry VTT Module

- **2D or 3D**: Draw floor plans in 2D and view them in 2D or 3D.
- **Import Maps**: Load maps via JSON file or share string
- **GM Visibility Controls**: Toggle visibility of:
  - Individual rooms
  - Room markers (terminals, hazards, objectives, loot, NPCs, doors, windows, airlocks, ladders, elevators)
  - Hallways (both regular and secret passages)
  - Hallway endpoint markers (doors, grates, and airlocks)
  - Standalone walls (normal and dotted)
  - Standalone markers
  - Standalone labels
- **Player Views**: Open individual map viewers for each player and see real-time visibility updates (know who has the map open and who closed it)
- **Accurate Rendering**: Maps render exactly as they appear in the creator tool
- **Player Locations**: In 3D view, place a marker where players are in a room, for a more realistic experience.

### Map Creator Tool

#### Drawing Tools

<p align="center">
  <img src="docs/images/tool-select.svg" alt="Select" title="Select Object" />
  <img src="docs/images/tool-rectangle.svg" alt="Rectangle" title="Add Rectangle Room" />
  <img src="docs/images/tool-circle.svg" alt="Circle" title="Add Circle Room" />
  <img src="docs/images/tool-hallway.svg" alt="Hallway" title="Add Hallway" />
  <img src="docs/images/tool-wall.svg" alt="Wall" title="Add Wall" />
  <img src="docs/images/tool-marker.svg" alt="Marker" title="Add Marker" />
  <img src="docs/images/tool-label.svg" alt="Label" title="Add Label" />
</p>

- **Rooms**:
  - Rectangular rooms with adjustable dimensions
  - Circular rooms with adjustable radius
  - Add labels to identify rooms
  - Place internal walls within rooms
  - Add multiple markers within rooms
- **Hallways**:
  - Multi-segment paths connecting rooms
  - Click room edges to snap hallways
  - Support for L-shaped and complex paths
  - Endpoint markers (doors, grates, airlocks, or none for merging)
- **Standalone Elements**:
  - Walls for open areas between rooms
  - Markers that can be placed anywhere
  - Text labels for annotations

#### Marker Types

<p align="center">
  <img src="docs/images/marker-terminal.svg" alt="Terminal" title="Terminal" />
  <img src="docs/images/marker-hazard.svg" alt="Hazard" title="Hazard" />
  <img src="docs/images/marker-loot.svg" alt="Loot" title="Loot" />
  <img src="docs/images/marker-npc.svg" alt="NPC" title="NPC" />
  <img src="docs/images/marker-door.svg" alt="Door" title="Door" />
  <img src="docs/images/marker-ladder.svg" alt="Ladder" title="Ladder" />
  <img src="docs/images/marker-window.svg" alt="Window" title="Window" />
  <img src="docs/images/marker-airlock.svg" alt="Airlock" title="Airlock" />
  <img src="docs/images/marker-elevator.svg" alt="Elevator" title="Elevator" />
</p>

- **Terminal**: Computing terminal or console
- **Hazard**: Environmental danger or warning
- **Loot**: Valuable items or supplies
- **NPC**: Non-player character location
- **Door**: Doorway or passage
- **Ladder**: Vertical access point
- **Window**: Window or viewport
- **Airlock**: Sealed chamber entrance
- **Elevator**: Vertical transport

#### Hallway Endpoint Markers

<p align="center">
  <img src="docs/images/hallway-door.svg" alt="Door" title="Door" />
  <img src="docs/images/hallway-grate.svg" alt="Grate" title="Grate" />
  <img src="docs/images/hallway-airlock.svg" alt="Airlock" title="Airlock" />
</p>

- **Door**: Doorway connecting hallway segments
- **Grate**: Ventilation grate or grated passage
- **Airlock**: Sealed chamber entrance at hallway ends
- **None**: No marker (for merging hallway segments seamlessly)

#### Editing Features

- **Selection Tool**: Click to select any element
- **Move Rooms**: Drag rooms to reposition them
- **Copy/Paste**: Duplicate elements with Ctrl+C and Ctrl+V
- **Delete**: Remove elements with Delete or Backspace keys
- **Snap to Grid**: Toggle grid snapping for precise alignment
- **Pan View**: Right-click and drag to navigate large maps
- **Reset View**: A button is available to easily reset your view

#### Visibility Controls

- Set default visibility for rooms, hallways, and markers
- Fine-grained control over what players see on first import
- All visibility can be adjusted in Foundry by the GM after import

#### Import/Export

- **JSON**: Save and Load maps as JSON files.
- **Share Strings**: Generate and Load Base64-encoded, gzipped share codes
- **Community Maps**: Access shared maps from the wiki
- **Auto-Save**: Automatic localStorage backup (survives page refresh)

#### User Experience

- **Floating Toolbars**: Quick access to all drawing tools
- **Context Toolbars**: Tool-specific options when items are selected
- **Info Panel**: Real-time instructions for the current tool
- **Item Details Panel**: Edit properties of selected elements
- **Dropdown Selectors**: Quickly navigate between rooms, hallways, and markers

## Requirements

- Foundry VTT v13 or higher
- Mothership RPG System (mosh) v0.6.0 or higher

## Installation

1. In Foundry VTT, go to the Add-on Modules tab
2. Click "Install Module"
3. Search for "Mothership Map Viewer" inside Foundry or paste the manifest URL
4. Click Install

### Manifest URL

```
https://github.com/EddieDover/mothership-map-viewer/releases/latest/download/module.json
```

## Usage

### Map Creator

1. Visit [https://eddiedover.github.io/mothership-map-viewer/](https://eddiedover.github.io/mothership-map-viewer/) and create a map.
   - Draw Rectangular or Circular Rooms
   - Draw Hallways, with full control over if they have icons for their endpoints or not, to represent doors or grates. Selecting None allows you to merge multiple hallways together.
   - Place Markers in rooms to represent terminals, npcs, hazards, etc. If you'd like a custom marker added, file an Issue and we'll see if I can figure out how to draw it.
   - Decide which Rooms, Hallways, and Markers should be visible by default in Foundry. All Rooms, Hallways, and Markers can have their visibility toggled at any time inside Foundry, this is just give the GM less work after importing.
2. Export as JSON or a Sharable String (Base64 encoded, gzip'd version of the same JSON).

#### Wiki

The [Wiki](https://www.github.com/eddiedover/mothership-map-viewer/wiki) will eventually, hopefully, hold maps submitted by users.

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

### Module Screenshots

| Map Viewer Button |
| --- |
| <img width="296" height="233" alt="image" src="https://github.com/user-attachments/assets/27dab678-9ed8-4503-91a0-773ae74f5692" /> |

| GM View                                                                                                                              | Player View                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| <img width="1173" height="911" alt="image" src="https://github.com/user-attachments/assets/fada8b46-2a23-4ade-bf7b-206f6a81d891" /> | <img width="1213" height="915" alt="image" src="https://github.com/user-attachments/assets/a306648a-36e9-4be5-be63-f847a5ed6011" /> |
| <img width="1148" height="915" alt="image" src="https://github.com/user-attachments/assets/1c34b497-536f-4aed-8087-5b20dffe6c81" /> | <img width="1220" height="914" alt="image" src="https://github.com/user-attachments/assets/6b17cf51-8812-4a9d-8451-03c7fb3b6c84" /> |


## Support

Please file an Issue if possible. For things not bug related, please use the Discussion tab and open a discussion.

Or feel free to contact me on Discord: EddieDover or at my Discord Server [here](https://discord.gg/hshfZA73fG).
