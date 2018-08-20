'use strict';

import * as r from 'request';
import fetch from 'node-fetch';
import * as f from 'node-fetch';


function requestToFetchOptions(reqOpts: r.OptionsWithUri) {
  const options: f.RequestInit = {
    ...reqOpts.headers && { headers: reqOpts.headers },
    ...reqOpts.method && { method: reqOpts.method },
    ...reqOpts.json && { body: JSON.stringify(reqOpts.json) },
  };

  let uri: string = reqOpts.uri as string;
  if (reqOpts.useQuerystring === true) {
    const qs = require('querystring');
    const params = qs.stringify(reqOpts.qs);
    uri = uri + '?' + params;
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


function teenyRequest(reqOpts: r.OptionsWithUri, callback: any) {
  reqOpts.timeout = reqOpts.timeout || 60000;
  reqOpts.gzip = reqOpts.gzip || true;
  reqOpts.forever = reqOpts.forever || true;
  if (!reqOpts.pool) {
    reqOpts.pool = {};
  }
  reqOpts.pool.maxSockets = reqOpts.pool.maxSockets || Infinity;

  const [uri, options] = requestToFetchOptions(reqOpts);

  fetch(uri as string, options as f.RequestInit)
    .then((res: f.Response) => {
      if (!res.ok) {
        callback(new Error(`${res.status}: ${res.statusText}`));
        return;
      }
      res.json().then(json => {
        let response = fetchToRequestResponse(res);
        response.body = json;
        callback(null, response, json);
      }).catch((err) => {
        callback(err);
      });
    });
}

export { teenyRequest };