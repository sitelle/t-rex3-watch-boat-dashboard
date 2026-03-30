import { localStorage } from "@zos/storage";

const REFRESH_FREQUENCY_KEY = "refresh_frequency";

const REFRESH_FREQUENCIES = {
  fast: {
    key: "fast",
    intervalMs: 500,
  },
  medium: {
    key: "medium",
    intervalMs: 1000,
  },
  slow: {
    key: "slow",
    intervalMs: 2000,
  },
};

const DEFAULT_REFRESH_FREQUENCY_KEY = REFRESH_FREQUENCIES.slow.key;

function normalizeRefreshFrequencyKey(value) {
  if (typeof value !== "string") {
    return DEFAULT_REFRESH_FREQUENCY_KEY;
  }

  const normalizedValue = value.trim().toLowerCase();
  return REFRESH_FREQUENCIES[normalizedValue] ?
    normalizedValue
    : DEFAULT_REFRESH_FREQUENCY_KEY;
}

export function getRefreshFrequencyKey() {
  return normalizeRefreshFrequencyKey(
    localStorage.getItem(REFRESH_FREQUENCY_KEY),
  );
}

export function setRefreshFrequencyKey(value) {
  const normalizedValue = normalizeRefreshFrequencyKey(value);
  localStorage.setItem(REFRESH_FREQUENCY_KEY, normalizedValue);
  return normalizedValue;
}

export function getRefreshFrequencyConfig(value) {
  const normalizedValue = normalizeRefreshFrequencyKey(value);
  return REFRESH_FREQUENCIES[normalizedValue];
}

export {
  DEFAULT_REFRESH_FREQUENCY_KEY,
  REFRESH_FREQUENCY_KEY,
  REFRESH_FREQUENCIES,
};
