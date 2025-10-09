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

4. **View the Map**:
   - Right-click and move to scroll the canvas as needed.
