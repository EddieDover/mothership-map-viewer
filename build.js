#!/usr/bin/env node
/* eslint-disable no-undef */

import archiver from "archiver";
import fsSync from "fs";
import fs from "fs/promises";
import path from "path";

const SRC_DIR = "src";
const DIST_DIR = "dist";

// Files and directories to exclude from the build
const EXCLUDE_PATTERNS = ["__tests__", ".test.js", ".spec.js"];

async function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some((pattern) => filePath.includes(pattern));
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (await shouldExclude(srcPath)) {
      console.log(`Excluding: ${srcPath}`);
      continue;
    }

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);

      console.log(`Copied: ${srcPath} -> ${destPath}`);
    }
  }
}

async function build() {
  try {
    // Clean dist directory

    console.log("Cleaning dist directory...");
    await fs.rm(DIST_DIR, { recursive: true, force: true });

    // Copy files

    console.log("Copying files...");
    await copyDir(SRC_DIR, DIST_DIR);

    console.log("Build completed successfully!");
  } catch (error) {
    console.error("Build failed:", error);

    process.exit(1);
  }
}

async function createZip() {
  const packageName = "mothership-crew-relationships.zip";

  try {
    console.log("Creating zip package...");

    const output = fsSync.createWriteStream(packageName);
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    return new Promise((resolve, reject) => {
      output.on("close", () => {
        console.log(
          `Package created: ${packageName} (${archive.pointer()} bytes)`
        );
        resolve();
      });

      archive.on("error", reject);
      output.on("error", reject);

      archive.pipe(output);
      archive.directory(DIST_DIR, false);
      archive.finalize();
    });
  } catch (error) {
    console.error("Packaging failed:", error);
    process.exit(1);
  }
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.includes("--package")) {
  await build();
  await createZip();
} else {
  await build();
}
