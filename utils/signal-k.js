import { localStorage } from "@zos/storage";

const SIGNAL_K_BASE_URL_KEY = "signal_k_base_url";
const DEFAULT_SIGNAL_K_BASE_URL = "http://localhost:3000";
const SIGNAL_K_SPEED_PATHS = [
  "/signalk/v1/api/vessels/self/navigation/speedThroughWater/value",
  "/signalk/v1/api/vessels/self/navigation/speedOverGround/value",
];

function normalizeSignalKBaseUrl(baseUrl) {
  if (typeof baseUrl !== "string") {
    return DEFAULT_SIGNAL_K_BASE_URL;
  }

  const trimmedBaseUrl = baseUrl.trim();
  if (!trimmedBaseUrl) {
    return DEFAULT_SIGNAL_K_BASE_URL;
  }

  return trimmedBaseUrl.replace(/\/+$/, "");
}

export function getSignalKBaseUrl() {
  return normalizeSignalKBaseUrl(localStorage.getItem(SIGNAL_K_BASE_URL_KEY));
}

export function setSignalKBaseUrl(baseUrl) {
  localStorage.setItem(
    SIGNAL_K_BASE_URL_KEY,
    normalizeSignalKBaseUrl(baseUrl),
  );
}

export function getSignalKSpeedUrls() {
  const signalKBaseUrl = getSignalKBaseUrl();
  return SIGNAL_K_SPEED_PATHS.map((path) => `${signalKBaseUrl}${path}`);
}

export {
  DEFAULT_SIGNAL_K_BASE_URL,
  SIGNAL_K_BASE_URL_KEY,
  SIGNAL_K_SPEED_PATHS,
};
