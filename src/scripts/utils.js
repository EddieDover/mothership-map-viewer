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
    rooms: (compact.r || []).map((r) => ({
      id: r[0],
      type: "room",
      x: r[1],
      y: r[2],
      width: r[3],
      height: r[4],
      label: r[5] || "",
      visible: r[6] !== 0,
      markers: (r[7] || []).map((i) => ({
        type: i[0],
        x: i[1],
        y: i[2],
        visible: i[3] !== 0,
        label: i[4] || "",
      })),
      shape: r[8] || "rectangle",
    })),
    hallways: (compact.h || []).map((h) => ({
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
      markers: (h[9] || []).map((i) => ({
        type: i[0],
        x: i[1],
        y: i[2],
        visible: i[3] !== 0,
        label: i[4] || "",
      })),
    })),
  };

  return mapData;
}
