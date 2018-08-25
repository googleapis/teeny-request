'use strict';

import * as r from 'request';
import fetch from 'node-fetch';
import * as f from 'node-fetch';
// tslint:disable-next-line variable-name
const HttpsProxyAgent = require('https-proxy-agent');

function requestToFetchOptions(reqOpts: r.OptionsWithUri) {

  const options: f.RequestInit = {
    ...reqOpts.headers && { headers: reqOpts.headers },
    ...reqOpts.method && { method: reqOpts.method },
    ...reqOpts.json && { body: JSON.stringify(reqOpts.body) },
    ...reqOpts.timeout && { timeout: reqOpts.timeout },
    ...reqOpts.gzip && { compress: reqOpts.gzip },

  };

  let uri: string = reqOpts.uri as string;
  if (reqOpts.useQuerystring === true) {
    const qs = require('querystring');
    const params = qs.stringify(reqOpts.qs);
    uri = uri + '?' + params;
  }

  if (reqOpts.proxy || process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
    const proxy = (process.env.HTTP_PROXY || process.env.HTTPS_PROXY)!;
    options.agent = new HttpsProxyAgent(proxy);
  }

  return [uri, options];
}

function fetchToRequestResponse(res: f.Response) {
  const response: r.Response = {
    statusCode: res.status,
    statusMessage: res.statusText,
  } as r.Response;
  return response;
}

function teenyRequest(reqOpts: r.OptionsWithUri, callback?: any) {
  const [uri, options] = requestToFetchOptions(reqOpts);
  fetch(uri as string, options as f.RequestInit)
    .then((res: f.Response) => {
      if (!res.ok) {
        callback(new Error(`${res.status}: ${res.statusText}`));
        return;
      }
      let header = res.headers.get('content-type');
      if(header === 'application/json' || header === 'application/json; charset=utf-8') {
        let response = fetchToRequestResponse(res);
        res.json().then(json => {
          response.body = json;
          callback(null, response, json);
        }).catch(err =>{
          callback(err);
        });
        return;
      }

      res.text().then(text => {
        let response = fetchToRequestResponse(res);
          response.body = text;
          callback(null, response, text);

      }).catch(err => {
        callback(err);
      })
    }).catch(err => {
      callback(err);
    });
}

namespace teenyRequest {
  export function defaults(defaults: r.OptionsWithUri) {
    return function (reqOpts: r.OptionsWithUri, callback: any) {
      teenyRequest({ ...defaults, ...reqOpts }, callback);

    };
  }
}

export { teenyRequest };
