import { localStorage } from "@zos/storage";

const SIGNAL_K_BASE_URL_KEY = "signal_k_base_url";
const DEFAULT_SIGNAL_K_BASE_URL = "http://localhost:3000";
const SIGNAL_K_METRIC_PATHS = {
  speedThroughWater: [
    "/signalk/v1/api/vessels/self/navigation/speedThroughWater/value",
  ],
  speedOverGround: [
    "/signalk/v1/api/vessels/self/navigation/speedOverGround/value",
  ],
  trueWindDirection: [
    "/signalk/v1/api/vessels/self/environment/wind/directionTrue/value",
  ],
  trueWindAngle: [
    "/signalk/v1/api/vessels/self/environment/wind/angleTrueWater/value",
    "/signalk/v1/api/vessels/self/environment/wind/angleTrueGround/value",
  ],
  trueWindSpeed: [
    "/signalk/v1/api/vessels/self/environment/wind/speedTrue/value",
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

export function buildSignalKUrls(paths) {
  const signalKBaseUrl = getSignalKBaseUrl();
  return paths.map((path) => `${signalKBaseUrl}${path}`);
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
