import * as hmUI from "@zos/ui";
import { getText } from "@zos/i18n";
import {
  GESTURE_LEFT,
  GESTURE_RIGHT,
  offGesture,
  onGesture,
} from "@zos/interaction";
import { BasePage } from "@zeppos/zml/base-page";
import {
  DEFAULT_SIGNAL_K_BASE_URL,
  SIGNAL_K_METRIC_PATHS,
} from "../../../utils/signal-k.js";
import {
  ADMIN_DEBUG_STYLE,
  ADMIN_HINT_STYLE,
  ADMIN_OPTION_BUTTON_STYLE,
  ADMIN_OPTION_Y_POSITIONS,
  ADMIN_SUBTITLE_STYLE,
  ADMIN_TITLE_STYLE,
  METRIC_LABEL_STYLE,
  METRIC_VALUE_STYLE,
  PAGE_INDICATOR_STYLE,
  SIGNAL_K_URL_DEBUG_STYLE,
  SCREEN_TITLE_STYLE,
  SETTINGS_BUTTON_STYLE,
  STATUS_TEXT_STYLE,
  THREE_ROW_Y_POSITIONS,
  TWO_ROW_Y_POSITIONS,
} from "zosLoader:./index.page.[pf].layout.js";
import {
  getRefreshFrequencyConfig,
  getRefreshFrequencyKey,
  setRefreshFrequencyKey,
} from "../../../utils/settings.js";
const KNOTS_PER_MPS = 1.9438444924406;
const DEGREES_PER_RADIAN = 180 / Math.PI;
const MAX_ROWS = 3;
const STATUS_COLORS = {
  loading: 0x7f8c8d,
  error: 0xff5a5a,
  partial: 0xf5b642,
  ready: 0x7f8c8d,
};
const ADMIN_SELECTED_BUTTON_COLOR = 0x56d8ff;
const ADMIN_DEFAULT_BUTTON_COLOR = ADMIN_OPTION_BUTTON_STYLE.normal_color;
const ADMIN_PRESSED_BUTTON_COLOR = ADMIN_OPTION_BUTTON_STYLE.press_color;
const RESPONSE_BODY_PREVIEW_LENGTH = 120;
const SIGNAL_K_METRIC_REQUEST_METHOD = "signalk.metric";
const SIGNAL_K_BASE_URL_METHOD = "signalk.base_url.get";
const SIGNAL_K_REQUEST_TIMEOUT_MS = 12000;
const TEXT_FALLBACKS = {
  speedTitle: "Vitesse bateau",
  trueWindTitle: "Vent reel",
  apparentWindTitle: "Vent apparent",
  speedUnit: "kn",
  loadingState: "Chargement...",
  errorState: "Signal K indisponible",
  partialState: "Donnees partielles",
  readyState: "En direct",
  bridgeErrorState: "Companio Zepp indisponible",
  adminTitle: "Admin",
  refreshFrequencyLabel: "Frequence de rafraichissement",
  refreshFrequencyFast: "Rapide - 0,5 s",
  refreshFrequencyMedium: "Moyen - 1 s",
  refreshFrequencySlow: "Lent - 2 s",
  adminHint: "Touchez la roue pour revenir",
  refreshFrequencyUpdated: "Frequence mise a jour",
  adminDebugTitle: "Diagnostic",
};

const REFRESH_FREQUENCY_OPTIONS = [
  {
    key: "fast",
    labelKey: "refreshFrequencyFast",
  },
  {
    key: "medium",
    labelKey: "refreshFrequencyMedium",
  },
  {
    key: "slow",
    labelKey: "refreshFrequencySlow",
  },
];

const SCREEN_DEFINITIONS = [
  {
    titleKey: "speedTitle",
    metricKeys: ["speedThroughWater", "speedOverGround"],
    metrics: [
      {
        label: "SOW",
        resolveValue: (data) => (data ? data.speedThroughWater : null),
        formatter: formatSpeedValue,
      },
      {
        label: "SOG",
        resolveValue: (data) => (data ? data.speedOverGround : null),
        formatter: formatSpeedValue,
      },
    ],
  },
  {
    titleKey: "trueWindTitle",
    metricKeys: ["trueWindDirection", "trueWindAngle", "trueWindSpeed"],
    metrics: [
      {
        label: "TWD",
        resolveValue: (data) => (data ? data.trueWindDirection : null),
        formatter: formatDirectionValue,
      },
      {
        label: "TWA",
        resolveValue: (data) => (data ? data.trueWindAngle : null),
        formatter: formatSignedAngleValue,
      },
      {
        label: "TWS",
        resolveValue: (data) => (data ? data.trueWindSpeed : null),
        formatter: formatSpeedValue,
      },
    ],
  },
  {
    titleKey: "apparentWindTitle",
    metricKeys: [
      "apparentWindDirection",
      "apparentWindAngle",
      "apparentWindSpeed",
      "headingTrue",
      "headingMagnetic",
    ],
    metrics: [
      {
        label: "AWD",
        resolveValue: getApparentWindDirection,
        formatter: formatDirectionValue,
      },
      {
        label: "AWA",
        resolveValue: (data) => (data ? data.apparentWindAngle : null),
        formatter: formatSignedAngleValue,
      },
      {
        label: "AWS",
        resolveValue: (data) => (data ? data.apparentWindSpeed : null),
        formatter: formatSpeedValue,
      },
    ],
  },
];

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeDegrees(degrees) {
  const normalizedDegrees = degrees % 360;
  return normalizedDegrees < 0 ? normalizedDegrees + 360 : normalizedDegrees;
}

function normalizeSignedDegrees(degrees) {
  const normalizedDegrees = normalizeDegrees(degrees);
  return normalizedDegrees > 180 ? normalizedDegrees - 360 : normalizedDegrees;
}

function toRoundedBearingDegrees(valueInRadians) {
  if (!isFiniteNumber(valueInRadians)) {
    return null;
  }

  const roundedDegrees = Math.round(
    normalizeDegrees(valueInRadians * DEGREES_PER_RADIAN),
  );

  return roundedDegrees === 360 ? 0 : roundedDegrees;
}

function toRoundedSignedDegrees(valueInRadians) {
  if (!isFiniteNumber(valueInRadians)) {
    return null;
  }

  return Math.round(
    normalizeSignedDegrees(valueInRadians * DEGREES_PER_RADIAN),
  );
}

function formatSpeedValue(valueInMetersPerSecond) {
  if (!isFiniteNumber(valueInMetersPerSecond)) {
    return `--.- ${t("speedUnit")}`;
  }

  return `${(valueInMetersPerSecond * KNOTS_PER_MPS).toFixed(1)} ${t(
    "speedUnit",
  )}`;
}

function formatBearingDegrees(directionDegrees) {
  if (directionDegrees < 10) {
    return `00${directionDegrees}`;
  }

  if (directionDegrees < 100) {
    return `0${directionDegrees}`;
  }

  return `${directionDegrees}`;
}

function formatDirectionValue(valueInRadians) {
  const directionDegrees = toRoundedBearingDegrees(valueInRadians);
  if (!isFiniteNumber(directionDegrees)) {
    return "--- deg";
  }

  return `${formatBearingDegrees(directionDegrees)} deg`;
}

function formatSignedAngleValue(valueInRadians) {
  const signedDegrees = toRoundedSignedDegrees(valueInRadians);
  if (!isFiniteNumber(signedDegrees)) {
    return "--- deg";
  }

  return `${signedDegrees} deg`;
}

function getApparentWindDirection(data) {
  if (!data) {
    return null;
  }

  if (isFiniteNumber(data.apparentWindDirection)) {
    return data.apparentWindDirection;
  }

  const heading =
    isFiniteNumber(data.headingTrue) ?
      data.headingTrue
    : isFiniteNumber(data.headingMagnetic) ?
      data.headingMagnetic
    : null;

  if (!isFiniteNumber(heading) || !isFiniteNumber(data.apparentWindAngle)) {
    return null;
  }

  return heading + data.apparentWindAngle;
}

function formatPageIndicator(screenIndex) {
  return `${screenIndex + 1}/${SCREEN_DEFINITIONS.length}`;
}

function getRefreshIntervalMs(refreshFrequencyKey) {
  return getRefreshFrequencyConfig(refreshFrequencyKey).intervalMs;
}

function t(textKey) {
  const translatedText = getText(textKey);
  if (typeof translatedText === "string" && translatedText && translatedText !== textKey) {
    return translatedText;
  }

  return TEXT_FALLBACKS[textKey] || textKey;
}

function getErrorMessage(error) {
  if (error && typeof error.message === "string") {
    return error.message;
  }

  return String(error);
}

function containsShakeTimeout(errorText) {
  return String(errorText || "").toLowerCase().includes("shake timeout");
}

function getResponseBodyPreview(body) {
  if (typeof body === "number") {
    return String(body);
  }

  if (typeof body !== "string") {
    return "<non-string body>";
  }

  const normalizedBody = body.replace(/\s+/g, " ").trim();
  if (!normalizedBody) {
    return "<empty body>";
  }

  return normalizedBody.slice(0, RESPONSE_BODY_PREVIEW_LENGTH);
}

function truncateForDebug(text, maxLength = 180) {
  if (typeof text !== "string") {
    return String(text);
  }

  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

Page(
  BasePage({
    name: "boat-dashboard-home.page",
    state: {
      currentScreenIndex: 0,
      isAdminOpen: false,
      refreshFrequencyKey: "slow",
    },
    onInit() {
      this.pollingTimer = null;
      this.isRefreshing = false;
      this.dashboardData = null;
      this.dashboardState = "loading";
      this.signalKBaseUrl = DEFAULT_SIGNAL_K_BASE_URL;
      this.metricLabelWidgets = [];
      this.metricValueWidgets = [];
      this.adminOptionButtons = [];
      this.debugState = {
        baseUrl: this.signalKBaseUrl || DEFAULT_SIGNAL_K_BASE_URL,
        screenTitleKey: SCREEN_DEFINITIONS[this.state.currentScreenIndex].titleKey,
        metricKey: "-",
        status: "-",
        error: "-",
        fetchError: "-",
        sideError: "-",
        bodyPreview: "-",
      };
      this.state.refreshFrequencyKey = getRefreshFrequencyKey();
      this.pollIntervalMs = getRefreshIntervalMs(this.state.refreshFrequencyKey);
    },
    build() {
      this.titleWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        ...SCREEN_TITLE_STYLE,
        visible: false,
      });
      this.settingsButtonWidget = hmUI.createWidget(hmUI.widget.BUTTON, {
        ...SETTINGS_BUTTON_STYLE,
        click_func: () => {
          this.toggleAdmin();
        },
      });
      this.statusWidget = hmUI.createWidget(hmUI.widget.TEXT, STATUS_TEXT_STYLE);
      this.pageIndicatorWidget = hmUI.createWidget(
        hmUI.widget.TEXT,
        PAGE_INDICATOR_STYLE,
      );
      this.adminTitleWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        ...ADMIN_TITLE_STYLE,
        visible: false,
      });
      this.adminSubtitleWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        ...ADMIN_SUBTITLE_STYLE,
        visible: false,
      });
      this.adminHintWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        ...ADMIN_HINT_STYLE,
        visible: false,
      });
      this.adminDebugWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        ...ADMIN_DEBUG_STYLE,
        visible: false,
      });
      this.signalKUrlDebugWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        ...SIGNAL_K_URL_DEBUG_STYLE,
        visible: false,
      });

      for (let index = 0; index < MAX_ROWS; index += 1) {
        this.metricLabelWidgets.push(
          hmUI.createWidget(hmUI.widget.TEXT, METRIC_LABEL_STYLE),
        );
        this.metricValueWidgets.push(
          hmUI.createWidget(hmUI.widget.TEXT, METRIC_VALUE_STYLE),
        );
      }

      for (let index = 0; index < REFRESH_FREQUENCY_OPTIONS.length; index += 1) {
        const option = REFRESH_FREQUENCY_OPTIONS[index];
        this.adminOptionButtons.push(
          hmUI.createWidget(hmUI.widget.BUTTON, {
            ...ADMIN_OPTION_BUTTON_STYLE,
            y: ADMIN_OPTION_Y_POSITIONS[index],
            text: t(option.labelKey),
            visible: false,
            click_func: () => {
              this.updateRefreshFrequency(option.key);
            },
          }),
        );
      }

      this.registerGestureHandler();
      this.applyDisplayState();
      this.startPolling();
    },
    registerGestureHandler() {
      onGesture({
        callback: (gesture) => {
          if (gesture === GESTURE_LEFT) {
            this.goToScreen(1);
            return true;
          }

          if (gesture === GESTURE_RIGHT) {
            this.goToScreen(-1);
            return true;
          }

          return false;
        },
      });
    },
    goToScreen(offset) {
      if (this.state.isAdminOpen) {
        return;
      }

      const screenCount = SCREEN_DEFINITIONS.length;
      const nextScreenIndex =
        (this.state.currentScreenIndex + offset + screenCount) % screenCount;

      if (nextScreenIndex === this.state.currentScreenIndex) {
        return;
      }

      this.state.currentScreenIndex = nextScreenIndex;
      this.debugState.screenTitleKey = SCREEN_DEFINITIONS[nextScreenIndex].titleKey;
      this.applyDisplayState();
      this.refreshDashboard();
    },
    startPolling() {
      if (this.pollingTimer) {
        return;
      }

      this.refreshDashboard();
      this.pollingTimer = setInterval(() => {
        this.refreshDashboard();
      }, this.pollIntervalMs);
    },
    stopPolling() {
      if (!this.pollingTimer) {
        return;
      }

      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    },
    async refreshDashboard() {
      if (this.isRefreshing) {
        return;
      }

      this.isRefreshing = true;
      this.debugState.baseUrl = this.signalKBaseUrl || DEFAULT_SIGNAL_K_BASE_URL;
      this.debugState.screenTitleKey =
        SCREEN_DEFINITIONS[this.state.currentScreenIndex].titleKey;

      try {
        await this.refreshSignalKBaseUrl();
        const dashboardData = await this.fetchDashboardData();
        this.showDashboardState(dashboardData);
      } catch (error) {
        this.showErrorState();
      } finally {
        this.isRefreshing = false;
      }
    },
    async refreshSignalKBaseUrl() {
      try {
        const response = await this.request(
          {
            method: SIGNAL_K_BASE_URL_METHOD,
            params: {},
          },
          {
            timeout: SIGNAL_K_REQUEST_TIMEOUT_MS,
          },
        );

        if (response && typeof response.baseUrl === "string" && response.baseUrl) {
          this.signalKBaseUrl = response.baseUrl;
          this.debugState.baseUrl = response.baseUrl;
        }
      } catch (_error) {
        // Keep the last known URL for display when companion bridge is unavailable.
      }
    },
    async fetchDashboardData() {
      const screenDefinition = SCREEN_DEFINITIONS[this.state.currentScreenIndex];
      const metricKeys = screenDefinition.metricKeys || [];
      const dashboardData = {
        ...(this.dashboardData || {}),
      };

      await Promise.all(
        metricKeys.map(async (metricKey) => {
          try {
            dashboardData[metricKey] = await this.fetchSignalKMetric(metricKey);
          } catch (error) {
            dashboardData[metricKey] = null;
          }
        }),
      );

      return dashboardData;
    },
    async fetchSignalKMetric(metricKey) {
      if (!SIGNAL_K_METRIC_PATHS[metricKey]) {
        throw new Error(`Signal K metric is not configured: ${metricKey}`);
      }

      this.debugState.metricKey = metricKey;
      this.debugState.status = "pending";
      this.debugState.error = "-";
      this.debugState.fetchError = "disabled";
      this.debugState.sideError = "-";
      this.debugState.bodyPreview = "requesting app-side";

      try {
        const response = await this.request(
          {
            method: SIGNAL_K_METRIC_REQUEST_METHOD,
            params: {
              metricKey,
            },
          },
          {
            timeout: SIGNAL_K_REQUEST_TIMEOUT_MS,
          },
        );

        this.debugState.status = String(response && response.status);
        this.debugState.bodyPreview = truncateForDebug(
          getResponseBodyPreview(response && response.value),
        );

        if (response && typeof response.baseUrl === "string" && response.baseUrl) {
          this.signalKBaseUrl = response.baseUrl;
          this.debugState.baseUrl = response.baseUrl;
        }

        if (!response || !isFiniteNumber(response.value)) {
          throw new Error("Signal K payload is not numeric");
        }

        return response.value;
      } catch (error) {
        this.debugState.status = "request_failed";
        this.debugState.error = truncateForDebug(getErrorMessage(error));
        this.debugState.sideError = truncateForDebug(getErrorMessage(error));
        throw error;
      }
    },
    hasAnyAvailableMetric(data) {
      if (!data) {
        return false;
      }

      const screenDefinition = SCREEN_DEFINITIONS[this.state.currentScreenIndex];
      const metricKeys = screenDefinition.metricKeys || Object.keys(SIGNAL_K_METRIC_PATHS);

      for (let index = 0; index < metricKeys.length; index += 1) {
        if (isFiniteNumber(data[metricKeys[index]])) {
          return true;
        }
      }

      return false;
    },
    getRowsForCurrentScreen() {
      const screenDefinition = SCREEN_DEFINITIONS[this.state.currentScreenIndex];

      return screenDefinition.metrics.map((metricDefinition) => {
        const metricValue = metricDefinition.resolveValue(this.dashboardData);

        return {
          label: metricDefinition.label,
          valueText: metricDefinition.formatter(metricValue),
          available: isFiniteNumber(metricValue),
        };
      });
    },
    getStatusDisplay(rows) {
      if (this.dashboardState === "loading") {
        return {
          text: t("loadingState"),
          color: STATUS_COLORS.loading,
        };
      }

      if (this.dashboardState === "error") {
        const hasCompanionBridgeError =
          containsShakeTimeout(this.debugState.sideError) ||
          containsShakeTimeout(this.debugState.error);

        return {
          text: hasCompanionBridgeError ? t("bridgeErrorState") : t("errorState"),
          color: STATUS_COLORS.error,
        };
      }

      let availableRowCount = 0;

      for (let index = 0; index < rows.length; index += 1) {
        if (rows[index].available) {
          availableRowCount += 1;
        }
      }

      if (availableRowCount === rows.length) {
        return {
          text: t("readyState"),
          color: STATUS_COLORS.ready,
        };
      }

      if (availableRowCount > 0 || this.hasAnyAvailableMetric(this.dashboardData)) {
        return {
          text: t("partialState"),
          color: STATUS_COLORS.partial,
        };
      }

      return {
        text: t("errorState"),
        color: STATUS_COLORS.error,
      };
    },
    toggleAdmin() {
      this.state.isAdminOpen = !this.state.isAdminOpen;
      this.applyDisplayState();
    },
    updateRefreshFrequency(refreshFrequencyKey) {
      const normalizedKey = setRefreshFrequencyKey(refreshFrequencyKey);

      if (normalizedKey === this.state.refreshFrequencyKey) {
        return;
      }

      this.state.refreshFrequencyKey = normalizedKey;
      this.pollIntervalMs = getRefreshIntervalMs(normalizedKey);
      this.stopPolling();
      this.startPolling();
      hmUI.showToast({ text: t("refreshFrequencyUpdated") });
      this.applyDisplayState();
    },
    applyAdminState() {
      this.titleWidget.setProperty(hmUI.prop.VISIBLE, false);
      this.statusWidget.setProperty(hmUI.prop.VISIBLE, false);
      this.pageIndicatorWidget.setProperty(hmUI.prop.VISIBLE, false);
      this.adminTitleWidget.setProperty(hmUI.prop.VISIBLE, true);
      this.adminSubtitleWidget.setProperty(hmUI.prop.VISIBLE, true);
      this.adminTitleWidget.setProperty(hmUI.prop.TEXT, t("adminTitle"));
      this.adminSubtitleWidget.setProperty(hmUI.prop.TEXT, t("refreshFrequencyLabel"));
      this.adminHintWidget.setProperty(hmUI.prop.TEXT, t("adminHint"));
      this.adminHintWidget.setProperty(hmUI.prop.VISIBLE, true);
      this.adminDebugWidget.setProperty(hmUI.prop.VISIBLE, false);
      this.signalKUrlDebugWidget.setProperty(hmUI.prop.VISIBLE, false);

      for (let index = 0; index < MAX_ROWS; index += 1) {
        this.metricLabelWidgets[index].setProperty(hmUI.prop.VISIBLE, false);
        this.metricValueWidgets[index].setProperty(hmUI.prop.VISIBLE, false);
      }

      for (let index = 0; index < this.adminOptionButtons.length; index += 1) {
        const option = REFRESH_FREQUENCY_OPTIONS[index];
        const isSelected = option.key === this.state.refreshFrequencyKey;
        const buttonWidget = this.adminOptionButtons[index];

        buttonWidget.setProperty(hmUI.prop.VISIBLE, true);
        buttonWidget.setProperty(hmUI.prop.TEXT, t(option.labelKey));
        buttonWidget.setProperty(
          hmUI.prop.MORE,
          isSelected ?
            {
              normal_color: ADMIN_SELECTED_BUTTON_COLOR,
              press_color: ADMIN_SELECTED_BUTTON_COLOR,
            }
          : {
              normal_color: ADMIN_DEFAULT_BUTTON_COLOR,
              press_color: ADMIN_PRESSED_BUTTON_COLOR,
            },
        );
      }
    },
    applyDisplayState() {
      if (
        !this.titleWidget ||
        !this.settingsButtonWidget ||
        !this.statusWidget ||
        !this.pageIndicatorWidget ||
        !this.metricLabelWidgets.length ||
        !this.metricValueWidgets.length ||
        !this.adminTitleWidget ||
        !this.adminSubtitleWidget ||
        !this.adminHintWidget
      ) {
        return;
      }

      if (this.state.isAdminOpen) {
        this.applyAdminState();
        return;
      }

      const rows = this.getRowsForCurrentScreen();
      const rowPositions =
        rows.length === 2 ? TWO_ROW_Y_POSITIONS : THREE_ROW_Y_POSITIONS;
      const statusDisplay = this.getStatusDisplay(rows);

      this.titleWidget.setProperty(hmUI.prop.VISIBLE, false);
      this.statusWidget.setProperty(hmUI.prop.VISIBLE, true);
      this.pageIndicatorWidget.setProperty(hmUI.prop.VISIBLE, true);
      this.adminTitleWidget.setProperty(hmUI.prop.VISIBLE, false);
      this.adminSubtitleWidget.setProperty(hmUI.prop.VISIBLE, false);
      this.adminHintWidget.setProperty(hmUI.prop.VISIBLE, false);
      this.adminDebugWidget.setProperty(hmUI.prop.VISIBLE, false);
      this.statusWidget.setProperty(hmUI.prop.TEXT, statusDisplay.text);
      this.statusWidget.setProperty(hmUI.prop.COLOR, statusDisplay.color);
      this.pageIndicatorWidget.setProperty(
        hmUI.prop.TEXT,
        formatPageIndicator(this.state.currentScreenIndex),
      );

      for (let index = 0; index < this.adminOptionButtons.length; index += 1) {
        this.adminOptionButtons[index].setProperty(hmUI.prop.VISIBLE, false);
      }

      this.signalKUrlDebugWidget.setProperty(hmUI.prop.VISIBLE, false);

      for (let index = 0; index < MAX_ROWS; index += 1) {
        const labelWidget = this.metricLabelWidgets[index];
        const valueWidget = this.metricValueWidgets[index];
        const row = rows[index];
        const isVisible = !!row;

        labelWidget.setProperty(hmUI.prop.VISIBLE, isVisible);
        valueWidget.setProperty(hmUI.prop.VISIBLE, isVisible);

        if (!isVisible) {
          continue;
        }

        labelWidget.setProperty(hmUI.prop.TEXT, row.label);
        labelWidget.setProperty(hmUI.prop.Y, rowPositions[index]);
        valueWidget.setProperty(hmUI.prop.TEXT, row.valueText);
        valueWidget.setProperty(hmUI.prop.Y, rowPositions[index]);
      }
    },
    showDashboardState(dashboardData) {
      this.dashboardData = dashboardData;
      this.dashboardState =
        this.hasAnyAvailableMetric(dashboardData) ? "ready" : "error";
      this.applyDisplayState();
    },
    showErrorState() {
      this.dashboardState = "error";
      this.debugState.status = "dashboard_error";
      this.applyDisplayState();
    },
    onDestroy() {
      this.stopPolling();
      this.isRefreshing = false;
      offGesture();
      this.titleWidget = null;
      this.settingsButtonWidget = null;
      this.statusWidget = null;
      this.pageIndicatorWidget = null;
      this.adminTitleWidget = null;
      this.adminSubtitleWidget = null;
      this.adminHintWidget = null;
      this.adminDebugWidget = null;
      this.signalKUrlDebugWidget = null;
      this.metricLabelWidgets = [];
      this.metricValueWidgets = [];
      this.adminOptionButtons = [];
    },
  }),
);
