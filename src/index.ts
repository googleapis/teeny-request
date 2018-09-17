'use strict';

import * as r from 'request';
import fetch, * as f from 'node-fetch';
import {PassThrough} from 'stream';
// tslint:disable-next-line variable-name
const HttpsProxyAgent = require('https-proxy-agent');



interface RequestToFetchOptions {
  (reqOpts: r.OptionsWithUri): [string, f.RequestInit];
}

const requestToFetchOptions: RequestToFetchOptions =
    (reqOpts: r.OptionsWithUri) => {
      const options: f.RequestInit = {
        method: reqOpts.method || 'GET',
        ...reqOpts.timeout && {timeout: reqOpts.timeout},
        ...reqOpts.gzip && {compress: reqOpts.gzip},

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
  (err: Error|null, response?: r.Response, body?: {}|string): void;
}

// Mimics `request`. Can be used as `request(options, callback)`
// or `request.defaults(opts)(options, callback)`
interface TeenyRequest {
  (reqOpts: r.OptionsWithUri, callback: Callback): void;
  defaults:
      ((options: r.OptionsWithUri) =>
           ((reqOpts: r.OptionsWithUri, callback: Callback) => void));
}

const teenyRequest =
    ((reqOpts: r.OptionsWithUri, callback?: Callback) => {
      const [uri, options] = requestToFetchOptions(reqOpts);

      // tslint:disable-next-line:no-any
      const multipart: any[] = (reqOpts.multipart as any[]);
      if (reqOpts.multipart && multipart.length === 2) {
        // tslint:disable-next-line:no-any
        (options.headers as any)['Content-Type'] =
            JSON.parse((multipart[0] as {body: string}).body).contentType;

        // tslint:disable-next-line:no-any
        if ((options.headers as any)['Content-Type'] === undefined) {
          // tslint:disable-next-line:no-any
          (options.headers as any)['Content-Type'] =
              (multipart[1] as {'Content-Type': string})['Content-Type'];
        }

        const stream = multipart[1].body;  // Transform
        options.body = stream;

        // Multipart
        fetch(uri as string, options as f.RequestInit)
            .then((res: f.Response) => {
              const header = res.headers.get('content-type');
              if (header === 'application/json' ||
                  header === 'application/json; charset=utf-8') {
                const response = fetchToRequestResponse(res);
                if (response.statusCode === 204) {
                  // Probably a DELETE
                  callback!(null, response, response);
                  return;
                }
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
      }

      if (callback === undefined) {  // Stream mode
        const requestStream: PassThrough = new PassThrough();
        fetch(uri as string, options as f.RequestInit)
            .then((res: f.Response) => {
              if (!res.ok) {
                // tslint:disable-next-line:no-any
                const error: any = new Error(res.statusText);
                error.code = res.status;
                requestStream.emit('error', error);
                return;
              }

              // const isCompressed =
              // headers['content-encoding'] === 'gzip';
              const encoding = res.headers.get('content-type');
              res.body.on('error', err => {
                console.log('whoa there was an error, passing it on' + err);
                requestStream.emit('error', err);
              });

              requestStream.emit('response', res.body);
            })
            .catch((err: Error) => {
              callback!(err);
            });

        // fetch doesn't supply the raw HTTP stream, instead it
        // returns a PassThrough piped from the HTTP response
        // stream
        return requestStream;
      }
      // regular fetch
      fetch(uri as string, options as f.RequestInit)
          .then((res: f.Response) => {
            const header = res.headers.get('content-type');
            if (header === 'application/json' ||
                header === 'application/json; charset=utf-8') {
              const response = fetchToRequestResponse(res);
              if (response.statusCode === 204) {
                // Probably a DELETE
                callback!(null, response, response);
                return;
              }
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
              (err: Error|null, response?: r.Response, body?: {}|string) =>
                  void) => {
    return teenyRequest({...defaults, ...reqOpts}, callback);
  };
};

export {teenyRequest};
