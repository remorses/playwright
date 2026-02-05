# @xmorse/playwright-core

## 1.59.1

- Expose `page.targetId()` and `page.sessionId()` for CDP connections (Chromium)
- Expose `frame.frameId()` for all frames
- These IDs are passed through the dispatcher/protocol layer from server to client
- `targetId` and `sessionId` return `undefined` for non-Chromium browsers

## 1.59.0-next

- Initial fork with externalized dependencies for fast local builds
