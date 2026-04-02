import { BaseSideService } from "@zeppos/zml/base-side";
import { SIGNALK } from "../utils/config.js";

const SIGNAL_K_BASE_URL_KEY = "signal_k_base_url";
const SIGNAL_K_METRIC_METHOD = "signalk.metric";
const SIGNAL_K_BASE_URL_METHOD = "signalk.base_url.get";
const SIGNAL_K_HTTP_TIMEOUT_MS = 10000;
const STATIC_SIGNAL_K_BASE_URL_FALLBACK = "http://192.168.1.82:3000";
const DEFAULT_SIGNAL_K_BASE_URL =
  typeof SIGNALK.BASE_URL === "string" && SIGNALK.BASE_URL.trim() ?
    SIGNALK.BASE_URL.trim()
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

function getErrorMessage(error) {
  if (error && typeof error.message === "string") {
    return error.message;
  }

  return String(error);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function parseResponseBody(body) {
  if (typeof body === "number") {
    return body;
  }

  if (typeof body !== "string") {
    return body;
  }

  const trimmedBody = body.trim();
  if (!trimmedBody) {
    return null;
  }

  try {
    return JSON.parse(trimmedBody);
  } catch (_error) {
    const numericBody = Number(trimmedBody);
    if (Number.isFinite(numericBody)) {
      return numericBody;
    }

    return trimmedBody;
  }
}

function extractNumericValue(response) {
  if (!response || typeof response.status !== "number") {
    throw new Error("Signal K empty response");
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Signal K HTTP ${response.status}`);
  }

  const payload = parseResponseBody(response.body);
  if (isFiniteNumber(payload)) {
    return payload;
  }

  if (
    payload &&
    typeof payload === "object" &&
    isFiniteNumber(payload.value)
  ) {
    return payload.value;
  }

  throw new Error("Signal K payload is not numeric");
}

function normalizeSignalKBaseUrl(baseUrl) {
  if (typeof baseUrl !== "string") {
    return DEFAULT_SIGNAL_K_BASE_URL;
  }

  const trimmedBaseUrl = baseUrl.trim();
  if (!trimmedBaseUrl) {
    return DEFAULT_SIGNAL_K_BASE_URL;
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
    return `${protocol}//${parsedBaseUrl.host}`.replace(/\/+$/, "");
  } catch (_error) {
    return normalizedBaseUrl
      .replace(/\/signalk\/v1\/api\/?$/i, "")
      .replace(/\/signalk\/?$/i, "")
      .replace(/\/+$/, "");
  }
}

function withTimeout(promise, timeoutMs) {
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Signal K timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

AppSideService(
  BaseSideService({
    onInit() {
      this.log("side service onInit");
      const currentBaseUrl = this.getSignalKBaseUrl();
      this.log(`[SignalK][app-side] active_base_url=${currentBaseUrl}`);
    },
    onRun() {
      this.log("side service onRun");
    },
    onSettingsChange({ key, newValue }) {
      if (key !== SIGNAL_K_BASE_URL_KEY) {
        return;
      }

      const normalizedBaseUrl = normalizeSignalKBaseUrl(newValue);
      this.log(
        `[SignalK][app-side] settings_updated | key=${key} | value=${normalizedBaseUrl}`,
      );
    },
    getSignalKBaseUrl() {
      const storedValue = this.settings.getItem(SIGNAL_K_BASE_URL_KEY);
      const normalizedBaseUrl = normalizeSignalKBaseUrl(storedValue);

      if (storedValue !== normalizedBaseUrl) {
        this.settings.setItem(SIGNAL_K_BASE_URL_KEY, normalizedBaseUrl);
      }

      return normalizedBaseUrl;
    },
    async fetchSignalKMetric(metricKey) {
      const baseUrl = this.getSignalKBaseUrl();
      const metricPaths = SIGNAL_K_METRIC_PATHS[metricKey] || [];
      if (!metricPaths.length) {
        throw new Error(`Signal K metric is not configured: ${metricKey}`);
      }

      let lastError = null;
      for (let index = 0; index < metricPaths.length; index += 1) {
        const metricUrl = `${baseUrl}${metricPaths[index]}`;
        this.log(
          `[SignalK][app-side] request_start | metricKey=${metricKey} | attempt=${
            index + 1
          }/${metricPaths.length} | url=${metricUrl}`,
        );

        try {
          const response = await withTimeout(
            this.fetch({ url: metricUrl, method: "GET" }),
            SIGNAL_K_HTTP_TIMEOUT_MS,
          );
          const value = extractNumericValue(response);
          this.log(
            `[SignalK][app-side] request_success | metricKey=${metricKey} | status=${
              response.status
            } | url=${metricUrl}`,
          );

          return {
            metricKey,
            baseUrl,
            status: response.status,
            url: metricUrl,
            value,
          };
        } catch (error) {
          lastError = error;
          this.log(
            `[SignalK][app-side] request_error | metricKey=${metricKey} | url=${metricUrl} | error=${getErrorMessage(error)}`,
          );
        }
      }

      throw lastError || new Error(`Signal K metric unavailable: ${metricKey}`);
    },
    onRequest(request, respond) {
      if (!request || typeof request.method !== "string") {
        respond({ code: "invalid_request", message: "Invalid request payload" });
        return;
      }

      if (request.method === SIGNAL_K_BASE_URL_METHOD) {
        respond(null, {
          baseUrl: this.getSignalKBaseUrl(),
        });
        return;
      }

      if (request.method !== SIGNAL_K_METRIC_METHOD) {
        respond({
          code: "unsupported_method",
          message: `Unsupported request method: ${request.method}`,
        });
        return;
      }

      const metricKey =
        request.params && typeof request.params.metricKey === "string" ?
          request.params.metricKey
        : "";
      if (!metricKey) {
        respond({
          code: "invalid_metric_key",
          message: "metricKey is required",
        });
        return;
      }

      this.fetchSignalKMetric(metricKey)
        .then((response) => {
          respond(null, response);
        })
        .catch((error) => {
          respond({
            code: "signalk_fetch_error",
            message: getErrorMessage(error),
          });
        });
    },
    onDestroy() {
      this.log("side service onDestroy");
    },
  }),
);
