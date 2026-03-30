import * as hmUI from "@zos/ui";
import { getText } from "@zos/i18n";
import { BasePage } from "@zeppos/zml/base-page";
import {
  DEFAULT_SIGNAL_K_BASE_URL,
  getSignalKBaseUrl,
  getSignalKSpeedUrls,
} from "../../../utils/signal-k.js";
import {
  SCREEN_TITLE_STYLE,
  SPEED_VALUE_STYLE,
  SPEED_UNIT_STYLE,
  STATUS_TEXT_STYLE,
} from "zosLoader:./index.page.[pf].layout.js";

const POLL_INTERVAL_MS = 2000;
const KNOTS_PER_MPS = 1.9438444924406;
const STATUS_COLORS = {
  loading: 0x7f8c8d,
  error: 0xff5a5a,
  ready: 0x7f8c8d,
};

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

function extractSpeedValue(response) {
  if (!response || typeof response.status !== "number") {
    throw new Error("Signal K empty response");
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Signal K HTTP ${response.status}`);
  }

  const payload = parseResponseBody(response.body);

  if (typeof payload === "number" && Number.isFinite(payload)) {
    return payload;
  }

  if (
    payload &&
    typeof payload === "object" &&
    typeof payload.value === "number" &&
    Number.isFinite(payload.value)
  ) {
    return payload.value;
  }

  throw new Error("Signal K speed payload is not numeric");
}

function formatKnots(speedInMetersPerSecond) {
  return (speedInMetersPerSecond * KNOTS_PER_MPS).toFixed(1);
}

Page(
  BasePage({
    name: "boat-dashboard-home.page",
    state: {
      speedText: "--.-",
      unitText: "",
      statusText: "",
      statusColor: STATUS_COLORS.loading,
    },
    onInit() {
      this.log("page onInit invoked");
      this.pollingTimer = null;
      this.isRefreshing = false;
      this.signalKBaseUrl = getSignalKBaseUrl();
      this.state.unitText = getText("speedUnit");
      this.state.statusText = getText("loadingState");
    },
    build() {
      this.log("page build invoked");
      this.titleWidget = hmUI.createWidget(hmUI.widget.TEXT, SCREEN_TITLE_STYLE);
      this.speedWidget = hmUI.createWidget(hmUI.widget.TEXT, SPEED_VALUE_STYLE);
      this.unitWidget = hmUI.createWidget(hmUI.widget.TEXT, SPEED_UNIT_STYLE);
      this.statusWidget = hmUI.createWidget(hmUI.widget.TEXT, STATUS_TEXT_STYLE);

      this.showLoadingState();
      this.startPolling();
    },
    startPolling() {
      if (this.pollingTimer) {
        return;
      }

      this.refreshSpeed();
      this.pollingTimer = setInterval(() => {
        this.refreshSpeed();
      }, POLL_INTERVAL_MS);
    },
    stopPolling() {
      if (!this.pollingTimer) {
        return;
      }

      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    },
    async refreshSpeed() {
      if (this.isRefreshing) {
        return;
      }

      this.isRefreshing = true;

      try {
        const speedValue = await this.fetchBoatSpeed();
        this.showSpeedState(formatKnots(speedValue));
      } catch (error) {
        this.error(error);
        this.showErrorState();
      } finally {
        this.isRefreshing = false;
      }
    },
    async fetchBoatSpeed() {
      let lastError = null;
      const signalKSpeedUrls = getSignalKSpeedUrls();

      this.signalKBaseUrl = getSignalKBaseUrl();

      for (let index = 0; index < signalKSpeedUrls.length; index += 1) {
        const speedUrl = signalKSpeedUrls[index];

        try {
          const response = await this.httpRequest({
            url: speedUrl,
            method: "GET",
          });

          return extractSpeedValue(response);
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error("Signal K speed endpoint unavailable");
    },
    applyDisplayState() {
      if (!this.speedWidget || !this.unitWidget || !this.statusWidget) {
        return;
      }

      this.speedWidget.setProperty(hmUI.prop.TEXT, this.state.speedText);
      this.unitWidget.setProperty(hmUI.prop.TEXT, this.state.unitText);
      this.statusWidget.setProperty(hmUI.prop.TEXT, this.state.statusText);
      this.statusWidget.setProperty(hmUI.prop.COLOR, this.state.statusColor);
    },
    showLoadingState() {
      this.state.speedText = getText("placeholderSpeed");
      this.state.unitText = getText("speedUnit");
      this.state.statusText = getText("loadingState");
      this.state.statusColor = STATUS_COLORS.loading;
      this.applyDisplayState();
    },
    showErrorState() {
      this.state.speedText = this.state.speedText || getText("placeholderSpeed");
      this.state.unitText = getText("speedUnit");
      this.state.statusText = getText("errorState");
      this.state.statusColor = STATUS_COLORS.error;
      this.debug(
        "Signal K base URL in use: %s",
        this.signalKBaseUrl || DEFAULT_SIGNAL_K_BASE_URL,
      );
      this.applyDisplayState();
    },
    showSpeedState(speedText) {
      this.state.speedText = speedText;
      this.state.unitText = getText("speedUnit");
      this.state.statusText = getText("readyState");
      this.state.statusColor = STATUS_COLORS.ready;
      this.applyDisplayState();
    },
    onDestroy() {
      this.log("page onDestroy invoked");
      this.stopPolling();
      this.isRefreshing = false;
      this.titleWidget = null;
      this.speedWidget = null;
      this.unitWidget = null;
      this.statusWidget = null;
    },
  }),
);
