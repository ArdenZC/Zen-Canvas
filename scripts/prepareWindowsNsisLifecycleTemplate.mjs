import fs from "node:fs";
import path from "node:path";
import {
  buildZenCanvasNsisTemplate as buildBaseZenCanvasNsisTemplate,
  cleanWindowsNsisTemplate,
  generatedTemplatePath,
  TAURI_NSIS_UPSTREAM_BLOB_SHA,
  upstreamTemplatePath,
} from "./prepareWindowsNsisTemplate.mjs";
import { hardenWindowsNsisGeneratedMetadata } from "./hardenWindowsNsisGeneratedMetadata.mjs";

export {
  cleanWindowsNsisTemplate,
  generatedTemplatePath,
  TAURI_NSIS_UPSTREAM_BLOB_SHA,
  upstreamTemplatePath,
};

export function buildZenCanvasNsisTemplate(upstream) {
  return hardenWindowsNsisGeneratedMetadata(buildBaseZenCanvasNsisTemplate(upstream));
}

export function prepareWindowsNsisTemplate() {
  const upstream = fs.readFileSync(upstreamTemplatePath, "utf8");
  const output = buildZenCanvasNsisTemplate(upstream);
  fs.mkdirSync(path.dirname(generatedTemplatePath), { recursive: true });
  fs.writeFileSync(generatedTemplatePath, output, "utf8");
  return generatedTemplatePath;
}
