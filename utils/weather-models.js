import {
  O_RDONLY,
  closeSync,
  openSync,
  openAssetsSync,
  readFileSync,
  readSync,
  statAssetsSync,
} from "@zos/fs";
import { Time } from "@zos/sensor";

const DAY_MINUTES = 24 * 60;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSE_SECONDARY_SLOT_THRESHOLD_MS = 90 * MINUTE_MS;
const WEATHER_JSON_ASSET_PATHS = [
  "raw/modeles_meteo.json",
  "assets/raw/modeles_meteo.json",
  "/assets/raw/modeles_meteo.json",
  "/raw/modeles_meteo.json",
  "modeles_meteo.json",
  "assets://raw/modeles_meteo.json",
  "assets://assets/raw/modeles_meteo.json",
];
const WEATHER_JSON_HMFS_PATHS = [
  "raw/modeles_meteo.json",
  "/raw/modeles_meteo.json",
  "assets/raw/modeles_meteo.json",
  "/assets/raw/modeles_meteo.json",
  "modeles_meteo.json",
];
const WEATHER_JSON_CHUNK_SIZE = 2048;
let weatherJsonLoadError = "";

const PEAK_WINDOWS_UTC = [
  {
    id: "night",
    startUtcMinutes: 1 * 60,
    endUtcMinutes: 2 * 60,
    modelCount: 10,
    emphasis: "HARMONIE, HRRR, premiers rapides",
  },
  {
    id: "morning",
    startUtcMinutes: 8 * 60,
    endUtcMinutes: 8 * 60,
    modelCount: 7,
    emphasis: "run 06Z avec delai",
  },
  {
    id: "afternoon",
    startUtcMinutes: 14 * 60,
    endUtcMinutes: 14 * 60,
    modelCount: 7,
    emphasis: "run 12Z avec delai",
  },
  {
    id: "evening",
    startUtcMinutes: 20 * 60,
    endUtcMinutes: 22 * 60,
    modelCount: 13,
    emphasis: "runs 18Z/20Z cumules",
  },
];

function padTwoDigits(value) {
  return value < 10 ? `0${value}` : `${value}`;
}

function parseUtcHourMinuteLabel(utcLabel) {
  if (typeof utcLabel !== "string") {
    return null;
  }

  const match = utcLabel.match(/^(\d{1,2})h(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
}

function getStartOfUtcDayTimestamp(nowDate) {
  return Date.UTC(
    nowDate.getUTCFullYear(),
    nowDate.getUTCMonth(),
    nowDate.getUTCDate(),
    0,
    0,
    0,
    0,
  );
}

function getNextOccurrenceUtcTimestamp(nowDate, utcMinutes) {
  let timestampMs = getStartOfUtcDayTimestamp(nowDate) + utcMinutes * MINUTE_MS;
  if (timestampMs < nowDate.getTime()) {
    timestampMs += DAY_MS;
  }

  return timestampMs;
}

function normalizeMinuteOfDay(minutes) {
  return ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

function getHourMinuteParts(minutesOfDay) {
  const normalizedMinutes = normalizeMinuteOfDay(minutesOfDay);
  return {
    hour: Math.floor(normalizedMinutes / 60),
    minute: normalizedMinutes % 60,
  };
}

function formatHourMinuteLabel(minutesOfDay) {
  const { hour, minute } = getHourMinuteParts(minutesOfDay);
  return minute === 0 ?
      `${padTwoDigits(hour)}h`
    : `${padTwoDigits(hour)}h${padTwoDigits(minute)}`;
}

function formatUtcSlotLabel(utcMinutes) {
  return formatHourMinuteLabel(utcMinutes);
}

function getDeviceTimezoneOffsetMinutes() {
  try {
    const timeSensor = new Time();
    const sensorLocalMinutes =
      timeSensor.getHours() * 60 + timeSensor.getMinutes();
    const utcTimestampMs = timeSensor.getTime();

    if (!Number.isFinite(utcTimestampMs)) {
      return -new Date().getTimezoneOffset();
    }

    const utcTotalMinutes = Math.floor(utcTimestampMs / MINUTE_MS);
    const utcMinutes = normalizeMinuteOfDay(utcTotalMinutes);
    let offsetMinutes = sensorLocalMinutes - utcMinutes;

    // Keep the offset in the canonical range [-12h, +12h] to handle day rollover.
    if (offsetMinutes > DAY_MINUTES / 2) {
      offsetMinutes -= DAY_MINUTES;
    } else if (offsetMinutes < -DAY_MINUTES / 2) {
      offsetMinutes += DAY_MINUTES;
    }

    if (Number.isFinite(offsetMinutes)) {
      return offsetMinutes;
    }
  } catch (_error) {
    // Fallback below when sensor is unavailable.
  }

  return -new Date().getTimezoneOffset();
}

function getLocalMinuteFromUtcMinute(utcMinutes, timezoneOffsetMinutes) {
  return normalizeMinuteOfDay(utcMinutes + timezoneOffsetMinutes);
}

function formatLocalSlotLabel(utcMinutes, timezoneOffsetMinutes) {
  return formatHourMinuteLabel(
    getLocalMinuteFromUtcMinute(utcMinutes, timezoneOffsetMinutes),
  );
}

function formatUtcPeakWindow(window) {
  const startLabel = formatUtcSlotLabel(window.startUtcMinutes);
  const endLabel = formatUtcSlotLabel(window.endUtcMinutes);

  return window.startUtcMinutes === window.endUtcMinutes ?
      startLabel
    : `${startLabel}-${endLabel}`;
}

function normalizeTimezoneOffsetMinutes(offsetMinutes) {
  if (!Number.isFinite(offsetMinutes)) {
    return null;
  }

  let normalizedOffsetMinutes = Math.round(offsetMinutes);
  while (normalizedOffsetMinutes > DAY_MINUTES / 2) {
    normalizedOffsetMinutes -= DAY_MINUTES;
  }
  while (normalizedOffsetMinutes < -DAY_MINUTES / 2) {
    normalizedOffsetMinutes += DAY_MINUTES;
  }

  return normalizedOffsetMinutes;
}

function formatModelCountLabel(count) {
  const normalizedCount = Math.max(0, Math.round(Number(count) || 0));
  return normalizedCount <= 1 ?
      `${normalizedCount} modele`
    : `${normalizedCount} modeles`;
}

function formatDurationLabel(durationMs) {
  const totalMinutes = Math.max(0, Math.ceil(durationMs / MINUTE_MS));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes} min`;
  }

  return `${hours}h${padTwoDigits(minutes)}`;
}

function decodeArrayBufferToUtf8(arrayBuffer, byteCount) {
  const bytes = new Uint8Array(arrayBuffer, 0, byteCount);

  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(bytes);
  }

  let text = "";
  for (let index = 0; index < bytes.length; index += 1) {
    text += String.fromCharCode(bytes[index]);
  }

  return text;
}

function stripUtf8Bom(text) {
  if (!text) {
    return text;
  }

  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function readWeatherJsonTextWithReadFile(path) {
  try {
    const utf8Content = readFileSync({
      path,
      options: {
        encoding: "utf8",
      },
    });

    if (typeof utf8Content === "string" && utf8Content) {
      return stripUtf8Bom(utf8Content);
    }

    const binaryContent = readFileSync({
      path,
    });
    if (binaryContent instanceof ArrayBuffer && binaryContent.byteLength > 0) {
      return stripUtf8Bom(
        decodeArrayBufferToUtf8(binaryContent, binaryContent.byteLength),
      );
    }
  } catch (_error) {
    // Path not readable with readFileSync, keep probing.
  }

  return null;
}

function normalizeNumericValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "bigint") {
    const convertedValue = Number(value);
    return Number.isFinite(convertedValue) ? Math.trunc(convertedValue) : null;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);
    if (Number.isFinite(parsedValue)) {
      return Math.trunc(parsedValue);
    }
  }

  return null;
}

function normalizeFileDescriptor(fileDescriptor) {
  const directValue = normalizeNumericValue(fileDescriptor);
  if (directValue !== null) {
    return directValue;
  }

  if (Array.isArray(fileDescriptor)) {
    if (fileDescriptor.length >= 2) {
      const secondValue = normalizeNumericValue(fileDescriptor[1]);
      if (secondValue !== null && secondValue >= 0) {
        return secondValue;
      }
    }

    if (fileDescriptor.length >= 1) {
      const firstValue = normalizeNumericValue(fileDescriptor[0]);
      if (firstValue !== null && firstValue >= 0) {
        return firstValue;
      }
    }
  }

  if (fileDescriptor && typeof fileDescriptor === "object") {
    const explicitDescriptorKeys = [
      "fd",
      "fileDescriptor",
      "file_descriptor",
      "descriptor",
      "handle",
      "result",
      "value",
    ];

    for (let index = 0; index < explicitDescriptorKeys.length; index += 1) {
      const descriptorValue = normalizeNumericValue(
        fileDescriptor[explicitDescriptorKeys[index]],
      );
      if (descriptorValue !== null && descriptorValue >= 0) {
        return descriptorValue;
      }
    }

    const objectKeys = Object.keys(fileDescriptor);
    for (let index = 0; index < objectKeys.length; index += 1) {
      const key = objectKeys[index];
      if (
        key.indexOf("fd") < 0 &&
        key.indexOf("descriptor") < 0 &&
        key.indexOf("handle") < 0
      ) {
        continue;
      }

      const descriptorValue = normalizeNumericValue(fileDescriptor[key]);
      if (descriptorValue !== null && descriptorValue >= 0) {
        return descriptorValue;
      }
    }
  }

  return null;
}

function normalizeReadCount(bytesRead) {
  const directValue = normalizeNumericValue(bytesRead);
  if (directValue !== null) {
    return directValue;
  }

  if (Array.isArray(bytesRead) && bytesRead.length) {
    for (let index = bytesRead.length - 1; index >= 0; index -= 1) {
      const arrayValue = normalizeNumericValue(bytesRead[index]);
      if (arrayValue !== null) {
        return arrayValue;
      }
    }
  }

  return 0;
}

function getAssetSize(path) {
  try {
    const assetStat = statAssetsSync({
      path,
    });

    if (
      assetStat &&
      typeof assetStat.size === "number" &&
      Number.isFinite(assetStat.size) &&
      assetStat.size >= 0
    ) {
      return Math.trunc(assetStat.size);
    }
  } catch (_error) {
    // Keep probing other path candidates.
  }

  return null;
}

function tryOpenAsset(path, withExplicitReadOnlyFlag) {
  try {
    const openResult =
      withExplicitReadOnlyFlag ?
        openAssetsSync({
          path,
          flag: O_RDONLY,
        })
      : openAssetsSync({
          path,
        });

    let fileDescriptor = normalizeFileDescriptor(openResult);
    if (fileDescriptor !== null) {
      return fileDescriptor;
    }

    fileDescriptor = normalizeFileDescriptor(openAssetsSync(path));
    return fileDescriptor;
  } catch (_error) {
    return null;
  }
}

function tryOpenRegularFile(path, withExplicitReadOnlyFlag) {
  try {
    const openResult =
      withExplicitReadOnlyFlag ?
        openSync({
          path,
          flag: O_RDONLY,
        })
      : openSync({
          path,
        });

    let fileDescriptor = normalizeFileDescriptor(openResult);
    if (fileDescriptor !== null) {
      return fileDescriptor;
    }

    fileDescriptor = normalizeFileDescriptor(openSync(path));
    return fileDescriptor;
  } catch (_error) {
    return null;
  }
}

function getLegacyHmFsApi() {
  try {
    if (typeof hmFS !== "undefined" && hmFS) {
      return hmFS;
    }
  } catch (_error) {
    // Global may not exist in this runtime.
  }

  if (typeof globalThis === "object" && globalThis && globalThis.hmFS) {
    return globalThis.hmFS;
  }

  return null;
}

function readWeatherJsonFromLegacyHmFs() {
  const legacyApi = getLegacyHmFsApi();
  if (!legacyApi || typeof legacyApi.open_asset !== "function") {
    return null;
  }

  const errors = [];
  const readOnlyFlag = normalizeNumericValue(legacyApi.O_RDONLY) || 0;

  for (let index = 0; index < WEATHER_JSON_HMFS_PATHS.length; index += 1) {
    const candidatePath = WEATHER_JSON_HMFS_PATHS[index];
    let fileDescriptor = null;

    try {
      const statResult =
        typeof legacyApi.stat_asset === "function" ?
          legacyApi.stat_asset(candidatePath)
        : null;
      let statSize = null;
      let statError = 0;

      if (Array.isArray(statResult)) {
        const statInfo = statResult[0];
        statError = normalizeNumericValue(statResult[1]) || 0;
        if (statInfo && typeof statInfo === "object") {
          statSize = normalizeNumericValue(statInfo.size);
        }
      } else if (statResult && typeof statResult === "object") {
        statSize = normalizeNumericValue(statResult.size);
      }

      if (statError !== 0) {
        errors.push(`${candidatePath}:hmfs_stat_err_${statError}`);
        continue;
      }

      const openResult = legacyApi.open_asset(candidatePath, readOnlyFlag);
      fileDescriptor = normalizeFileDescriptor(openResult);
      if (fileDescriptor === null || fileDescriptor < 0) {
        errors.push(`${candidatePath}:hmfs_open_fail`);
        continue;
      }

      const expectedSize = Number.isFinite(statSize) && statSize > 0 ? statSize : 0;
      if (expectedSize <= 0) {
        errors.push(`${candidatePath}:hmfs_empty`);
        continue;
      }

      const contentBuffer = new ArrayBuffer(expectedSize);
      const readResult = legacyApi.read(fileDescriptor, contentBuffer, 0, expectedSize);
      const normalizedReadCount = normalizeReadCount(readResult);
      const bytesRead =
        normalizedReadCount > 0 ?
          Math.min(normalizedReadCount, expectedSize)
        : normalizedReadCount === 0 ?
          expectedSize
        : 0;

      if (bytesRead <= 0) {
        errors.push(`${candidatePath}:hmfs_read_fail`);
        continue;
      }

      const jsonText = stripUtf8Bom(
        decodeArrayBufferToUtf8(contentBuffer, bytesRead),
      );
      const parsedJson = JSON.parse(jsonText);
      weatherJsonLoadError = "";
      return parsedJson;
    } catch (error) {
      const errorMessage =
        error && typeof error.message === "string" ? error.message : "unknown";
      errors.push(`${candidatePath}:hmfs_fail:${errorMessage}`);
    } finally {
      if (
        legacyApi &&
        typeof legacyApi.close === "function" &&
        Number.isFinite(fileDescriptor) &&
        fileDescriptor >= 0
      ) {
        try {
          legacyApi.close(fileDescriptor);
        } catch (_closeError) {
          // Ignore close errors.
        }
      }
    }
  }

  if (errors.length) {
    weatherJsonLoadError = `${weatherJsonLoadError} | hmFS: ${errors.join(", ")}`;
  }

  return null;
}

function openWeatherJsonAsset() {
  const attempts = [];

  for (let index = 0; index < WEATHER_JSON_ASSET_PATHS.length; index += 1) {
    const candidatePath = WEATHER_JSON_ASSET_PATHS[index];
    const assetSize = getAssetSize(candidatePath);
    let fileDescriptor = tryOpenAsset(candidatePath, true);

    if (fileDescriptor === null || fileDescriptor < 0) {
      fileDescriptor = tryOpenAsset(candidatePath, false);
    }
    if (fileDescriptor === null || fileDescriptor < 0) {
      fileDescriptor = tryOpenRegularFile(candidatePath, true);
    }
    if (fileDescriptor === null || fileDescriptor < 0) {
      fileDescriptor = tryOpenRegularFile(candidatePath, false);
    }

    if (fileDescriptor !== null && fileDescriptor >= 0) {
      weatherJsonLoadError = "";
      return {
        fileDescriptor,
        path: candidatePath,
        size: assetSize,
      };
    }

    attempts.push(
      assetSize === null ?
        `${candidatePath}:fd_fail`
      : `${candidatePath}:size_${assetSize}:fd_fail`,
    );
  }

  weatherJsonLoadError = `open assets fail (${attempts.join(", ") || "no path"})`;
  return null;
}

function readAllBytesFromAssetFile(fileDescriptor, expectedSize = null) {
  if (Number.isFinite(expectedSize) && expectedSize > 0) {
    const targetBuffer = new ArrayBuffer(expectedSize);
    let writeOffset = 0;

    while (writeOffset < expectedSize) {
      const bytesRead = normalizeReadCount(
        readSync({
          fd: fileDescriptor,
          buffer: targetBuffer,
          options: {
            offset: writeOffset,
            length: expectedSize - writeOffset,
          },
        }),
      );

      if (bytesRead <= 0) {
        break;
      }

      writeOffset += bytesRead;
    }

    if (writeOffset > 0) {
      return new Uint8Array(targetBuffer, 0, writeOffset);
    }
  }

  const chunks = [];
  let totalByteLength = 0;

  while (true) {
    const chunkBuffer = new ArrayBuffer(WEATHER_JSON_CHUNK_SIZE);
    const bytesRead = normalizeReadCount(
      readSync({
        fd: fileDescriptor,
        buffer: chunkBuffer,
      }),
    );

    if (bytesRead <= 0) {
      break;
    }

    chunks.push(new Uint8Array(chunkBuffer, 0, bytesRead));
    totalByteLength += bytesRead;

    if (bytesRead < WEATHER_JSON_CHUNK_SIZE) {
      break;
    }
  }

  if (!totalByteLength) {
    return null;
  }

  const mergedBytes = new Uint8Array(totalByteLength);
  let writeOffset = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    mergedBytes.set(chunk, writeOffset);
    writeOffset += chunk.byteLength;
  }

  return mergedBytes;
}

function readWeatherJsonFromAssets() {
  let assetFile = null;
  let fileDescriptor = null;
  const readFileErrors = [];
  try {
    for (let index = 0; index < WEATHER_JSON_ASSET_PATHS.length; index += 1) {
      const candidatePath = WEATHER_JSON_ASSET_PATHS[index];
      const jsonTextFromReadFile = readWeatherJsonTextWithReadFile(candidatePath);
      if (!jsonTextFromReadFile) {
        readFileErrors.push(`${candidatePath}:readfile_fail`);
        continue;
      }

      try {
        const parsedJson = JSON.parse(jsonTextFromReadFile);
        weatherJsonLoadError = "";
        return parsedJson;
      } catch (error) {
        const parseErrorMessage =
          error && typeof error.message === "string" ? error.message : "parse_error";
        readFileErrors.push(`${candidatePath}:json_fail:${parseErrorMessage}`);
      }
    }

    assetFile = openWeatherJsonAsset();
    fileDescriptor = assetFile ? assetFile.fileDescriptor : null;
    if (!Number.isFinite(fileDescriptor) || fileDescriptor < 0) {
      const legacyJsonData = readWeatherJsonFromLegacyHmFs();
      if (legacyJsonData) {
        return legacyJsonData;
      }

      if (readFileErrors.length && weatherJsonLoadError) {
        weatherJsonLoadError = `${weatherJsonLoadError} | readFile: ${readFileErrors.join(", ")}`;
      }
      return null;
    }

    const mergedBytes = readAllBytesFromAssetFile(
      fileDescriptor,
      assetFile ? assetFile.size : null,
    );
    if (!mergedBytes || !mergedBytes.byteLength) {
      weatherJsonLoadError = "empty asset read";
      return null;
    }

    const jsonText = stripUtf8Bom(
      decodeArrayBufferToUtf8(mergedBytes.buffer, mergedBytes.byteLength),
    );

    const parsedJson = JSON.parse(jsonText);
    weatherJsonLoadError = "";
    return parsedJson;
  } catch (error) {
    const readFilePrefix = readFileErrors.length ? `readFile: ${readFileErrors.join(", ")} | ` : "";
    weatherJsonLoadError =
      error && typeof error.message === "string" ?
        `${readFilePrefix}json parse fail: ${error.message}`
      : `${readFilePrefix}json parse fail`;
    return null;
  } finally {
    if (Number.isFinite(fileDescriptor) && fileDescriptor >= 0) {
      closeSync({
        fd: fileDescriptor,
      });
    }
  }
}

function normalizeSlotsFromSummary(summaryByHour) {
  if (!summaryByHour || typeof summaryByHour !== "object") {
    return [];
  }

  return Object.keys(summaryByHour)
    .map((utcLabel) => {
      const utcMinutes = parseUtcHourMinuteLabel(utcLabel);
      if (utcMinutes === null) {
        return null;
      }

      const count = Number(summaryByHour[utcLabel]);
      if (!Number.isFinite(count) || count <= 0) {
        return null;
      }

      return {
        utcMinutes,
        count: Math.round(count),
      };
    })
    .filter((slot) => !!slot)
    .sort((left, right) => left.utcMinutes - right.utcMinutes);
}

function normalizeSlotsFromModels(models) {
  if (!Array.isArray(models)) {
    return [];
  }

  const countsByMinute = {};

  for (let index = 0; index < models.length; index += 1) {
    const modelEntry = models[index];
    if (!modelEntry || typeof modelEntry !== "object") {
      continue;
    }

    const utcMinutes = parseUtcHourMinuteLabel(modelEntry.heure_de_dispo_UTC);
    if (utcMinutes === null) {
      continue;
    }

    countsByMinute[utcMinutes] = (countsByMinute[utcMinutes] || 0) + 1;
  }

  return Object.keys(countsByMinute)
    .map((key) => Number(key))
    .filter((utcMinutes) => Number.isFinite(utcMinutes))
    .sort((left, right) => left - right)
    .map((utcMinutes) => ({
      utcMinutes,
      count: countsByMinute[utcMinutes],
    }));
}

function buildWeatherSlotsUtc(sourceData) {
  const slotsFromSummary = normalizeSlotsFromSummary(
    sourceData && sourceData.resume_par_heure,
  );
  if (slotsFromSummary.length) {
    return slotsFromSummary;
  }

  return normalizeSlotsFromModels(sourceData && sourceData.modeles_meteo);
}

function normalizeWeatherModelEntries(models) {
  if (!Array.isArray(models)) {
    return [];
  }

  const normalizedEntries = [];

  for (let index = 0; index < models.length; index += 1) {
    const modelEntry = models[index];
    if (!modelEntry || typeof modelEntry !== "object") {
      continue;
    }

    const modelName =
      typeof modelEntry.modele === "string" ? modelEntry.modele.trim() : "";
    if (!modelName) {
      continue;
    }

    const utcMinutes = parseUtcHourMinuteLabel(modelEntry.heure_de_dispo_UTC);
    if (utcMinutes === null) {
      continue;
    }

    normalizedEntries.push({
      modelName,
      utcMinutes,
      sourceIndex: index,
    });
  }

  return normalizedEntries;
}

function getUpcomingSlots(nowDate, weatherSlots, maxCount, timezoneOffsetMinutes) {
  return weatherSlots
    .map((slot) => {
      const timestampMs = getNextOccurrenceUtcTimestamp(nowDate, slot.utcMinutes);
      return {
        utcMinutes: slot.utcMinutes,
        count: slot.count,
        timestampMs,
        localLabel: formatLocalSlotLabel(slot.utcMinutes, timezoneOffsetMinutes),
      };
    })
    .sort((left, right) => left.timestampMs - right.timestampMs)
    .slice(0, maxCount);
}

function minutesUntilWindowStart(nowUtcMinutes, startUtcMinutes) {
  return (startUtcMinutes - nowUtcMinutes + DAY_MINUTES) % DAY_MINUTES;
}

function isUtcMinuteInWindow(nowUtcMinutes, window) {
  if (window.startUtcMinutes <= window.endUtcMinutes) {
    return nowUtcMinutes >= window.startUtcMinutes && nowUtcMinutes <= window.endUtcMinutes;
  }

  return nowUtcMinutes >= window.startUtcMinutes || nowUtcMinutes <= window.endUtcMinutes;
}

function getPeakFocus(nowDate) {
  const nowUtcMinutes = nowDate.getUTCHours() * 60 + nowDate.getUTCMinutes();

  for (let index = 0; index < PEAK_WINDOWS_UTC.length; index += 1) {
    const peakWindow = PEAK_WINDOWS_UTC[index];
    if (isUtcMinuteInWindow(nowUtcMinutes, peakWindow)) {
      return {
        window: peakWindow,
        isActive: true,
        minutesUntilStart: 0,
      };
    }
  }

  let nextPeakWindow = PEAK_WINDOWS_UTC[0];
  let minMinutesUntilStart = DAY_MINUTES + 1;

  for (let index = 0; index < PEAK_WINDOWS_UTC.length; index += 1) {
    const peakWindow = PEAK_WINDOWS_UTC[index];
    const minutesUntilStart = minutesUntilWindowStart(
      nowUtcMinutes,
      peakWindow.startUtcMinutes,
    );

    if (minutesUntilStart < minMinutesUntilStart) {
      minMinutesUntilStart = minutesUntilStart;
      nextPeakWindow = peakWindow;
    }
  }

  return {
    window: nextPeakWindow,
    isActive: false,
    minutesUntilStart: minMinutesUntilStart,
  };
}

function formatLocalPeakWindow(window, timezoneOffsetMinutes) {
  const startLabel = formatLocalSlotLabel(window.startUtcMinutes, timezoneOffsetMinutes);
  const endLabel = formatLocalSlotLabel(window.endUtcMinutes, timezoneOffsetMinutes);

  return window.startUtcMinutes === window.endUtcMinutes ?
      startLabel
    : `${startLabel}-${endLabel}`;
}

function formatSecondarySlotText(primarySlot, secondarySlot) {
  if (!secondarySlot) {
    return `Puis ${primarySlot.localLabel} (${formatUtcSlotLabel(primarySlot.utcMinutes)} UTC)`;
  }

  const slotGapMs = secondarySlot.timestampMs - primarySlot.timestampMs;
  if (slotGapMs <= CLOSE_SECONDARY_SLOT_THRESHOLD_MS) {
    return `Puis ${secondarySlot.localLabel} (+${secondarySlot.count})`;
  }

  return `Ensuite ${secondarySlot.localLabel} (${formatUtcSlotLabel(secondarySlot.utcMinutes)} UTC)`;
}

function formatPeakFocusText(peakFocus, timezoneOffsetMinutes) {
  const localWindowLabel = formatLocalPeakWindow(
    peakFocus.window,
    timezoneOffsetMinutes,
  );
  const utcWindowLabel = formatUtcPeakWindow(peakFocus.window);
  const countLabel = formatModelCountLabel(peakFocus.window.modelCount);

  if (peakFocus.isActive) {
    return `Pic en cours ${utcWindowLabel} UTC (${localWindowLabel} local) - ${countLabel} - ${peakFocus.window.emphasis}`;
  }

  return `Pic suivant ${utcWindowLabel} UTC dans ${formatDurationLabel(
    peakFocus.minutesUntilStart * MINUTE_MS,
  )} (${localWindowLabel} local) - ${countLabel} - ${peakFocus.window.emphasis}`;
}

function getNextModelPreview(nowDate, weatherModelEntries, maxCount = 4) {
  if (!Array.isArray(weatherModelEntries) || !weatherModelEntries.length) {
    return {
      names: [],
      hasMore: false,
    };
  }

  const upcomingEntries = weatherModelEntries
    .map((entry) => ({
      ...entry,
      timestampMs: getNextOccurrenceUtcTimestamp(nowDate, entry.utcMinutes),
    }))
    .sort((left, right) => {
      if (left.timestampMs !== right.timestampMs) {
        return left.timestampMs - right.timestampMs;
      }

      return left.sourceIndex - right.sourceIndex;
    });

  const selectedNames = [];
  const seenNames = {};

  for (let index = 0; index < upcomingEntries.length; index += 1) {
    const modelName = upcomingEntries[index].modelName;
    if (seenNames[modelName]) {
      continue;
    }

    seenNames[modelName] = true;
    if (selectedNames.length < maxCount) {
      selectedNames.push(modelName);
      continue;
    }

    return {
      names: selectedNames,
      hasMore: true,
    };
  }

  return {
    names: selectedNames,
    hasMore: false,
  };
}

function formatModelPreviewText(modelPreview) {
  if (!modelPreview || !Array.isArray(modelPreview.names) || !modelPreview.names.length) {
    return "";
  }

  const previewLabel =
    modelPreview.hasMore ?
      `${modelPreview.names.join(", ")}, ...`
    : modelPreview.names.join(", ");

  return ` (${previewLabel})`;
}

let cachedWeatherSlotsUtc = null;
let cachedWeatherModelEntries = null;
let hasAttemptedWeatherLoad = false;

function setWeatherSourceCache(weatherSourceData, loadError = "") {
  cachedWeatherSlotsUtc = buildWeatherSlotsUtc(weatherSourceData);
  cachedWeatherModelEntries = normalizeWeatherModelEntries(
    weatherSourceData && weatherSourceData.modeles_meteo,
  );
  hasAttemptedWeatherLoad = true;
  weatherJsonLoadError = cachedWeatherSlotsUtc.length ? "" : loadError || "source vide";
}

function getWeatherSlotsUtc() {
  if (cachedWeatherSlotsUtc) {
    return cachedWeatherSlotsUtc;
  }

  if (!hasAttemptedWeatherLoad) {
    const weatherSourceData = readWeatherJsonFromAssets();
    setWeatherSourceCache(weatherSourceData, weatherJsonLoadError);
  }

  return cachedWeatherSlotsUtc || [];
}

function getWeatherModelEntries() {
  getWeatherSlotsUtc();
  return cachedWeatherModelEntries || [];
}

export function hasWeatherSlots() {
  return getWeatherSlotsUtc().length > 0;
}

export function getWeatherNavigationDisplay(
  nowDate = new Date(),
  timezoneOffsetMinutes = null,
) {
  const weatherSlotsUtc = getWeatherSlotsUtc();
  const weatherModelEntries = getWeatherModelEntries();
  const normalizedProvidedOffsetMinutes =
    normalizeTimezoneOffsetMinutes(timezoneOffsetMinutes);
  const effectiveTimezoneOffsetMinutes =
    normalizedProvidedOffsetMinutes === null ?
      getDeviceTimezoneOffsetMinutes()
    : normalizedProvidedOffsetMinutes;

  if (!weatherSlotsUtc.length) {
    return {
      rows: [],
      countdownLabel: "Prochaine dispo dans",
      countdownValue: "--",
      nextSlotText: "Donnees meteo indisponibles",
      secondaryText: "Donnees meteo indisponibles",
      peaksText:
        weatherJsonLoadError ?
          `Infos des pics indisponibles (${weatherJsonLoadError})`
        : "Infos des pics indisponibles",
    };
  }

  const upcomingSlots = getUpcomingSlots(
    nowDate,
    weatherSlotsUtc,
    3,
    effectiveTimezoneOffsetMinutes,
  );
  const primarySlot = upcomingSlots[0];
  const secondarySlot = upcomingSlots[1] || null;
  const peakFocus = getPeakFocus(nowDate);
  const modelPreview = getNextModelPreview(nowDate, weatherModelEntries, 4);
  const modelPreviewText = formatModelPreviewText(modelPreview);

  return {
    rows: [],
    countdownLabel: "Prochaine dispo dans",
    countdownValue: formatDurationLabel(primarySlot.timestampMs - nowDate.getTime()),
    nextSlotText: `${formatModelCountLabel(primarySlot.count)} a ${formatUtcSlotLabel(
      primarySlot.utcMinutes,
    )} UTC${modelPreviewText}. ${formatSecondarySlotText(
      primarySlot,
      secondarySlot,
    )}.`,
    secondaryText: `${formatModelCountLabel(primarySlot.count)} a ${formatUtcSlotLabel(
      primarySlot.utcMinutes,
    )} UTC.`,
    peaksText: formatPeakFocusText(peakFocus, effectiveTimezoneOffsetMinutes),
  };
}
