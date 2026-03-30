# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Zepp OS application for smartwatches (Amazfit/Zepp devices). Zepp OS uses a custom JavaScript framework with APIs from the `@zos` namespace. The project uses Zeus CLI for building, development, and deployment.

## Key Commands

### Development
```bash
zeus dev              # Start development mode with hot reload
zeus preview          # Preview app on connected device or simulator
zeus build            # Build for production (outputs to dist/)
zeus bridge           # Connect to online App or Simulator for debugging
```

### Device Management
```bash
zeus status           # Check login status and device connections
zeus login            # Authenticate with Zepp platform
```

### Setup (if needed)
```bash
npm install -g @zeppos/zeus-cli    # Install Zeus CLI globally
npm install                         # Install project dependencies
```

## Architecture

### Application Structure

Zepp OS apps follow a specific file organization pattern:

**app.js**: Application lifecycle entry point with `App()` constructor containing `onCreate()` and `onDestroy()` hooks.

**app.json**: Central configuration file defining:
- App metadata (appId, appName, version)
- Permissions (device info, local storage, etc.)
- Runtime API version (currently 4.0)
- Target devices and platforms (gt = general type watches)
- i18n configuration with language mappings

**page/**: Contains page modules organized by device type:
- `page/gt/home/`: Main page for "gt" (general type) devices
- Each page has multiple files:
  - `index.page.js`: Page logic and widget creation
  - `index.page.r.layout.js`: Layout for round screens
  - `index.page.s.layout.js`: Layout for square screens
  - Layouts export style constants imported via `zosLoader:` protocol

**page/i18n/**: Translation files in .po format (msgid/msgstr pairs)

**utils/**: Shared utilities across the app

**assets/**: Device-specific assets organized by type (gt.r for round, gt.s for square)

### Key APIs

**@zos/ui**: UI widget creation (`hmUI.createWidget()`, widget types like `hmUI.widget.TEXT`)

**@zos/i18n**: Internationalization (`getText()` for translations)

**@zos/device**: Device info (`getDeviceInfo()` for screen dimensions)

**@zos/utils**: Utilities including `px()` for pixel conversion and logging (`log.getLogger()`)

### Page Lifecycle

Pages use the `Page()` constructor with lifecycle methods:
1. `onInit()`: Initialization before UI build
2. `build()`: Create widgets and UI elements
3. `onDestroy()`: Cleanup when page closes

### Layout System

Zepp OS uses a layout separation pattern:
- Main page logic (`index.page.js`) imports layout constants
- Layout files (`.r.layout.js`, `.s.layout.js`) define device-specific styles
- The `zosLoader:` protocol dynamically loads the correct layout based on platform (`[pf]` placeholder)
- This allows single codebase to support multiple screen shapes

### Widget System

Widgets are created imperatively with style objects:
```javascript
hmUI.createWidget(hmUI.widget.TEXT, {
  text: "Hello",
  x: px(42),
  y: px(200),
  w: DEVICE_WIDTH - px(42) * 2,
  h: px(100),
  color: 0xffffff,
  text_size: px(36),
  align_h: hmUI.align.CENTER_H,
  text_style: hmUI.text_style.WRAP
});
```

Note: Always use `px()` for dimension values to handle different screen densities.

## Configuration Notes

- **designWidth** in app.json (480 for gt devices) is the reference width for `px()` calculations
- **platforms** array defines screen types: `{st: "r"}` = round, `{st: "s"}` = square
- TypeScript definitions available via `@zeppos/device-types` package
- jsconfig.json enables type checking for JavaScript files

## Important Conventions

- App IDs must be unique (currently 24767)
- API version compatibility: app.json specifies compatible/target/minVersion
- Permissions must be declared in app.json before using related APIs
- Logger instances should be created per module: `log.getLogger("module-name")`
