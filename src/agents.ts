/*!
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Agent as HTTPAgent} from 'http';
import {Agent as HTTPSAgent} from 'https';
import {Options} from './';

const pool = new Map<string, HTTPAgent>();

/**
 * Returns a custom request Agent if one is found, otherwise returns undefined
 * which will result in the global http(s) Agent being used.
 * @private
 * @param {string} uri The request uri
 * @param {object} reqOpts The request options
 * @returns {Agent|undefined}
 */
export function getAgent(uri: string, reqOpts: Options): HTTPAgent | undefined {
  const isHttp = uri.startsWith('http://');
  const proxy =
    reqOpts.proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy;

  let key = isHttp ? 'http' : 'https';

  if (proxy) {
    key += `:proxy:${proxy}`;

    if (!pool.has(key)) {
      // tslint:disable-next-line variable-name
      const Agent = isHttp
        ? require('http-proxy-agent')
        : require('https-proxy-agent');
      pool.set(key, new Agent(proxy) as HTTPAgent);
    }
  } else if (reqOpts.forever) {
    key += ':forever';

    if (!pool.has(key)) {
      // tslint:disable-next-line variable-name
      const Agent = isHttp ? HTTPAgent : HTTPSAgent;
      pool.set(key, new Agent({keepAlive: true}));
    }
  }

  return pool.get(key);
}
