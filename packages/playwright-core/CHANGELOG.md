# @xmorse/playwright-core

## 1.59.9

**Ignore duplicate auto-close races for shared JS dialogs** — `Dialog.close()` now treats Chromium's `Protocol error (Page.handleJavaScriptDialog): {"code":-32602,"message":"No dialog is showing"}` as benign. This happens when multiple `connectOverCDP()` clients are attached to the same Playwriter tab and they all auto-dismiss the same alert/confirm/prompt. The first close wins; later best-effort auto-closes no longer crash the process.

## 1.59.8

**Fix CommonJS unzip dependency resolution** — the fork now depends on `get-stream@^5.2.0`, which matches the vendored CommonJS `extract-zip.js` runtime used by `zipBundle`. This fixes `Error [ERR_REQUIRE_ESM]: require() of ES Module ... get-stream ... not supported` on clean installs and Windows CLI startup paths like `npx playwriter serve`.

## 1.59.7

**Security fix** — custom `util.inspect` handler on `ChannelOwner` and channel proxies. Previously `console.log(response)` or auto-returning a Playwright object from a REPL traversed `_connection._platform.env` (= `process.env`) at depth 4 and leaked every environment variable to the terminal, including API keys and secrets. Now Playwright objects render as a concise summary like `Response@response@abc123 { url: '...', status: 200 }`.

See [playwriter#82](https://github.com/remorses/playwriter/issues/82).

## 1.59.6

1. **Descriptive actionability errors** — `TimeoutError` messages now include the specific reason a click failed. Instead of `"Timeout 2000ms exceeded."`, errors say e.g. `"Timeout 2000ms exceeded. Element is not visible — it may be hidden by CSS, inside a collapsed <details>, inactive tab, or closed accordion. Try: interact with the page to reveal it first, or use { force: true } to skip visibility checks"` or `"Timeout 2000ms exceeded. <button name='Submit'> intercepts pointer events"`.
2. **Added `locator.selector()`** — returns the internal selector string for a locator. Useful for cache keys, debugging, or any case where you need a stable string representation of the selector chain.
3. **Added `page.onMouseAction`** — callback invoked before each mouse action (move, down, up, wheel) with a `MouseActionEvent` payload. Useful for intercepting and visualizing pointer activity.
4. **Added `context.getExistingCDPSession(page)`** — reuses Playwright's internal CDP session instead of creating a new one via `Target.attachToTarget`. Critical for relay/proxy environments where `Target.attachToTarget` is intercepted.
5. **Export `MouseActionEvent` type** — now available for TypeScript consumers.

## 1.59.4

- Stop forcing light mode on pages connected via `connectOverCDP`. The default `colorScheme` fallback in `page.emulatedMedia()` changed from `'light'` to `'no-override'`, so the browser's actual system color scheme is preserved instead of being overridden on every page init.

## 1.59.3

- Fix missing runtime dependencies for `lockfile.js`: add `graceful-fs`, `retry`, and `signal-exit` to package.json dependencies
- Fixes "Cannot find module 'graceful-fs'" error on clean `npx playwriter` installs (GitHub #45)

## 1.59.2

- Add `context.getExistingCDPSession(page)` API that reuses Playwright's internal CDP session instead of creating a new one via `Target.attachToTarget`
- New `CDPSession.fromExistingSession()` static factory and `CDPSessionBorrowed` subclass for wrapping existing CRSessions without ownership
- Borrowed sessions have no-op `detach()` since Playwright's page lifecycle owns the underlying session
- Critical for relay/proxy environments (like playwriter) where `Target.attachToTarget` is intercepted and cannot create real new sessions
- Added protocol schema, channel types, dispatcher, and client-side method
- Added public TypeScript types with JSDoc documentation

## 1.59.1

- Expose `page.targetId()` and `page.sessionId()` for CDP connections (Chromium)
- Expose `frame.frameId()` for all frames
- These IDs are passed through the dispatcher/protocol layer from server to client
- `targetId` and `sessionId` return `undefined` for non-Chromium browsers

## 1.59.0-next

- Initial fork with externalized dependencies for fast local builds
