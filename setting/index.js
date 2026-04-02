import { SIGNALK } from "../utils/config.js";

const SIGNAL_K_BASE_URL_KEY = "signal_k_base_url";
const STATIC_SIGNAL_K_BASE_URL_FALLBACK = "http://192.168.1.82:3000";
const DEFAULT_SIGNAL_K_BASE_URL =
  typeof SIGNALK.BASE_URL === "string" && SIGNALK.BASE_URL.trim() ?
    SIGNALK.BASE_URL.trim()
  : STATIC_SIGNAL_K_BASE_URL_FALLBACK;

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

function getCurrentSignalKBaseUrl(settingsStorage) {
  const storedValue = settingsStorage.getItem(SIGNAL_K_BASE_URL_KEY);
  return normalizeSignalKBaseUrl(storedValue);
}

AppSettingsPage({
  state: {
    signalKBaseUrl: DEFAULT_SIGNAL_K_BASE_URL,
  },
  build(props) {
    const currentSignalKBaseUrl = getCurrentSignalKBaseUrl(props.settingsStorage);
    const storedValue = props.settingsStorage.getItem(SIGNAL_K_BASE_URL_KEY);

    if (storedValue !== currentSignalKBaseUrl) {
      props.settingsStorage.setItem(SIGNAL_K_BASE_URL_KEY, currentSignalKBaseUrl);
    }

    this.state.signalKBaseUrl = currentSignalKBaseUrl;

    return Section(
      {
        title: "Signal K",
        description: "Configure URL used by Zepp companion to query Signal K.",
      },
      [
        TextInput({
          label: "Signal K URL",
          placeholder: DEFAULT_SIGNAL_K_BASE_URL,
          value: this.state.signalKBaseUrl,
          onChange: (nextUrl) => {
            props.settingsStorage.setItem(
              SIGNAL_K_BASE_URL_KEY,
              normalizeSignalKBaseUrl(nextUrl),
            );
          },
        }),
        Button({
          label: "Reset default URL",
          onClick: () => {
            props.settingsStorage.setItem(
              SIGNAL_K_BASE_URL_KEY,
              DEFAULT_SIGNAL_K_BASE_URL,
            );
          },
        }),
      ],
    );
  },
});
