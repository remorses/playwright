# @xmorse/playwright-core

## 1.59.5

- Add `locator.selector()` method that returns the internal selector string identifying a locator. Useful for cache keys, debugging, and any case where you need a stable string representation of a locator's selector chain.

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
