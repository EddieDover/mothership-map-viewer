/* eslint-disable no-undef */
/**
 * Main application logic for the map creator
 */

/** @type {(import("./types").MapCreator)} */
class MapCreator {
  constructor() {
    this.mapData = new MapData();
    this.renderer = new MapRenderer(document.getElementById("mapCanvas"));
    this.currentTool = "select";
    this.selectedItem = null;
    this.drawingState = null;
    this.hallwayCreationState = null;
    this.nextId = 1;
    this.panState = null;
    this.dragState = null;
    this.clipboard = null;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    this.initializeEventListeners();
    this.updateMarkerSelectors();
    this.render();
  }

  /**
   * Initialize all event listeners for UI and canvas
   *
   * @memberof MapCreator
   */
  initializeEventListeners() {
    // Tool buttons
    const selectBtn = document.getElementById("selectBtn");
    if (selectBtn) {
      selectBtn.addEventListener("click", () => this.setTool("select"));
    }
    const addRoomBtn = document.getElementById("addRoomBtn");
    if (addRoomBtn) {
      addRoomBtn.addEventListener("click", () => this.setTool("room"));
    }
    const addCircleBtn = document.getElementById("addCircleBtn");
    if (addCircleBtn) {
      addCircleBtn.addEventListener("click", () => this.setTool("circle"));
    }
    const addHallwayBtn = document.getElementById("addHallwayBtn");
    if (addHallwayBtn) {
      addHallwayBtn.addEventListener("click", () => this.setTool("hallway"));
    }

    // Floating toolbar buttons (mirror the above)
    document
      .getElementById("floatingSelectBtn")
      .addEventListener("click", () => this.setTool("select"));
    document
      .getElementById("floatingAddRoomBtn")
      .addEventListener("click", () => this.setTool("room"));
    document
      .getElementById("floatingAddCircleBtn")
      .addEventListener("click", () => this.setTool("circle"));
    document
      .getElementById("floatingAddHallwayBtn")
      .addEventListener("click", () => this.setTool("hallway"));

    // Context toolbar buttons
    document
      .getElementById("floatingAddMarkerBtn")
      .addEventListener("click", () => this.addMarkerToSelectedRoom());
    document
      .getElementById("floatingDeleteBtn")
      .addEventListener("click", () => this.deleteSelectedItem());

    // Canvas events
    const canvas = document.getElementById("mapCanvas");
    canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e));
    canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
    canvas.addEventListener("mouseup", (e) => this.handleMouseUp(e));
    canvas.addEventListener("dblclick", (e) => this.handleDoubleClick(e));
    canvas.addEventListener("contextmenu", (e) => e.preventDefault()); // Prevent context menu on right-click

    // Keyboard events
    document.addEventListener("keydown", (e) => this.handleKeyDown(e));

    // Map name
    document.getElementById("mapName").addEventListener("input", (e) => {
      this.mapData.mapName = e.target.value;
    });

    // Reset View button
    document
      .getElementById("resetViewBtn")
      .addEventListener("click", () => this.resetView());

    // Export/Import buttons
    document
      .getElementById("exportBtn")
      .addEventListener("click", () => this.exportJSON());
    document
      .getElementById("importBtn")
      .addEventListener("click", () => this.importJSON());
    document
      .getElementById("shareBtn")
      .addEventListener("click", () => this.generateShareString());
    document
      .getElementById("loadShareBtn")
      .addEventListener("click", () => this.loadShareString());

    // File input for import
    document.getElementById("fileInput").addEventListener("change", (e) => {
      this.handleFileImport(e);
    });

    // Marker selector dropdowns
    document
      .getElementById("roomSelector")
      .addEventListener("change", (e) => this.handleRoomSelection(e));
    document
      .getElementById("hallwaySelector")
      .addEventListener("change", (e) => this.handleHallwaySelection(e));
    document
      .getElementById("markerSelector")
      .addEventListener("change", (e) => this.handleMarkerSelection(e));
  }

  /**
   * Set the current tool and update UI
   *
   * @param {import("./types").ToolType} tool
   * @memberof MapCreator
   */
  setTool(tool) {
    this.currentTool = tool;
    this.drawingState = null;
    this.hallwayCreationState = null;

    // Update button states for both toolbars
    document
      .querySelectorAll(".tool-btn, .floating-tool-btn")
      .forEach((btn) => btn.classList.remove("active"));

    // Handle button ID mapping for sidebar (if it exists)
    let buttonId;
    if (tool === "select") {
      buttonId = "selectBtn";
    } else {
      buttonId = `add${tool.charAt(0).toUpperCase() + tool.slice(1)}Btn`;
    }
    const sidebarButton = document.getElementById(buttonId);
    if (sidebarButton) {
      sidebarButton.classList.add("active");
    }

    // Handle button ID mapping for floating toolbar
    let floatingButtonId;
    if (tool === "select") {
      floatingButtonId = "floatingSelectBtn";
    } else {
      floatingButtonId = `floatingAdd${tool.charAt(0).toUpperCase() + tool.slice(1)}Btn`;
    }
    const floatingButton = document.getElementById(floatingButtonId);
    if (floatingButton) {
      floatingButton.classList.add("active");
    }
  }

  /**
   * Handle key down events (e.g. Escape to cancel actions, Delete to remove selected)
   *
   * @param {KeyboardEvent} e
   * @memberof MapCreator
   */
  handleKeyDown(e) {
    // Check if user is typing in an input field
    const activeElement = document.activeElement;
    const isTyping =
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.isContentEditable);

    // Escape key cancels hallway creation or marker placement
    if (e.key === "Escape") {
      if (this.hallwayCreationState) {
        this.hallwayCreationState = null;
        this.render();
      }
      if (this.markerPlacementMode) {
        this.markerPlacementMode = null;
      }
      this.updatePropertiesPanel();
    }

    // Ctrl+C to copy selected item
    if ((e.ctrlKey || e.metaKey) && e.key === "c" && this.selectedItem) {
      e.preventDefault();
      this.copySelectedItem();
    }

    // Ctrl+V to paste from clipboard
    if ((e.ctrlKey || e.metaKey) && e.key === "v" && this.clipboard) {
      e.preventDefault();
      this.pasteFromClipboard();
    }

    // Delete or Backspace key removes selected item (works regardless of current tool)
    // But don't trigger if user is typing in an input field
    if (
      (e.key === "Delete" || e.key === "Backspace") &&
      this.selectedItem &&
      !isTyping
    ) {
      e.preventDefault(); // Prevent backspace from navigating back in browser
      if (this.selectedItem.type === "marker") {
        // Delete marker from room
        this.selectedItem.room.markers.splice(this.selectedItem.markerIndex, 1);
      } else {
        // Delete room or hallway
        this.mapData.removeItem(this.selectedItem.type, this.selectedItem.id);
      }
      this.selectedItem = null;
      this.updatePropertiesPanel();
      this.render();
    }
  }

  /**
   * Copy the selected item to clipboard
   *
   * @return {void}
   * @memberof MapCreator
   */
  copySelectedItem() {
    if (!this.selectedItem) return;

    if (this.selectedItem.type === "marker") {
      // Copy marker
      this.clipboard = {
        type: "marker",
        data: {
          type: this.selectedItem.marker.type,
          label: this.selectedItem.marker.label || "",
          visible: this.selectedItem.marker.visible !== false,
        },
        roomId: this.selectedItem.room.id, // Store which room it came from
      };
    } else if (this.selectedItem.type === "room") {
      // Copy room (deep copy to avoid reference issues)
      this.clipboard = {
        type: "room",
        data: {
          shape: this.selectedItem.shape,
          width: this.selectedItem.width,
          height: this.selectedItem.height,
          label: this.selectedItem.label || "",
          markers: this.selectedItem.markers
            ? this.selectedItem.markers.map((m) => ({
                type: m.type,
                x: m.x,
                y: m.y,
                label: m.label || "",
                visible: m.visible !== false,
              }))
            : [],
        },
      };
    }
  }

  /**
   * Paste from clipboard at mouse cursor position
   *
   * @return {void}
   * @memberof MapCreator
   */
  pasteFromClipboard() {
    if (!this.clipboard) return;

    if (this.clipboard.type === "marker") {
      // Find which room the cursor is over, or use selected room
      let targetRoom = null;

      // Check if cursor is over a room
      targetRoom = this.getRoomAtPosition(this.lastMouseX, this.lastMouseY);

      // If no room at cursor, try selected room
      if (!targetRoom && this.selectedItem?.type === "room") {
        targetRoom = this.selectedItem;
      }

      // If still no room, try original room
      if (!targetRoom) {
        targetRoom = this.mapData.getItem("room", this.clipboard.roomId);
      }

      if (targetRoom) {
        // Calculate position relative to room where cursor is
        let relativeX = this.lastMouseX - targetRoom.x;
        let relativeY = this.lastMouseY - targetRoom.y;

        // Clamp to room bounds (with marker size consideration)
        relativeX = Math.max(0, Math.min(targetRoom.width - 16, relativeX));
        relativeY = Math.max(0, Math.min(targetRoom.height - 16, relativeY));

        const newMarker = {
          type: this.clipboard.data.type,
          x: relativeX,
          y: relativeY,
          label: this.clipboard.data.label,
          visible: this.clipboard.data.visible,
        };
        targetRoom.markers.push(newMarker);

        // Select the newly pasted marker
        this.selectedItem = {
          type: "marker",
          room: targetRoom,
          marker: newMarker,
          markerIndex: targetRoom.markers.length - 1,
        };

        this.updatePropertiesPanel();
        this.render();
      }
    } else if (this.clipboard.type === "room") {
      // Paste room at cursor position (center the room on the cursor)
      const halfWidth = this.clipboard.data.width / 2;
      const halfHeight = this.clipboard.data.height / 2;

      const newRoom = new Room(
        this.nextId++,
        this.renderer.snapToGrid(this.lastMouseX - halfWidth),
        this.renderer.snapToGrid(this.lastMouseY - halfHeight),
        this.clipboard.data.width,
        this.clipboard.data.height,
        this.clipboard.data.shape
      );
      newRoom.label = this.clipboard.data.label
        ? `${this.clipboard.data.label} (Copy)`
        : "";

      // Deep copy markers
      newRoom.markers = this.clipboard.data.markers.map((m) => ({
        type: m.type,
        x: m.x,
        y: m.y,
        label: m.label,
        visible: m.visible,
      }));

      this.mapData.addRoom(newRoom);
      this.selectedItem = newRoom;
      this.updatePropertiesPanel();
      this.render();
    }
  }

  /**
   * Get mouse coordinates accounting for canvas scaling
   *
   * @param {MouseEvent} e
   * @return {{mouseX: number, mouseY: number, x: number, y: number}}
   * @memberof MapCreator
   */
  getMouseCoordinates(e) {
    const canvas = this.renderer.canvas;
    const rect = canvas.getBoundingClientRect();

    // Calculate scale factor between CSS size and canvas resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Get mouse position relative to canvas, accounting for scale
    const mouseX = (e.clientX - rect.left) * scaleX - this.renderer.offsetX;
    const mouseY = (e.clientY - rect.top) * scaleY - this.renderer.offsetY;

    // Snapped coordinates for creating new items
    const x = this.renderer.snapToGrid(mouseX);
    const y = this.renderer.snapToGrid(mouseY);

    return { mouseX, mouseY, x, y };
  }

  /**
   * Handle mouse down events on the canvas
   *
   * @param {MouseEvent} e
   * @return {void}
   * @memberof MapCreator
   */
  handleMouseDown(e) {
    const { mouseX, mouseY, x, y } = this.getMouseCoordinates(e);

    // Right-click initiates panning
    if (e.button === 2) {
      this.panState = {
        startX: e.clientX,
        startY: e.clientY,
        offsetX: this.renderer.offsetX || 0,
        offsetY: this.renderer.offsetY || 0,
      };
      e.target.style.cursor = "grabbing";
      return;
    }

    // Marker placement mode
    if (this.markerPlacementMode) {
      const room = this.markerPlacementMode.room;
      // Check if click is inside the room (use unsnapped coordinates)
      if (
        mouseX >= room.x &&
        mouseX <= room.x + room.width &&
        mouseY >= room.y &&
        mouseY <= room.y + room.height
      ) {
        // Add marker at this position (relative to room)
        const marker = new RoomMarker(
          this.markerPlacementMode.markerType,
          mouseX - room.x,
          mouseY - room.y
        );
        if (!room.markers) room.markers = [];
        room.markers.push(marker);
        this.markerPlacementMode = null;
        this.updatePropertiesPanel();
        this.updateMarkerSelectors();
        this.render();
      } else {
        // Clicked outside - cancel
        this.markerPlacementMode = null;
        this.updatePropertiesPanel();
      }
      return;
    }

    // Select tool - for selecting existing items and dragging rooms/markers
    if (this.currentTool === "select") {
      // Check for markers first (highest priority)
      const markerResult = this.getMarkerAtPosition(mouseX, mouseY);
      if (markerResult) {
        // Select and prepare to drag marker
        this.selectedItem = {
          type: "marker",
          room: markerResult.room,
          marker: markerResult.marker,
          markerIndex: markerResult.index,
        };
        this.updatePropertiesPanel();
        this.updateMarkerSelectors();
        this.updateItemDetailsPanel();
        this.render();

        // Prepare to drag marker
        this.dragState = {
          type: "marker",
          marker: markerResult.marker,
          room: markerResult.room,
          startX: mouseX,
          startY: mouseY,
          markerStartX: markerResult.marker.x,
          markerStartY: markerResult.marker.y,
        };
        e.target.style.cursor = "move";
        return;
      }

      // Check if a marker was previously selected (before updating selection)
      const previouslySelectedMarker =
        this.selectedItem && this.selectedItem.type === "marker";

      // Check for rooms/hallways - use unsnapped coordinates
      const clickedItem = this.getItemAtPosition(mouseX, mouseY);
      if (clickedItem) {
        this.selectedItem = clickedItem;
        this.updatePropertiesPanel();
        this.updateMarkerSelectors();
        this.updateItemDetailsPanel();
        this.render();

        // If clicked on a room, prepare to drag it - use unsnapped coordinates
        // BUT: Don't allow room dragging if a marker was previously selected
        if (clickedItem.type === "room" && !previouslySelectedMarker) {
          this.dragState = {
            type: "room",
            room: clickedItem,
            startX: mouseX,
            startY: mouseY,
            roomStartX: clickedItem.x,
            roomStartY: clickedItem.y,
          };
          e.target.style.cursor = "move";
        }
      } else {
        // Clicked on empty space - deselect
        this.selectedItem = null;
        this.updatePropertiesPanel();
        this.updateMarkerSelectors();
        this.updateItemDetailsPanel();
        this.render();
      }
      return;
    }

    // For hallway tool, handle multi-point creation
    if (this.currentTool === "hallway") {
      const roomEdgeInfo = this.getRoomEdgeAtPosition(x, y);
      const hallwayPoint = this.getHallwayAtPosition(x, y);

      if (!this.hallwayCreationState && (roomEdgeInfo || hallwayPoint)) {
        // First click - start hallway at room edge or hallway
        this.hallwayCreationState = {
          nodes: [{ x, y, edgeInfo: roomEdgeInfo || hallwayPoint }],
          segments: [],
        };
        this.selectedItem = null;
        this.render();
        return;
      } else if (this.hallwayCreationState) {
        if (roomEdgeInfo || hallwayPoint) {
          // Clicking on a room edge or hallway - finish the hallway
          this.hallwayCreationState.nodes.push({
            x,
            y,
            edgeInfo: roomEdgeInfo || hallwayPoint,
          });
          this.finishHallway();
          return;
        } else {
          // Clicking in space - add intermediate node
          this.hallwayCreationState.nodes.push({ x, y, edgeInfo: null });
          this.render();
          return;
        }
      }
      return;
    }

    // Start drawing new room
    if (this.currentTool === "room") {
      this.selectedItem = null;
      this.drawingState = { startX: x, startY: y };
    }

    // Start drawing new circle room
    if (this.currentTool === "circle") {
      this.selectedItem = null;
      this.drawingState = { startX: x, startY: y, shape: "circle" };
    }
  }

  /**
   * Handle double-click events on the canvas
   * Double-clicking a room focuses the label input field
   *
   * @param {MouseEvent} e
   * @return {void}
   * @memberof MapCreator
   */
  handleDoubleClick(e) {
    const { mouseX, mouseY } = this.getMouseCoordinates(e);

    // Check if we double-clicked on a room
    const room = this.getRoomAtPosition(mouseX, mouseY);
    if (room) {
      // Select the room if it's not already selected
      this.selectedItem = room;
      this.updatePropertiesPanel();
      this.updateMarkerSelectors();

      // Focus the label input field after a brief delay to ensure the properties panel is updated
      setTimeout(() => {
        const labelInput = document.getElementById("itemLabel");
        if (labelInput) {
          labelInput.focus();
          labelInput.select(); // Also select all text for easy editing
        }
      }, 10);

      this.render();
    }
  }

  /**
   * Handle mouse move events on the canvas for previews
   *
   * @param {MouseEvent} e
   * @return {void}
   * @memberof MapCreator
   */
  handleMouseMove(e) {
    const { mouseX, mouseY, x, y } = this.getMouseCoordinates(e);

    // Track mouse position for paste functionality
    this.lastMouseX = x;
    this.lastMouseY = y;

    // Handle right-click panning
    if (this.panState) {
      const deltaX = e.clientX - this.panState.startX;
      const deltaY = e.clientY - this.panState.startY;
      this.renderer.offsetX = this.panState.offsetX + deltaX;
      this.renderer.offsetY = this.panState.offsetY + deltaY;
      this.render();
      return;
    }

    // Handle dragging (room or marker) - use unsnapped coordinates
    if (this.dragState) {
      const deltaX = mouseX - this.dragState.startX;
      const deltaY = mouseY - this.dragState.startY;

      if (this.dragState.type === "marker") {
        // Update marker position (relative to room)
        this.dragState.marker.x = this.dragState.markerStartX + deltaX;
        this.dragState.marker.y = this.dragState.markerStartY + deltaY;

        // Clamp marker position to stay within room bounds
        const room = this.dragState.room;
        this.dragState.marker.x = Math.max(
          0,
          Math.min(room.width, this.dragState.marker.x)
        );
        this.dragState.marker.y = Math.max(
          0,
          Math.min(room.height, this.dragState.marker.y)
        );
      } else if (this.dragState.type === "room") {
        // Update room position
        this.dragState.room.x = this.dragState.roomStartX + deltaX;
        this.dragState.room.y = this.dragState.roomStartY + deltaY;

        // Find and update all attached hallways
        const attachments = this.findHallwaysAttachedToRoom(
          this.dragState.room.id
        );
        attachments.forEach(({ hallway, nodeIndex }) => {
          this.updateHallwayNodeForRoomMove(
            hallway,
            nodeIndex,
            this.dragState.room
          );
          this.recalculateHallwaySegments(hallway);
        });
      }

      this.render();
      return;
    }

    // Handle room drawing preview
    if (this.drawingState && this.currentTool === "room") {
      this.drawingState.currentX = x;
      this.drawingState.currentY = y;
      this.render();
      this.drawPreview();
      return;
    }

    // Handle circle room drawing preview
    if (this.drawingState && this.currentTool === "circle") {
      this.drawingState.currentX = x;
      this.drawingState.currentY = y;
      this.render();
      this.drawPreview();
      return;
    }

    // Handle hallway ghost preview
    if (this.hallwayCreationState && this.currentTool === "hallway") {
      this.hallwayCreationState.ghostX = x;
      this.hallwayCreationState.ghostY = y;
      this.render();
      this.drawHallwayGhost();
    }
  }

  /**
   * Handle mouse up events to finalize drawing
   *
   * @param {MouseEvent} e
   * @return {void}
   * @memberof MapCreator
   */
  handleMouseUp(e) {
    // End panning
    if (this.panState && e.button === 2) {
      this.panState = null;
      e.target.style.cursor = "default";
      return;
    }

    // End dragging (marker or room)
    if (this.dragState) {
      const { x, y } = this.getMouseCoordinates(e);

      if (this.dragState.type === "marker") {
        // Finalize marker position with grid snapping (relative to room)
        const deltaX = x - this.dragState.startX;
        const deltaY = y - this.dragState.startY;

        // Snap marker position relative to room
        const newX = this.renderer.snapToGrid(
          this.dragState.markerStartX + deltaX
        );
        const newY = this.renderer.snapToGrid(
          this.dragState.markerStartY + deltaY
        );

        // Clamp to room bounds
        this.dragState.marker.x = Math.max(
          0,
          Math.min(this.dragState.room.width - 16, newX)
        );
        this.dragState.marker.y = Math.max(
          0,
          Math.min(this.dragState.room.height - 16, newY)
        );
      } else if (this.dragState.type === "room") {
        // Room dragging
        const deltaX = x - this.dragState.startX;
        const deltaY = y - this.dragState.startY;

        // Snap room to grid
        this.dragState.room.x = this.renderer.snapToGrid(
          this.dragState.roomStartX + deltaX
        );
        this.dragState.room.y = this.renderer.snapToGrid(
          this.dragState.roomStartY + deltaY
        );

        // Update all attached hallways one final time with snapped position
        const attachments = this.findHallwaysAttachedToRoom(
          this.dragState.room.id
        );
        attachments.forEach(({ hallway, nodeIndex }) => {
          this.updateHallwayNodeForRoomMove(
            hallway,
            nodeIndex,
            this.dragState.room
          );
          this.recalculateHallwaySegments(hallway);
        });
      }

      this.dragState = null;
      e.target.style.cursor = "default";
      this.render();
      return;
    }

    // Finalize room drawing
    if (this.drawingState && this.currentTool === "room") {
      const { x, y } = this.getMouseCoordinates(e);

      this.createRoom(this.drawingState.startX, this.drawingState.startY, x, y);
      this.drawingState = null;
      // Clear any preview remnants and re-render
      this.renderer.clear();
      this.render();
      return;
    }

    // Finalize circle room drawing
    if (this.drawingState && this.currentTool === "circle") {
      const { x, y } = this.getMouseCoordinates(e);

      this.createCircleRoom(
        this.drawingState.startX,
        this.drawingState.startY,
        x,
        y
      );
      this.drawingState = null;
      // Clear any preview remnants and re-render
      this.renderer.clear();
      this.render();
      return;
    }
  }

  /**
   * Create and add a new room to the map
   *
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @return {void}
   * @memberof MapCreator
   */
  createRoom(x1, y1, x2, y2) {
    const id = this.nextId++;
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    if (width < 20 || height < 20) return; // Minimum size

    const room = new Room(
      id,
      Math.min(x1, x2),
      Math.min(y1, y2),
      width,
      height
    );
    this.mapData.addRoom(room);
    this.selectedItem = room;
    this.updatePropertiesPanel();
    this.updateMarkerSelectors();
    this.updateItemDetailsPanel();
  }

  /**
   * Create and add a new circle room to the map
   *
   * @param {number} centerX - Center X coordinate
   * @param {number} centerY - Center Y coordinate
   * @param {number} edgeX - Edge point X coordinate
   * @param {number} edgeY - Edge point Y coordinate
   * @return {void}
   * @memberof MapCreator
   */
  createCircleRoom(centerX, centerY, edgeX, edgeY) {
    const id = this.nextId++;
    // Calculate radius from center to edge point
    const dx = edgeX - centerX;
    const dy = edgeY - centerY;
    const radius = Math.sqrt(dx * dx + dy * dy);

    if (radius < 20) return; // Minimum radius

    // Create circle room with diameter as width/height for bounding box
    const diameter = radius * 2;
    const room = new Room(
      id,
      centerX - radius, // Top-left X
      centerY - radius, // Top-left Y
      diameter,
      diameter,
      "circle"
    );
    this.mapData.addRoom(room);
    this.selectedItem = room;
    this.updatePropertiesPanel();
    this.updateMarkerSelectors();
    this.updateItemDetailsPanel();
  }

  /**
   * Finalize and add the hallway being created
   *
   * @return {void}
   * @memberof MapCreator
   */
  finishHallway() {
    const nodes = this.hallwayCreationState.nodes;
    if (nodes.length < 2) return;

    // Create segments connecting all nodes with orthogonal routing
    const segments = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const from = nodes[i];
      const to = nodes[i + 1];

      // Create orthogonal path between nodes
      const newSegments = this.createOrthogonalPath(from.x, from.y, to.x, to.y);
      segments.push(...newSegments);
    }

    const id = this.nextId++;
    const hallway = new Hallway(id, segments, CORRIDOR_WIDTH);

    // Preserve room attachment information for each node
    hallway.nodes = nodes.map((n) => {
      const node = { x: n.x, y: n.y };
      // Store room attachment info if this node is attached to a room edge
      if (n.edgeInfo && n.edgeInfo.room) {
        node.attachedRoom = {
          roomId: n.edgeInfo.room.id,
          edge: n.edgeInfo.edge,
          // Store the relative position along the edge (0-1)
          relativePosition: this.getRelativePositionOnEdge(n.edgeInfo),
        };
      }
      return node;
    });

    // Add default markers based on hallway type (will be set when isSecret is toggled)
    hallway.startMarker = new HallwayMarker("door");
    hallway.endMarker = new HallwayMarker("door");

    this.mapData.addHallway(hallway);
    this.selectedItem = hallway;
    this.hallwayCreationState = null;
    this.updatePropertiesPanel();
    this.updateMarkerSelectors();
    this.updateItemDetailsPanel();
    this.render();
  }

  /**
   * Create an orthogonal path (L-shaped) between two points
   *
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @return {Array}
   * @memberof MapCreator
   */
  createOrthogonalPath(x1, y1, x2, y2) {
    // Create L-shaped path with 90-degree angles
    const segments = [];

    if (x1 === x2) {
      // Straight vertical line
      segments.push({ x1, y1, x2, y2 });
    } else if (y1 === y2) {
      // Straight horizontal line
      segments.push({ x1, y1, x2, y2 });
    } else {
      // L-shape: horizontal first, then vertical
      segments.push({ x1, y1, x2: x2, y2: y1 });
      segments.push({ x1: x2, y1, x2, y2 });
    }

    return segments;
  }

  /**
   * Draw the preview of the room being drawn
   *
   * @return {void}
   * @memberof MapCreator
   */
  drawPreview() {
    if (!this.drawingState || !this.drawingState.currentX) return;

    const { startX, startY, currentX, currentY } = this.drawingState;
    const ctx = this.renderer.ctx;

    // Apply offset transformation for preview
    ctx.save();
    ctx.translate(this.renderer.offsetX, this.renderer.offsetY);

    ctx.strokeStyle = "#888888";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    if (this.currentTool === "room") {
      const width = currentX - startX;
      const height = currentY - startY;
      ctx.strokeRect(startX, startY, width, height);
    } else if (this.currentTool === "circle") {
      // Draw circle preview from center to edge
      const dx = currentX - startX;
      const dy = currentY - startY;
      const radius = Math.sqrt(dx * dx + dy * dy);
      ctx.beginPath();
      ctx.arc(startX, startY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * Get the room at a given position (if any)
   *
   * @param {number} x
   * @param {number} y
   * @return {Room|null}
   * @memberof MapCreator
   */
  getRoomAtPosition(x, y) {
    for (let room of this.mapData.rooms) {
      if (room.shape === "circle") {
        // Circle collision detection
        const centerX = room.x + room.radius;
        const centerY = room.y + room.radius;
        const dx = x - centerX;
        const dy = y - centerY;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared <= room.radius * room.radius) {
          return room;
        }
      } else {
        // Rectangle collision detection
        if (
          x >= room.x &&
          x <= room.x + room.width &&
          y >= room.y &&
          y <= room.y + room.height
        ) {
          return room;
        }
      }
    }
    return null;
  }

  /**
   * Get the room edge (if any) at a given position
   *
   * @param {number} x
   * @param {number} y
   * @return {Object|null}
   * @memberof MapCreator
   */
  getRoomEdgeAtPosition(x, y) {
    const edgeThreshold = EDGE_CLICK_THRESHOLD; // How close to an edge counts as clicking on it

    for (let room of this.mapData.rooms) {
      if (room.shape === "circle") {
        // Circle edge detection with 8 fixed attachment points
        const centerX = room.x + room.radius;
        const centerY = room.y + room.radius;
        const radius = room.radius;

        // Calculate angle from center to click point
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if click is near the edge
        if (Math.abs(distance - radius) <= edgeThreshold) {
          // Find nearest cardinal/ordinal direction (8 points)
          const angle = Math.atan2(dy, dx);
          // Convert to degrees for easier calculation
          const degrees = (angle * 180) / Math.PI;

          // Define 8 attachment points (N, NE, E, SE, S, SW, W, NW)
          const directions = [
            { name: "east", angle: 0, x: centerX + radius, y: centerY },
            {
              name: "southeast",
              angle: 45,
              x: centerX + radius * Math.cos(Math.PI / 4),
              y: centerY + radius * Math.sin(Math.PI / 4),
            },
            { name: "south", angle: 90, x: centerX, y: centerY + radius },
            {
              name: "southwest",
              angle: 135,
              x: centerX + radius * Math.cos((3 * Math.PI) / 4),
              y: centerY + radius * Math.sin((3 * Math.PI) / 4),
            },
            { name: "west", angle: 180, x: centerX - radius, y: centerY },
            {
              name: "northwest",
              angle: -135,
              x: centerX + radius * Math.cos((-3 * Math.PI) / 4),
              y: centerY + radius * Math.sin((-3 * Math.PI) / 4),
            },
            { name: "north", angle: -90, x: centerX, y: centerY - radius },
            {
              name: "northeast",
              angle: -45,
              x: centerX + radius * Math.cos(-Math.PI / 4),
              y: centerY + radius * Math.sin(-Math.PI / 4),
            },
          ];

          // Find closest direction
          let closestDirection = directions[0];
          let minAngleDiff = Math.abs(degrees - closestDirection.angle);

          for (let dir of directions) {
            let angleDiff = Math.abs(degrees - dir.angle);
            // Handle wrap-around (e.g., -170 and 170 degrees are close)
            if (angleDiff > 180) angleDiff = 360 - angleDiff;

            if (angleDiff < minAngleDiff) {
              minAngleDiff = angleDiff;
              closestDirection = dir;
            }
          }

          return {
            room,
            edge: closestDirection.name,
            point: { x: closestDirection.x, y: closestDirection.y },
          };
        }
      } else {
        // Rectangle edge detection (original code)
        const distToLeft = Math.abs(x - room.x);
        const distToRight = Math.abs(x - (room.x + room.width));
        const distToTop = Math.abs(y - room.y);
        const distToBottom = Math.abs(y - (room.y + room.height));

        // Check if we're within the room's bounds (with some tolerance)
        const withinXBounds =
          x >= room.x - edgeThreshold &&
          x <= room.x + room.width + edgeThreshold;
        const withinYBounds =
          y >= room.y - edgeThreshold &&
          y <= room.y + room.height + edgeThreshold;

        if (!withinXBounds || !withinYBounds) continue;

        // Find which edge is closest
        const minDist = Math.min(
          distToLeft,
          distToRight,
          distToTop,
          distToBottom
        );

        if (minDist <= edgeThreshold) {
          let edge, point;

          if (
            minDist === distToLeft &&
            y >= room.y &&
            y <= room.y + room.height
          ) {
            // Left edge
            edge = "left";
            point = { x: room.x, y: y };
          } else if (
            minDist === distToRight &&
            y >= room.y &&
            y <= room.y + room.height
          ) {
            // Right edge
            edge = "right";
            point = { x: room.x + room.width, y: y };
          } else if (
            minDist === distToTop &&
            x >= room.x &&
            x <= room.x + room.width
          ) {
            // Top edge
            edge = "top";
            point = { x: x, y: room.y };
          } else if (
            minDist === distToBottom &&
            x >= room.x &&
            x <= room.x + room.width
          ) {
            // Bottom edge
            edge = "bottom";
            point = { x: x, y: room.y + room.height };
          }

          if (edge) {
            return { room, edge, point };
          }
        }
      }
    }
    return null;
  }

  /**
   * Get the hallway at a given position (if any)
   *
   * @param {number} x
   * @param {number} y
   * @return {Object|null}
   * @memberof MapCreator
   */
  getHallwayAtPosition(x, y) {
    // Check if clicking on an existing hallway
    for (let hallway of this.mapData.hallways) {
      for (let segment of hallway.segments) {
        if (
          this.isPointNearLine(
            x,
            y,
            segment.x1,
            segment.y1,
            segment.x2,
            segment.y2,
            EDGE_CLICK_THRESHOLD
          )
        ) {
          // Find the closest point on this segment to snap to
          const closestPoint = this.getClosestPointOnSegment(x, y, segment);
          return {
            hallway,
            point: closestPoint,
            type: "hallway",
          };
        }
      }
    }
    return null;
  }

  /**
   * Get the closest point on a line segment to a given point
   *
   * @param {number} px
   * @param {number} py
   * @param {Object} segment
   * @return {Object}
   * @memberof MapCreator
   */
  getClosestPointOnSegment(px, py, segment) {
    const { x1, y1, x2, y2 } = segment;
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let x, y;

    if (param < 0) {
      x = x1;
      y = y1;
    } else if (param > 1) {
      x = x2;
      y = y2;
    } else {
      x = x1 + param * C;
      y = y1 + param * D;
    }

    return { x: this.renderer.snapToGrid(x), y: this.renderer.snapToGrid(y) };
  }

  /**
   * Draw the hallway ghost (the preview of the hallway being created)
   *
   * @return {void}
   * @memberof MapCreator
   */
  drawHallwayGhost() {
    if (!this.hallwayCreationState || !this.hallwayCreationState.ghostX) return;

    const ctx = this.renderer.ctx;
    const nodes = this.hallwayCreationState.nodes;
    const ghostX = this.hallwayCreationState.ghostX;
    const ghostY = this.hallwayCreationState.ghostY;

    // Apply offset transformation for ghost preview
    ctx.save();
    ctx.translate(this.renderer.offsetX, this.renderer.offsetY);

    // Draw all confirmed segments
    for (let i = 0; i < nodes.length - 1; i++) {
      const from = nodes[i];
      const to = nodes[i + 1];
      const segments = this.createOrthogonalPath(from.x, from.y, to.x, to.y);
      this.drawGhostSegments(ctx, segments);
    }

    // Draw segment from last node to cursor
    const lastNode = nodes[nodes.length - 1];
    const ghostSegments = this.createOrthogonalPath(
      lastNode.x,
      lastNode.y,
      ghostX,
      ghostY
    );
    this.drawGhostSegments(ctx, ghostSegments);

    // Draw nodes as circles
    ctx.fillStyle = "#888888";
    nodes.forEach((node) => {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  /**
   * Draw the given segments as ghost lines
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./types').SegmentsArray} segments
   * @memberof MapCreator
   */
  drawGhostSegments(ctx, segments) {
    ctx.strokeStyle = "#888888";
    ctx.lineWidth = CORRIDOR_WIDTH;
    ctx.globalAlpha = 0.5;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";

    segments.forEach((segment) => {
      ctx.beginPath();
      ctx.moveTo(segment.x1, segment.y1);
      ctx.lineTo(segment.x2, segment.y2);
      ctx.stroke();
    });

    ctx.globalAlpha = 1.0;
  }

  /**
   * Serialize to compact JSON format
   *
   * @param {number} x
   * @param {number} y
   * @return {import("./types").Hallway|import("./types").Room|null}
   * @memberof MapCreator
   */
  getItemAtPosition(x, y) {
    // Check rooms (top layer)
    for (let room of this.mapData.rooms) {
      if (
        x >= room.x &&
        x <= room.x + room.width &&
        y >= room.y &&
        y <= room.y + room.height
      ) {
        return room;
      }
    }

    // Check hallways
    for (let hallway of this.mapData.hallways) {
      // Check each segment
      for (let segment of hallway.segments) {
        if (
          this.isPointNearLine(
            x,
            y,
            segment.x1,
            segment.y1,
            segment.x2,
            segment.y2,
            hallway.width / 2
          )
        ) {
          return hallway;
        }
      }
    }

    return null;
  }

  /**
   * Get a marker at a given position within a room (if any)
   *
   * @param {number} x
   * @param {number} y
   * @return {{room: import("./types").Room, marker: import("./types").RoomMarker, index: number}|null}
   * @memberof MapCreator
   */
  getMarkerAtPosition(x, y) {
    const markerSize = 16; // Match the size from drawRoomMarker
    const hitRadius = markerSize * 1.5; // Increase hit area for easier clicking

    // If a marker is currently selected, check it first for priority
    if (this.selectedItem && this.selectedItem.type === "marker") {
      const room = this.selectedItem.room;
      const marker = this.selectedItem.marker;
      const markerX = room.x + marker.x;
      const markerY = room.y + marker.y;

      const distance = Math.sqrt(
        Math.pow(x - markerX, 2) + Math.pow(y - markerY, 2)
      );

      if (distance <= hitRadius) {
        return { room, marker, index: this.selectedItem.markerIndex };
      }
    }

    // Check all markers
    for (let room of this.mapData.rooms) {
      if (!room.markers || room.markers.length === 0) continue;

      // Check each marker in the room (no room bounds check needed)
      for (let i = 0; i < room.markers.length; i++) {
        const marker = room.markers[i];
        const markerX = room.x + marker.x;
        const markerY = room.y + marker.y;

        // Check if click is within marker bounds
        const distance = Math.sqrt(
          Math.pow(x - markerX, 2) + Math.pow(y - markerY, 2)
        );

        if (distance <= hitRadius) {
          return { room, marker, index: i };
        }
      }
    }

    return null;
  }

  /**
   * Get the relative position (0-1) of a point along a room edge
   *
   * @param {Object} edgeInfo - Object containing room, edge, and point
   * @return {number}
   * @memberof MapCreator
   */
  getRelativePositionOnEdge(edgeInfo) {
    const { room, edge, point } = edgeInfo;

    switch (edge) {
      case "left":
      case "right":
        // Vertical edges: position relative to height
        return (point.y - room.y) / room.height;
      case "top":
      case "bottom":
        // Horizontal edges: position relative to width
        return (point.x - room.x) / room.width;
      default:
        return 0.5; // Default to middle
    }
  }

  /**
   * Find all hallways that are attached to a specific room
   *
   * @param {number} roomId
   * @return {Array<{hallway: import("./types").Hallway, nodeIndex: number}>}
   * @memberof MapCreator
   */
  findHallwaysAttachedToRoom(roomId) {
    const attachments = [];

    for (let hallway of this.mapData.hallways) {
      hallway.nodes.forEach((node, index) => {
        if (node.attachedRoom && node.attachedRoom.roomId === roomId) {
          attachments.push({ hallway, nodeIndex: index });
        }
      });
    }

    return attachments;
  }

  /**
   * Update a hallway node's position when its attached room moves
   *
   * @param {import("./types").Hallway} hallway
   * @param {number} nodeIndex
   * @param {import("./types").Room} room
   * @memberof MapCreator
   */
  updateHallwayNodeForRoomMove(hallway, nodeIndex, room) {
    const node = hallway.nodes[nodeIndex];
    if (!node.attachedRoom || node.attachedRoom.roomId !== room.id) return;

    const { edge, relativePosition } = node.attachedRoom;

    // Calculate new position based on room's new position and the relative position on the edge
    switch (edge) {
      case "left":
        node.x = room.x;
        node.y = room.y + room.height * relativePosition;
        break;
      case "right":
        node.x = room.x + room.width;
        node.y = room.y + room.height * relativePosition;
        break;
      case "top":
        node.x = room.x + room.width * relativePosition;
        node.y = room.y;
        break;
      case "bottom":
        node.x = room.x + room.width * relativePosition;
        node.y = room.y + room.height;
        break;
    }
  }

  /**
   * Recalculate all segments for a hallway based on its nodes
   *
   * @param {import("./types").Hallway} hallway
   * @memberof MapCreator
   */
  recalculateHallwaySegments(hallway) {
    const segments = [];

    for (let i = 0; i < hallway.nodes.length - 1; i++) {
      const from = hallway.nodes[i];
      const to = hallway.nodes[i + 1];

      // Create orthogonal path between nodes
      const newSegments = this.createOrthogonalPath(from.x, from.y, to.x, to.y);
      segments.push(...newSegments);
    }

    hallway.segments = segments;
  }

  /**
   * Check if point (px, py) is within threshold distance of line segment (x1, y1) to (x2, y2)
   *
   * @param {number} px
   * @param {number} py
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @param {number} threshold
   * @return {boolean}
   * @memberof MapCreator
   */
  isPointNearLine(px, py, x1, y1, x2, y2, threshold) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy) <= threshold;
  }

  updatePropertiesPanel() {
    // Update context toolbar visibility
    this.updateContextToolbar();
    // Properties are now managed by the floating details panel
  }

  render() {
    this.renderer.render(this.mapData, this.selectedItem);

    // Draw marker placement indicator if in placement mode
    if (this.markerPlacementMode) {
      this.drawMarkerPlacementIndicator();
    }
  }

  /**
   * Draw an indicator when in marker placement mode
   *
   * @memberof MapCreator
   */
  drawMarkerPlacementIndicator() {
    const canvas = document.getElementById("mapCanvas");
    const ctx = this.renderer.ctx;

    ctx.save();

    // Draw indicator in top-right corner (no transformation needed, absolute positioning)
    const padding = 15;
    const text = "PLACING MARKER - Click in room or press ESC to cancel";

    // Set font to measure text
    ctx.font = "bold 14px sans-serif";
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = 20;

    // Background rectangle
    const rectX = canvas.width - textWidth - padding * 2;
    const rectY = padding;
    const rectWidth = textWidth + padding * 2;
    const rectHeight = textHeight + padding;

    ctx.fillStyle = "rgba(0, 81, 255, 0.9)";
    ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

    // White border
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);

    // Text
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, rectX + rectWidth / 2, rectY + rectHeight / 2);

    ctx.restore();
  }

  /**
   * Update context toolbar visibility based on selected item
   *
   * @memberof MapCreator
   */
  updateContextToolbar() {
    const contextToolbar = document.getElementById("contextToolbar");
    const addMarkerBtn = document.getElementById("floatingAddMarkerBtn");
    const deleteBtn = document.getElementById("floatingDeleteBtn");

    if (!this.selectedItem) {
      // Nothing selected - hide context toolbar
      contextToolbar.style.display = "none";
      return;
    }

    // Show context toolbar
    contextToolbar.style.display = "flex";

    // Show/hide add marker button based on item type
    if (this.selectedItem.type === "room") {
      addMarkerBtn.style.display = "flex";
    } else {
      addMarkerBtn.style.display = "none";
    }

    // Always show delete button when something is selected
    deleteBtn.style.display = "flex";
  }

  /**
   * Update the item details panel based on selected item
   *
   * @memberof MapCreator
   */
  updateItemDetailsPanel() {
    const panel = document.getElementById("itemDetailsPanel");
    const markerToolbar = document.querySelector(".marker-selector-toolbar");

    if (!this.selectedItem) {
      panel.style.display = "none";
      return;
    }

    // Position panel below the marker selector toolbar
    const markerToolbarRect = markerToolbar.getBoundingClientRect();
    const canvasContainer = document.querySelector(".canvas-container");
    const containerRect = canvasContainer.getBoundingClientRect();

    // Calculate position relative to canvas container
    const topPosition = markerToolbarRect.bottom - containerRect.top + 10;
    panel.style.top = `${topPosition}px`;

    // Show panel
    panel.style.display = "flex";

    const item = this.selectedItem;
    let html = "";

    if (item.type === "marker") {
      // Marker details
      html += `<label>
                Marker Type:
                <select id="detailsMarkerType" class="toolbar-select">
                  <option value="terminal" ${item.marker.type === "terminal" ? "selected" : ""}>Terminal</option>
                  <option value="hazard" ${item.marker.type === "hazard" ? "selected" : ""}>Hazard</option>
                  <option value="objective" ${item.marker.type === "objective" ? "selected" : ""}>Objective</option>
                  <option value="npc" ${item.marker.type === "npc" ? "selected" : ""}>NPC</option>
                  <option value="loot" ${item.marker.type === "loot" ? "selected" : ""}>Loot</option>
                  <option value="door" ${item.marker.type === "door" ? "selected" : ""}>Door</option>
                  <option value="window" ${item.marker.type === "window" ? "selected" : ""}>Window</option>
                </select>
              </label>`;
      html += `<label>
                Marker Label:
                <input type="text" id="detailsMarkerLabel" value="${item.marker.label || ""}" placeholder="Optional">
              </label>`;
      html += `<div class="checkbox-container">
                <input type="checkbox" id="detailsMarkerVisible" ${item.marker.visible !== false ? "checked" : ""}>
                <label for="detailsMarkerVisible" style="margin: 0;">Visible by Default</label>
              </div>`;
    } else if (item.type === "room") {
      // Room details
      html += `<label>
                Room Label:
                <input type="text" id="detailsRoomLabel" value="${item.label || ""}" placeholder="Optional">
              </label>`;
      html += `<div class="checkbox-container">
                <input type="checkbox" id="detailsRoomVisible" ${item.visible !== false ? "checked" : ""}>
                <label for="detailsRoomVisible" style="margin: 0;">Visible by Default</label>
              </div>`;
    } else if (item.type === "hallway") {
      // Hallway details
      html += `<label>
                Hallway Label:
                <input type="text" id="detailsHallwayLabel" value="${item.label || ""}" placeholder="Optional">
              </label>`;
      html += `<div class="checkbox-container">
                <input type="checkbox" id="detailsHallwayVisible" ${item.visible !== false ? "checked" : ""}>
                <label for="detailsHallwayVisible" style="margin: 0;">Visible by Default</label>
              </div>`;
      html += `<div class="checkbox-container" style="margin-top: 8px;">
                <input type="checkbox" id="detailsHallwaySecret" ${item.isSecret ? "checked" : ""}>
                <label for="detailsHallwaySecret" style="margin: 0;">Secret Passage</label>
              </div>`;
      html += `<hr style="border: 0; border-top: 1px solid #444; margin: 8px 0;">`;
      html += `<label style="font-weight: bold; margin-bottom: 4px;">Start Marker</label>`;
      html += `<label>
                Type:
                <select id="detailsStartMarkerType" class="toolbar-select">
                  <option value="none" ${!item.startMarker || item.startMarker.type === "none" ? "selected" : ""}>None</option>
                  <option value="door" ${item.startMarker && item.startMarker.type === "door" ? "selected" : ""}>Door</option>
                  <option value="grate" ${item.startMarker && item.startMarker.type === "grate" ? "selected" : ""}>Grate</option>
                </select>
              </label>`;
      html += `<div class="checkbox-container">
                <input type="checkbox" id="detailsStartMarkerVisible" ${!item.startMarker || item.startMarker.visible !== false ? "checked" : ""} ${!item.startMarker || item.startMarker.type === "none" ? "disabled" : ""}>
                <label for="detailsStartMarkerVisible" style="margin: 0;">Visible by Default</label>
              </div>`;
      html += `<hr style="border: 0; border-top: 1px solid #444; margin: 8px 0;">`;
      html += `<label style="font-weight: bold; margin-bottom: 4px;">End Marker</label>`;
      html += `<label>
                Type:
                <select id="detailsEndMarkerType" class="toolbar-select">
                  <option value="none" ${!item.endMarker || item.endMarker.type === "none" ? "selected" : ""}>None</option>
                  <option value="door" ${item.endMarker && item.endMarker.type === "door" ? "selected" : ""}>Door</option>
                  <option value="grate" ${item.endMarker && item.endMarker.type === "grate" ? "selected" : ""}>Grate</option>
                </select>
              </label>`;
      html += `<div class="checkbox-container">
                <input type="checkbox" id="detailsEndMarkerVisible" ${!item.endMarker || item.endMarker.visible !== false ? "checked" : ""} ${!item.endMarker || item.endMarker.type === "none" ? "disabled" : ""}>
                <label for="detailsEndMarkerVisible" style="margin: 0;">Visible by Default</label>
              </div>`;
    }

    panel.innerHTML = html;

    // Add event listeners
    if (item.type === "marker") {
      document
        .getElementById("detailsMarkerType")
        ?.addEventListener("change", (e) => {
          item.marker.type = e.target.value;
          this.updatePropertiesPanel();
          this.render();
        });

      document
        .getElementById("detailsMarkerLabel")
        ?.addEventListener("input", (e) => {
          item.marker.label = e.target.value;
          this.updatePropertiesPanel();
          this.updateMarkerSelectors();
        });

      document
        .getElementById("detailsMarkerVisible")
        ?.addEventListener("change", (e) => {
          item.marker.visible = e.target.checked;
          this.updatePropertiesPanel();
          this.render();
        });
    } else if (item.type === "room") {
      document
        .getElementById("detailsRoomLabel")
        ?.addEventListener("input", (e) => {
          item.label = e.target.value;
          this.updatePropertiesPanel();
          this.updateMarkerSelectors();
          this.render();
        });

      document
        .getElementById("detailsRoomVisible")
        ?.addEventListener("change", (e) => {
          item.visible = e.target.checked;
          this.updatePropertiesPanel();
          this.render();
        });
    } else if (item.type === "hallway") {
      document
        .getElementById("detailsHallwayLabel")
        ?.addEventListener("input", (e) => {
          item.label = e.target.value;
          this.updatePropertiesPanel();
          this.updateMarkerSelectors();
          this.render();
        });

      document
        .getElementById("detailsHallwayVisible")
        ?.addEventListener("change", (e) => {
          item.visible = e.target.checked;
          this.updatePropertiesPanel();
          this.render();
        });

      document
        .getElementById("detailsHallwaySecret")
        ?.addEventListener("change", (e) => {
          item.isSecret = e.target.checked;
          // Auto-update markers based on secret status
          if (item.isSecret) {
            if (item.startMarker) item.startMarker.type = "grate";
            if (item.endMarker) item.endMarker.type = "grate";
          } else {
            if (item.startMarker) item.startMarker.type = "door";
            if (item.endMarker) item.endMarker.type = "door";
          }
          this.updateItemDetailsPanel();
          this.render();
        });

      document
        .getElementById("detailsStartMarkerType")
        ?.addEventListener("change", (e) => {
          if (e.target.value === "none") {
            item.startMarker = null;
          } else {
            if (!item.startMarker) {
              item.startMarker = new HallwayMarker(e.target.value);
            } else {
              item.startMarker.type = e.target.value;
            }
          }
          this.updateItemDetailsPanel();
          this.render();
        });

      document
        .getElementById("detailsStartMarkerVisible")
        ?.addEventListener("change", (e) => {
          if (item.startMarker) {
            item.startMarker.visible = e.target.checked;
            this.render();
          }
        });

      document
        .getElementById("detailsEndMarkerType")
        ?.addEventListener("change", (e) => {
          if (e.target.value === "none") {
            item.endMarker = null;
          } else {
            if (!item.endMarker) {
              item.endMarker = new HallwayMarker(e.target.value);
            } else {
              item.endMarker.type = e.target.value;
            }
          }
          this.updateItemDetailsPanel();
          this.render();
        });

      document
        .getElementById("detailsEndMarkerVisible")
        ?.addEventListener("change", (e) => {
          if (item.endMarker) {
            item.endMarker.visible = e.target.checked;
            this.render();
          }
        });
    }
  }

  /**
   * Update the marker selector dropdowns with current rooms and markers
   *
   * @memberof MapCreator
   */
  updateMarkerSelectors() {
    const roomSelector = document.getElementById("roomSelector");
    const hallwaySelector = document.getElementById("hallwaySelector");
    const markerSelector = document.getElementById("markerSelector");
    const markerSelectorSection = document.getElementById(
      "markerSelectorSection"
    );

    // Clear and repopulate room selector
    roomSelector.innerHTML = '<option value="">-- No room --</option>';
    this.mapData.rooms.forEach((room, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = room.label || `Room ${index + 1}`;
      roomSelector.appendChild(option);
    });

    // Clear and repopulate hallway selector
    hallwaySelector.innerHTML = '<option value="">-- No hallway --</option>';
    this.mapData.hallways.forEach((hallway, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = hallway.label || `Hallway ${index + 1}`;
      hallwaySelector.appendChild(option);
    });

    // Update selections based on currently selected item
    if (this.selectedItem?.type === "marker") {
      // A marker is selected - show room and marker
      const roomIndex = this.mapData.rooms.indexOf(this.selectedItem.room);
      if (roomIndex !== -1) {
        roomSelector.value = roomIndex;
        hallwaySelector.value = "";
        this.populateMarkerSelector(roomIndex);
        markerSelector.value = this.selectedItem.markerIndex;
        markerSelectorSection.style.display = "flex";
      }
    } else if (this.selectedItem?.type === "room") {
      // A room is selected - show room, clear marker
      const roomIndex = this.mapData.rooms.indexOf(this.selectedItem);
      if (roomIndex !== -1) {
        roomSelector.value = roomIndex;
        hallwaySelector.value = "";
        this.populateMarkerSelector(roomIndex);
        markerSelector.value = "";
        markerSelectorSection.style.display = "flex";
      }
    } else if (this.selectedItem?.type === "hallway") {
      // A hallway is selected
      const hallwayIndex = this.mapData.hallways.indexOf(this.selectedItem);
      if (hallwayIndex !== -1) {
        roomSelector.value = "";
        hallwaySelector.value = hallwayIndex;
        markerSelector.innerHTML = '<option value="">-- No marker --</option>';
        markerSelector.disabled = true;
        markerSelectorSection.style.display = "none";
      }
    } else {
      // Nothing selected - clear all
      roomSelector.value = "";
      hallwaySelector.value = "";
      markerSelector.innerHTML = '<option value="">-- No marker --</option>';
      markerSelector.disabled = true;
      markerSelectorSection.style.display = "none";
    }
  }

  /**
   * Populate the marker selector dropdown for a specific room
   *
   * @param {number} roomIndex
   * @memberof MapCreator
   */
  populateMarkerSelector(roomIndex) {
    const markerSelector = document.getElementById("markerSelector");
    const room = this.mapData.rooms[roomIndex];

    markerSelector.innerHTML = '<option value="">-- No marker --</option>';

    if (room && room.markers && room.markers.length > 0) {
      room.markers.forEach((marker, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent =
          marker.label || `${marker.type} marker ${index + 1}`;
        markerSelector.appendChild(option);
      });
      markerSelector.disabled = false;
    } else {
      markerSelector.disabled = true;
    }
  }

  /**
   * Handle room selection from dropdown
   *
   * @param {Event} e
   * @memberof MapCreator
   */
  handleRoomSelection(e) {
    const roomIndex = parseInt(e.target.value);

    if (isNaN(roomIndex)) {
      // No room selected - clear selection
      const markerSelector = document.getElementById("markerSelector");
      markerSelector.innerHTML = '<option value="">-- No marker --</option>';
      markerSelector.disabled = true;
      this.selectedItem = null;
      this.updatePropertiesPanel();
      this.updateContextToolbar();
      this.updateItemDetailsPanel();
      this.render();
      return;
    }

    // Clear hallway selection
    document.getElementById("hallwaySelector").value = "";

    // Select the room
    const room = this.mapData.rooms[roomIndex];
    this.selectedItem = room;

    // Populate marker selector for this room
    this.populateMarkerSelector(roomIndex);

    // Reset marker selector to "no marker" since we just selected the room itself
    document.getElementById("markerSelector").value = "";

    this.updatePropertiesPanel();
    this.updateContextToolbar();
    this.updateItemDetailsPanel();
    this.render();
  }

  /**
   * Handle hallway selection from dropdown
   *
   * @param {Event} e
   * @memberof MapCreator
   */
  handleHallwaySelection(e) {
    const hallwayIndex = parseInt(e.target.value);

    if (isNaN(hallwayIndex)) {
      // No hallway selected - clear selection
      this.selectedItem = null;
      this.updatePropertiesPanel();
      this.updateContextToolbar();
      this.updateItemDetailsPanel();
      this.render();
      return;
    }

    // Clear room and marker selection
    document.getElementById("roomSelector").value = "";
    const markerSelector = document.getElementById("markerSelector");
    markerSelector.innerHTML = '<option value="">-- No marker --</option>';
    markerSelector.disabled = true;

    // Select the hallway
    const hallway = this.mapData.hallways[hallwayIndex];
    this.selectedItem = hallway;

    this.updatePropertiesPanel();
    this.updateContextToolbar();
    this.updateItemDetailsPanel();
    this.render();
  }

  /**
   * Handle marker selection from dropdown
   *
   * @param {Event} e
   * @memberof MapCreator
   */
  handleMarkerSelection(e) {
    const roomSelector = document.getElementById("roomSelector");
    const roomIndex = parseInt(roomSelector.value);
    const markerIndex = parseInt(e.target.value);

    if (isNaN(roomIndex) || isNaN(markerIndex)) {
      // No valid selection - reselect the room if it was selected
      if (!isNaN(roomIndex)) {
        const room = this.mapData.rooms[roomIndex];
        this.selectedItem = room;
      } else {
        this.selectedItem = null;
      }
      this.updatePropertiesPanel();
      this.updateContextToolbar();
      this.updateItemDetailsPanel();
      this.render();
      return;
    }

    const room = this.mapData.rooms[roomIndex];
    const marker = room.markers[markerIndex];

    // Select the marker
    this.selectedItem = {
      type: "marker",
      room: room,
      marker: marker,
      markerIndex: markerIndex,
    };

    this.updatePropertiesPanel();
    this.updateContextToolbar();
    this.updateItemDetailsPanel();
    this.render();
  }

  /**
   * Add a marker to the selected room
   *
   * @memberof MapCreator
   */
  addMarkerToSelectedRoom() {
    if (!this.selectedItem || this.selectedItem.type !== "room") {
      return;
    }

    const room = this.selectedItem;
    const newMarker = {
      type: "terminal",
      x: room.width / 2,
      y: room.height / 2,
      label: "",
      visible: true,
    };

    if (!room.markers) {
      room.markers = [];
    }

    room.markers.push(newMarker);

    // Select the newly added marker
    this.selectedItem = {
      type: "marker",
      room: room,
      marker: newMarker,
      markerIndex: room.markers.length - 1,
    };

    this.updatePropertiesPanel();
    this.updateMarkerSelectors();
    this.updateItemDetailsPanel();
    this.render();
  }

  /**
   * Delete the currently selected item
   *
   * @memberof MapCreator
   */
  deleteSelectedItem() {
    if (!this.selectedItem) return;

    if (this.selectedItem.type === "marker") {
      // Delete marker from room
      this.selectedItem.room.markers.splice(this.selectedItem.markerIndex, 1);
    } else {
      // Delete room or hallway
      this.mapData.removeItem(this.selectedItem.type, this.selectedItem.id);
    }

    this.selectedItem = null;
    this.updatePropertiesPanel();
    this.updateMarkerSelectors();
    this.render();
  }

  /**
   * Reset the canvas view back to center (0, 0 offset)
   *
   * @memberof MapCreator
   */
  resetView() {
    this.renderer.offsetX = 0;
    this.renderer.offsetY = 0;
    this.render();
  }

  exportJSON() {
    const json = JSON.stringify(this.mapData.toJSON(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.mapData.mapName || "map"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importJSON() {
    document.getElementById("fileInput").click();
  }

  /**
   * Recalculate nextId based on existing rooms and hallways
   * This ensures new items get unique IDs
   *
   * @memberof MapCreator
   */
  recalculateNextId() {
    let maxId = 0;

    // Check all room IDs
    this.mapData.rooms.forEach((room) => {
      if (room.id > maxId) {
        maxId = room.id;
      }
    });

    // Check all hallway IDs
    this.mapData.hallways.forEach((hallway) => {
      if (hallway.id > maxId) {
        maxId = hallway.id;
      }
    });

    // Set nextId to one more than the highest ID found
    this.nextId = maxId + 1;
  }

  /**
   * Handle file import and load map data
   *
   * @param {*} e
   * @return {*}
   * @memberof MapCreator
   */
  handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        this.mapData.fromJSON(json);
        document.getElementById("mapName").value = this.mapData.mapName;
        this.selectedItem = null;
        this.recalculateNextId(); // Recalculate nextId after loading
        this.updatePropertiesPanel();
        this.updateMarkerSelectors(); // Populate dropdowns with loaded data
        this.render();
        alert("Map imported successfully!");
      } catch (error) {
        alert("Error importing map: " + error.message);
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset file input
  }

  generateShareString() {
    const shareString = this.mapData.toShareString();
    const message = `Share this string to share your map:\n\n${shareString}`;

    // Copy to clipboard
    navigator.clipboard
      .writeText(shareString)
      .then(() => {
        alert(message + "\n\n(Copied to clipboard!)");
      })
      .catch(() => {
        alert(message);
      });
  }

  loadShareString() {
    const shareString = prompt("Paste the share string:");
    if (!shareString) return;

    if (this.mapData.fromShareString(shareString)) {
      document.getElementById("mapName").value = this.mapData.mapName;
      this.selectedItem = null;
      this.recalculateNextId(); // Recalculate nextId after loading
      this.updatePropertiesPanel();
      this.updateMarkerSelectors(); // Populate dropdowns with loaded data
      this.render();
      alert("Map loaded successfully!");
    } else {
      alert("Invalid share string!");
    }
  }
}

// Initialize the application when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.mapCreator = new MapCreator();
  var canvas = document.querySelector("canvas");
  fitToContainer(canvas);

  function fitToContainer(canvas) {
    // Make it visually fill the positioned parent
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    // ...then set the internal size to match
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  // Handle window resize to keep canvas resolution in sync with display size
  let resizeTimeout;
  window.addEventListener("resize", () => {
    // Debounce resize events to avoid too many re-renders
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      fitToContainer(canvas);
      // Re-render the map after resizing
      if (window.mapCreator) {
        window.mapCreator.render();
      }
    }, 100);
  });
});
