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

// Direct imports instead of bundled - @xmorse/playwright-core fork
import * as yazlLib from 'yazl';
import * as yauzlLib from 'yauzl';

export const yazl = yazlLib;
export const yauzl = yauzlLib;

export type { ZipFile } from 'yazl';
export type { Entry, ZipFile as UnzipFile } from 'yauzl';

// extract-zip is vendored in third_party
const extractZip = require('./third_party/extract-zip');
export const extract: (zipPath: string, opts: { dir: string; defaultDirMode?: number; defaultFileMode?: number; onEntry?: (entry: any, zipfile: any) => void }) => Promise<void> = extractZip;
