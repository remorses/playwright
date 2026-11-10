/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Recorder } from './recorder';

import type { InjectedScript } from '../injectedScript';
import type { RecorderDelegate } from './recorder';
import type * as actions from '@isomorphic/codegen/actions';
import type { ElementInfo, Mode, OverlayState, UIState } from '@recorder/recorderTypes';

interface Embedder {
  __pw_recorderPerformAction(action: actions.PerformableAction): Promise<void>;
  __pw_recorderRecordAction(action: actions.Action, preconditionSelector?: string): Promise<void>;
  __pw_recorderState(): Promise<UIState>;
  __pw_recorderElementPicked(element: { selector: string, ariaSnapshot?: string }): Promise<void>;
  __pw_recorderSetMode(mode: Mode): Promise<void>;
  __pw_recorderSetOverlayState(state: OverlayState): Promise<void>;
  __pw_refreshOverlay(): void;
}

declare global {
  interface Document {
    __pwPollingRecorder?: PollingRecorder;
  }
}

export class PollingRecorder implements RecorderDelegate {
  // Assigned unless the constructor returns an existing instance.
  private _recorder!: Recorder;
  private _embedder!: Embedder;
  private _pollRecorderModeTimer: number | undefined;
  private _lastStateJSON: string | undefined;

  constructor(injectedScript: InjectedScript, options?: { recorderMode?: 'default' | 'api', hideToolbar?: boolean }) {
    // Playwriter: extendInjectedScript can run again on the same InjectedScript (bfcache
    // restore, new-document event after goBack). A second instance would add another
    // listener set and record every click and key twice.
    const existing = injectedScript._pollingRecorder;
    if (existing)
      return existing;

    // Playwriter: each connectOverCDP client creates its own InjectedScript in the same
    // MAIN-world document, so also dedupe per document. The recorder is only extended in
    // the MAIN world, so the document expando is shared by all clients. A new document
    // gets a new flag and new listeners.
    const doc = injectedScript.document;
    if (doc.__pwPollingRecorder) {
      injectedScript._pollingRecorder = doc.__pwPollingRecorder;
      return doc.__pwPollingRecorder;
    }

    this._recorder = new Recorder(injectedScript, options);
    this._embedder = injectedScript.window as any;
    injectedScript._pollingRecorder = this;
    doc.__pwPollingRecorder = this;

    injectedScript.onGlobalListenersRemoved.add(() => this._recorder.installListeners());

    const refreshOverlay = () => {
      this._lastStateJSON = undefined;
      this._pollRecorderMode().catch(e => console.log(e)); // eslint-disable-line no-console
    };
    this._embedder.__pw_refreshOverlay = refreshOverlay;
    refreshOverlay();
  }

  private async _pollRecorderMode() {
    const pollPeriod = 1000;
    if (this._pollRecorderModeTimer)
      this._recorder.injectedScript.utils.builtins.clearTimeout(this._pollRecorderModeTimer);
    const state = await this._embedder.__pw_recorderState().catch(() => null);
    if (!state) {
      this._pollRecorderModeTimer = this._recorder.injectedScript.utils.builtins.setTimeout(() => this._pollRecorderMode(), pollPeriod);
      return;
    }

    const stringifiedState = JSON.stringify(state);
    if (this._lastStateJSON !== stringifiedState) {
      this._lastStateJSON = stringifiedState;
      const win = this._recorder.document.defaultView!;
      if (win.top !== win) {
        // Only show action point in the main frame, since it is relative to the page's viewport.
        // Otherwise we'll see multiple action points at different locations.
        state.actionPoint = undefined;
      }
      this._recorder.setUIState(state, this);
    }

    this._pollRecorderModeTimer = this._recorder.injectedScript.utils.builtins.setTimeout(() => this._pollRecorderMode(), pollPeriod);
  }

  async performAction(action: actions.PerformableAction) {
    await this._embedder.__pw_recorderPerformAction(action);
  }

  async recordAction(action: actions.Action, preconditionSelector?: string): Promise<void> {
    await this._embedder.__pw_recorderRecordAction(action, preconditionSelector);
  }

  async elementPicked(elementInfo: ElementInfo): Promise<void> {
    await this._embedder.__pw_recorderElementPicked(elementInfo);
  }

  async setMode(mode: Mode): Promise<void> {
    await this._embedder.__pw_recorderSetMode(mode);
  }

  async setOverlayState(state: OverlayState): Promise<void> {
    await this._embedder.__pw_recorderSetOverlayState(state);
  }
}

export default PollingRecorder;
