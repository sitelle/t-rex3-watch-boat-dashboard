import * as hmUI from "@zos/ui";
import { getText } from "@zos/i18n";
import { getDeviceInfo } from "@zos/device";
import { px } from "@zos/utils";

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo();

export const SCREEN_TITLE_STYLE = {
  text: getText("speedTitle"),
  x: px(36),
  y: px(64),
  w: DEVICE_WIDTH - px(144),
  h: px(40),
  color: 0xa9c1c7,
  text_size: px(26),
  align_h: hmUI.align.LEFT,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.NONE,
};

export const SETTINGS_BUTTON_STYLE = {
  x: DEVICE_WIDTH - px(92),
  y: px(58),
  w: px(56),
  h: px(56),
  radius: px(28),
  normal_color: 0x203138,
  press_color: 0x2f4b54,
  text: "⚙",
  color: 0xffffff,
  text_size: px(30),
};

export const METRIC_LABEL_STYLE = {
  text: "",
  x: px(42),
  y: 0,
  w: px(104),
  h: px(40),
  color: 0xa9c1c7,
  text_size: px(24),
  align_h: hmUI.align.LEFT,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.NONE,
};

export const METRIC_VALUE_STYLE = {
  text: "",
  x: px(156),
  y: 0,
  w: DEVICE_WIDTH - px(198),
  h: px(50),
  color: 0xffffff,
  text_size: px(38),
  align_h: hmUI.align.RIGHT,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.NONE,
};

export const TWO_ROW_Y_POSITIONS = [px(166), px(252)];

export const THREE_ROW_Y_POSITIONS = [px(140), px(214), px(288)];

export const STATUS_TEXT_STYLE = {
  text: getText("loadingState"),
  x: px(40),
  y: DEVICE_HEIGHT - px(92),
  w: DEVICE_WIDTH - px(80),
  h: px(40),
  color: 0x7f8c8d,
  text_size: px(24),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.NONE,
};

export const PAGE_INDICATOR_STYLE = {
  text: "1/3",
  x: px(40),
  y: DEVICE_HEIGHT - px(54),
  w: DEVICE_WIDTH - px(80),
  h: px(28),
  color: 0x56d8ff,
  text_size: px(22),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.NONE,
};

export const ADMIN_TITLE_STYLE = {
  text: getText("adminTitle"),
  x: px(40),
  y: px(132),
  w: DEVICE_WIDTH - px(80),
  h: px(36),
  color: 0xffffff,
  text_size: px(28),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.NONE,
};

export const ADMIN_SUBTITLE_STYLE = {
  text: getText("refreshFrequencyLabel"),
  x: px(48),
  y: px(176),
  w: DEVICE_WIDTH - px(96),
  h: px(30),
  color: 0xa9c1c7,
  text_size: px(22),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.NONE,
};

export const ADMIN_URL_LABEL_STYLE = {
  text: getText("signalKUrlLabel"),
  x: px(48),
  y: px(388),
  w: DEVICE_WIDTH - px(96),
  h: px(28),
  color: 0xa9c1c7,
  text_size: px(20),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.NONE,
};

export const ADMIN_URL_BUTTON_STYLE = {
  x: px(64),
  y: px(420),
  w: DEVICE_WIDTH - px(128),
  h: px(42),
  radius: px(12),
  normal_color: 0x162228,
  press_color: 0x203138,
  text: "",
  color: 0xffffff,
  text_size: px(18),
};

export const ADMIN_OPTION_BUTTON_STYLE = {
  x: px(84),
  y: 0,
  w: DEVICE_WIDTH - px(168),
  h: px(56),
  radius: px(14),
  normal_color: 0x203138,
  press_color: 0x2f4b54,
  text: "",
  color: 0xffffff,
  text_size: px(24),
};

export const ADMIN_OPTION_Y_POSITIONS = [px(224), px(294), px(364)];

export const ADMIN_HINT_STYLE = {
  text: getText("adminHint"),
  x: px(44),
  y: DEVICE_HEIGHT - px(44),
  w: DEVICE_WIDTH - px(88),
  h: px(24),
  color: 0x7f8c8d,
  text_size: px(16),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.NONE,
};

export const ADMIN_DEBUG_STYLE = {
  text: "",
  x: px(48),
  y: px(474),
  w: DEVICE_WIDTH - px(96),
  h: px(74),
  color: 0x9db0b5,
  text_size: px(15),
  align_h: hmUI.align.LEFT,
  align_v: hmUI.align.TOP,
  text_style: hmUI.text_style.WRAP,
};
