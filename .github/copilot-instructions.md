# xterm.js Copilot Instructions

## Architecture Overview

**Core Structure**: xterm.js is a multi-target terminal emulator with three main distributions:
- `src/browser/`: Full-featured browser terminal with DOM rendering
- `src/headless/`: Server-side terminal for Node.js (no DOM)
- `src/common/`: Shared core logic (parsing, buffer management, terminal state)

**Key Classes**:
- `Terminal` (browser/headless): Public API wrapper
- `CoreTerminal` (common): Core terminal logic and state
- `CoreBrowserTerminal` (browser): Browser-specific terminal implementation

## Development Workflow

**Build System**:
```bash
npm run build && npm run esbuild # Build all TypeScript and bundle
```

**Testing**:
- Unit tests: `npm run test-unit` (Mocha)
- Unit tests filtering to file: `npm run test-unit -- **/fileName.ts
- Per-addon unit tests: `npm run test-unit addons/addon-image/out-esbuild/*.test.js`
- Integration tests: `npm run test-integration` (Playwright across Chrome/Firefox/WebKit)
- Integration tests by file: `npm run test-integration -- test/playwright/InputHandler.test.ts`. Never use grep to filter tests, it doesn't work
- Integration tests by addon: `npm run test-integration --suite=addon-search`. Suites always follow the format `addon-<something>`

## Addon Development Pattern

All addons follow this structure:
```typescript
export class MyAddon implements ITerminalAddon {
  activate(terminal: Terminal): void {
    // Called when loaded via terminal.loadAddon()
    // Register handlers, access terminal APIs
  }
  dispose(): void {
    // Cleanup when addon is disposed
  }
}
```

**Key Examples**:
- `addons/addon-fit/`: Terminal sizing
- `addons/addon-webgl/`: GPU-accelerated rendering
- `addons/addon-search/`: Text search functionality

## Project-Specific Conventions

**TypeScript Project Structure**: Uses TypeScript project references (`tsconfig.all.json`) for incremental builds across browser/headless/addons.

**API Design**: 
- Browser and headless terminals share the same public API
- Proposed APIs require `allowProposedApi: true` option
- Constructor-only options (cols, rows) cannot be changed after instantiation

**Testing Utilities**: Use `TestUtils.ts` helpers:
- `openTerminal(ctx, options)` for setup
- `pollFor(page, fn, expectedValue)` for async assertions
- `writeSync(page, data)` for terminal input

## Common Patterns

**Parser Integration**: Register custom escape sequence handlers:
```typescript
terminal.parser.registerCsiHandler('m', params => {
  // Handle SGR sequences
  return true; // Handled
});
```

**Buffer Access**: Read terminal content via buffer API:
```typescript
const line = terminal.buffer.active.getLine(0);
const cell = line?.getCell(0);
```

**Events**: All terminals emit standard events (onData, onResize, onRender) plus platform-specific ones.

## Critical Implementation Details

- Terminal rendering uses either DOM or WebGL renderers
- Buffer lines are immutable; create new instances for modifications
- Character width handling supports Unicode 11+ and grapheme clustering
- Mouse events translate web events to terminal protocols (X10, VT200, etc.)
- Color theming supports both palette and true color modes

## Writing unit tests

- Unit tests live alongside the source code file of the thing it's testing with a .test.ts suffix.
