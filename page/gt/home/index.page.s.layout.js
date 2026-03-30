import * as hmUI from "@zos/ui";
import { getText } from "@zos/i18n";
import { getDeviceInfo } from "@zos/device";
import { px } from "@zos/utils";

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo();

export const SCREEN_TITLE_STYLE = {
  text: getText("speedTitle"),
  x: px(36),
  y: px(64),
  w: DEVICE_WIDTH - px(72),
  h: px(40),
  color: 0xa9c1c7,
  text_size: px(26),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.NONE,
};

export const SPEED_VALUE_STYLE = {
  text: getText("placeholderSpeed"),
  x: px(24),
  y: px(128),
  w: DEVICE_WIDTH - px(48),
  h: px(136),
  color: 0xffffff,
  text_size: px(128),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.NONE,
};

export const SPEED_UNIT_STYLE = {
  text: getText("speedUnit"),
  x: px(36),
  y: px(278),
  w: DEVICE_WIDTH - px(72),
  h: px(40),
  color: 0x56d8ff,
  text_size: px(28),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.NONE,
};

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
