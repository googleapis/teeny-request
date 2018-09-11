'use strict';

import * as r from 'request';
import fetch, * as f from 'node-fetch';
import { PassThrough } from 'stream';
// tslint:disable-next-line variable-name
const HttpsProxyAgent = require('https-proxy-agent');


interface RequestToFetchOptions {
  (reqOpts: r.OptionsWithUri): [string, f.RequestInit];
}

const requestToFetchOptions: RequestToFetchOptions =
  (reqOpts: r.OptionsWithUri) => {
    const options: f.RequestInit = {
      ...reqOpts.method && { method: reqOpts.method },
      ...reqOpts.timeout && { timeout: reqOpts.timeout },
      ...reqOpts.gzip && { compress: reqOpts.gzip },

    };

    if (typeof reqOpts.json === 'object') {
      // Add Content-type: application/json header
      if (!reqOpts.headers) {
        reqOpts.headers = {};
      }
      reqOpts.headers['Content-Type'] = 'application/json';

      // Set body to JSON representation of value
      options.body = JSON.stringify(reqOpts.json);
    } else {
      options.body = JSON.stringify(reqOpts.body);
    }

    options.headers = reqOpts.headers;

    let uri: string = reqOpts.uri as string;
    if (reqOpts.useQuerystring === true || typeof reqOpts.qs === 'object') {
      const qs = require('querystring');
      const params = qs.stringify(reqOpts.qs);
      uri = uri + '?' + params;
    }

    if (reqOpts.proxy || process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
      const proxy = (process.env.HTTP_PROXY || process.env.HTTPS_PROXY)!;
      options.agent = new HttpsProxyAgent(proxy);
    }

    return [uri, options];
  };

interface FetchToRequestResponse {
  (res: f.Response): r.Response;
}
const fetchToRequestResponse = (res: f.Response) => {
  const response: r.Response = {
    statusCode: res.status,
    statusMessage: res.statusText,
  } as r.Response;
  return response;
};


interface Callback {
  (err: Error | null, response?: r.Response, body?: {} | string): void;
}

// Mimics `request`. Can be used as `request(options, callback)`
// or `request.defaults(opts)(options, callback)`
interface TeenyRequest {
  (reqOpts: r.OptionsWithUri, callback: Callback): void;
  defaults:
  ((options: r.OptionsWithUri) =>
    ((reqOpts: r.OptionsWithUri, callback: Callback) => void));
}

const teenyRequest = ((reqOpts: r.OptionsWithUri, callback?: Callback) => {
  const [uri, options] = requestToFetchOptions(reqOpts);

  if (callback === undefined) {
    // Stream mode
    const requestStream: PassThrough = new PassThrough();
    // const dest = fs.createWriteStream('./octocat.png');
    fetch(uri as string, options as f.RequestInit)
      .then((res: f.Response) => {

        return new Promise((resolve, reject) => {
          res.body.pipe(requestStream);
          res.body.on('error', err => {
            console.log('err');

            reject(err);
          });
          requestStream.on('finish', () => {
            console.log('done');
            resolve();
          });
          requestStream.on('error', err => {
            console.log('err');
            reject(err);
          });
        });
      })
      .catch((err: Error) => {
        callback!(err);
      });

    return requestStream;
  }
  fetch(uri as string, options as f.RequestInit)
    .then((res: f.Response) => {
      const header = res.headers.get('content-type');
      if (header === 'application/json' ||
        header === 'application/json; charset=utf-8') {
        const response = fetchToRequestResponse(res);
        res.json()
          .then(json => {
            response.body = json;
            callback!(null, response, json);
          })
          .catch((err: Error) => {
            callback!(err);
          });
        return;
      }

      res.text()
        .then(text => {
          const response = fetchToRequestResponse(res);
          response.body = text;
          callback!(null, response, text);
        })
        .catch(err => {
          callback!(err);
        });
    })
    .catch((err: Error) => {
      callback!(err);
    });
  return;
}) as TeenyRequest;

teenyRequest.defaults = (defaults: r.OptionsWithUri) => {
  return (reqOpts: r.OptionsWithUri,
    callback:
      (err: Error | null, response?: r.Response, body?: {} | string) =>
        void) => {
    return teenyRequest({ ...defaults, ...reqOpts }, callback);
  };
};

export { teenyRequest };
