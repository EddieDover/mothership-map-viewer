export async function decodeShareString(shareString) {
  const binary = atob(shareString);

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const compressedStream = new Response(bytes).body;

  const decompressionStream = new DecompressionStream("deflate");
  const decompressedStream = compressedStream.pipeThrough(decompressionStream);

  const decompressedResponse = new Response(decompressedStream);

  const jsonString = await decompressedResponse.text();

  const compact = JSON.parse(jsonString);
  return fromCompactJSON(compact);
}

function fromCompactJSON(compact) {
  const mapData = {
    version: compact.v || "1.0.0",
    mapName: compact.n || "Untitled Map",
    rooms: (compact.r || []).map((r) => {
      const shape = r[8] || "rectangle";
      const markers = r[7] || [];
      const wallsData = r[9] || [];
      const labelsData = r[10] || [];
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
        floor: r[11] !== undefined ? r[11] : 1,
        markers: markers.map((i) => ({
          type: i[0],
          x: i[1],
          y: i[2],
          visible: i[3] !== 0,
          label: i[4] || "",
          rotation: i[5] || 0,
        })),
        labels: labelsData.map((l) => ({
          text: l[0],
          x: l[1],
          y: l[2],
          visible: l[3] !== undefined ? l[3] !== 0 : true,
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
          parentRoomId: r[0],
        })),
      };
      if (shape === "circle") {
        room.radius = Math.min(room.width, room.height) / 2;
      }
      return room;
    }),
    hallways: (compact.h || []).map((h) => ({
      id: h[0],
      type: "hallway",
      segments: h[1].map((s) => ({ x1: s[0], y1: s[1], x2: s[2], y2: s[3] })),
      width: h[2],
      label: h[3] || "",
      isSecret: h[4] !== 0,
      visible: h[5] !== 0,
      nodes: h[6] || [],
      startMarker: h[7]
        ? { type: h[7][0], visible: h[7][1] !== 0, rotation: h[7][2] || 0 }
        : null,
      endMarker: h[8]
        ? { type: h[8][0], visible: h[8][1] !== 0, rotation: h[8][2] || 0 }
        : null,
      markers: (h[9] || []).map((i) => ({
        type: i[0],
        x: i[1],
        y: i[2],
        visible: i[3] !== 0,
        label: i[4] || "",
        rotation: i[5] || 0,
      })),
      floor: h[10] !== undefined ? h[10] : 1,
    })),
    walls: (compact.w || []).map((w) => ({
      id: w[0],
      type: "wall",
      segments: w[1].map((s) => ({ x1: s[0], y1: s[1], x2: s[2], y2: s[3] })),
      width: w[2],
      label: w[3] || "",
      nodes: w[4] || [],
      visible: w[5] !== 0,
      isDotted: w[6] !== undefined ? w[6] !== 0 : false,
      floor: w[7] !== undefined ? w[7] : 1,
      parentRoomId: null,
    })),
    standaloneMarkers: (compact.sm || []).map((m) => ({
      id: m[0],
      type: m[1],
      x: m[2],
      y: m[3],
      visible: m[4] !== 0,
      label: m[5] || "",
      rotation: m[6] || 0,
      floor: m[7] !== undefined ? m[7] : 1,
    })),
    standaloneLabels: (compact.sl || []).map((l) => ({
      id: l[0],
      type: "standaloneLabel",
      text: l[1],
      x: l[2],
      y: l[3],
      visible: l[4] !== 0,
      floor: l[5] !== undefined ? l[5] : 1,
    })),
  };

  return mapData;
}
