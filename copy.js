#!/usr/bin/env node
/* eslint-disable no-undef */

import fsSync from "fs";
import fs from "fs/promises";
import path from "path";

const DIST_DIR = "dist";
const FOUNDRY_LOCATION_FILE = ".foundrylocation";

/**
 * Reads the .foundrylocation file and returns the target directory
 * @returns {Promise<string>} The target directory path
 * @throws {Error} If the .foundrylocation file doesn't exist or is empty
 */
async function getFoundryLocation() {
  try {
    const location = await fs.readFile(FOUNDRY_LOCATION_FILE, "utf-8");
    const trimmedLocation = location.trim();

    if (!trimmedLocation) {
      throw new Error(`${FOUNDRY_LOCATION_FILE} file is empty`);
    }

    return trimmedLocation;
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        `${FOUNDRY_LOCATION_FILE} file does not exist. Please create this file with the path to your Foundry modules directory.`
      );
    }
    throw error;
  }
}

/**
 * Recursively copies files and directories from source to destination
 * @param {string} src Source directory
 * @param {string} dest Destination directory
 */
async function copyRecursive(src, dest) {
  const stats = await fs.stat(src);

  if (stats.isDirectory()) {
    // Create destination directory if it doesn't exist
    await fs.mkdir(dest, { recursive: true });

    // Get all files and directories in the source
    const entries = await fs.readdir(src);

    // Copy each entry recursively
    for (const entry of entries) {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      await copyRecursive(srcPath, destPath);
    }
  } else {
    // Copy file
    await fs.copyFile(src, dest);
    console.log(`Copied: ${src} -> ${dest}`);
  }
}

/**
 * Main function to copy dist folder to Foundry location
 */
async function main() {
  try {
    console.log("Starting copy process...");

    // Check if dist directory exists
    if (!fsSync.existsSync(DIST_DIR)) {
      throw new Error(
        `${DIST_DIR} directory does not exist. Run 'npm run build' first.`
      );
    }

    // Get the target directory from .foundrylocation
    const foundryLocation = await getFoundryLocation();
    console.log(`Target directory: ${foundryLocation}`);

    // Resolve the full path
    const targetPath = path.resolve(foundryLocation);

    // Check if target directory exists, create if it doesn't
    try {
      await fs.access(targetPath);
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log(`Creating target directory: ${targetPath}`);
        await fs.mkdir(targetPath, { recursive: true });
      } else {
        throw error;
      }
    }

    // Copy all contents from dist to target directory
    const distEntries = await fs.readdir(DIST_DIR);

    for (const entry of distEntries) {
      const srcPath = path.join(DIST_DIR, entry);
      const destPath = path.join(targetPath, entry);

      console.log(`Copying ${entry}...`);
      await copyRecursive(srcPath, destPath);
    }

    console.log(`Successfully copied ${DIST_DIR} contents to ${targetPath}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main();
