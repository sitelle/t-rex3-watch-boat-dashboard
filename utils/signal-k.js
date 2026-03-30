import { localStorage } from "@zos/storage";
import { SIGNALK } from "./config.js";

const SIGNAL_K_BASE_URL_KEY = "signal_k_base_url";
const SIGNAL_K_BASE_URL_VERSION_KEY = "signal_k_base_url_version";
const SIGNAL_K_BASE_URL_VERSION = "2";
const STATIC_SIGNAL_K_BASE_URL_FALLBACK = "http://192.168.1.82:3000";
const DEFAULT_SIGNAL_K_BASE_URL =
  typeof SIGNALK.BASE_URL === "string" && SIGNALK.BASE_URL.trim() ?
    SIGNALK.BASE_URL
  : STATIC_SIGNAL_K_BASE_URL_FALLBACK;
const SIGNAL_K_METRIC_PATHS = {
  speedThroughWater: [
    "/signalk/v1/api/vessels/self/navigation/speedThroughWater/value",
  ],
  speedOverGround: [
    "/signalk/v1/api/vessels/self/navigation/speedOverGround/value",
  ],
  trueWindDirection: [
    "/signalk/v1/api/vessels/self/environment/wind/directionTrue/value",
    "/signalk/v1/api/vessels/self/navigation/courseOverGroundTrue/value",
  ],
  trueWindAngle: [
    "/signalk/v1/api/vessels/self/environment/wind/angleTrueWater/value",
    "/signalk/v1/api/vessels/self/environment/wind/angleTrueGround/value",
    "/signalk/v1/api/vessels/self/environment/wind/angleApparent/value",
  ],
  trueWindSpeed: [
    "/signalk/v1/api/vessels/self/environment/wind/speedTrue/value",
    "/signalk/v1/api/vessels/self/environment/wind/speedApparent/value",
  ],
  apparentWindAngle: [
    "/signalk/v1/api/vessels/self/environment/wind/angleApparent/value",
  ],
  apparentWindSpeed: [
    "/signalk/v1/api/vessels/self/environment/wind/speedApparent/value",
  ],
  apparentWindDirection: [
    "/signalk/v1/api/vessels/self/environment/wind/directionApparent/value",
  ],
  headingTrue: [
    "/signalk/v1/api/vessels/self/navigation/headingTrue/value",
  ],
  headingMagnetic: [
    "/signalk/v1/api/vessels/self/navigation/headingMagnetic/value",
  ],
};

function getConfiguredSignalKBaseUrl() {
  const configuredBaseUrl =
    typeof DEFAULT_SIGNAL_K_BASE_URL === "string" ?
      DEFAULT_SIGNAL_K_BASE_URL.trim()
    : "";

  return configuredBaseUrl.replace(/\/+$/, "") || STATIC_SIGNAL_K_BASE_URL_FALLBACK;
}

function normalizeSignalKBaseUrl(baseUrl) {
  if (typeof baseUrl !== "string") {
    return getConfiguredSignalKBaseUrl();
  }

  const trimmedBaseUrl = baseUrl.trim();
  if (!trimmedBaseUrl) {
    return getConfiguredSignalKBaseUrl();
  }

  let normalizedBaseUrl = trimmedBaseUrl;

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(normalizedBaseUrl)) {
    normalizedBaseUrl = `http://${normalizedBaseUrl}`;
  }

  try {
    const parsedBaseUrl = new URL(normalizedBaseUrl);
    const protocol =
      parsedBaseUrl.protocol === "ws:" ? "http:"
      : parsedBaseUrl.protocol === "wss:" ? "https:"
      : parsedBaseUrl.protocol;
    const origin = `${protocol}//${parsedBaseUrl.host}`;

    return origin.replace(/\/+$/, "");
  } catch (_error) {
    const withoutSignalKApi = normalizedBaseUrl.replace(
      /\/signalk\/v1\/api\/?$/i,
      "",
    );
    const withoutSignalK = withoutSignalKApi.replace(/\/signalk\/?$/i, "");
    return withoutSignalK.replace(/\/+$/, "");
  }
}

function migrateSignalKBaseUrlFromConfig() {
  const currentVersion = localStorage.getItem(SIGNAL_K_BASE_URL_VERSION_KEY);
  if (currentVersion === SIGNAL_K_BASE_URL_VERSION) {
    return;
  }

  localStorage.setItem(SIGNAL_K_BASE_URL_KEY, getConfiguredSignalKBaseUrl());
  localStorage.setItem(
    SIGNAL_K_BASE_URL_VERSION_KEY,
    SIGNAL_K_BASE_URL_VERSION,
  );
}

function getStoredSignalKBaseUrl() {
  const storedBaseUrl = localStorage.getItem(SIGNAL_K_BASE_URL_KEY);
  if (typeof storedBaseUrl !== "string" || !storedBaseUrl.trim()) {
    return null;
  }

  return normalizeSignalKBaseUrl(storedBaseUrl);
}

export function getSignalKBaseUrl() {
  migrateSignalKBaseUrlFromConfig();
  return getStoredSignalKBaseUrl() || getConfiguredSignalKBaseUrl();
}

export function setSignalKBaseUrl(baseUrl) {
  localStorage.setItem(
    SIGNAL_K_BASE_URL_KEY,
    normalizeSignalKBaseUrl(baseUrl),
  );
  localStorage.setItem(
    SIGNAL_K_BASE_URL_VERSION_KEY,
    SIGNAL_K_BASE_URL_VERSION,
  );
}

export function buildSignalKUrls(paths) {
  const signalKBaseUrl = getSignalKBaseUrl();
  const candidateUrls = [];

  for (let pathIndex = 0; pathIndex < paths.length; pathIndex += 1) {
    candidateUrls.push(`${signalKBaseUrl}${paths[pathIndex]}`);
  }

  return candidateUrls;
}

export function getSignalKMetricUrls(metricKey) {
  const metricPaths = SIGNAL_K_METRIC_PATHS[metricKey] || [];
  return buildSignalKUrls(metricPaths);
}

export {
  DEFAULT_SIGNAL_K_BASE_URL,
  SIGNAL_K_BASE_URL_KEY,
  SIGNAL_K_METRIC_PATHS,
};
