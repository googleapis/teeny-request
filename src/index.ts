'use strict';

import * as r from 'request';
import fetch, * as f from 'node-fetch';
import {PassThrough} from 'stream';
// tslint:disable-next-line variable-name
const HttpsProxyAgent = require('https-proxy-agent');

interface RequestToFetchOptions {
  (reqOpts: r.OptionsWithUri): [string, f.RequestInit];
}

interface Headers {
  [index: string]: string;
}

interface FetchToRequestResponse {
  (res: f.Response): r.Response;
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
        if (typeof reqOpts.body !== 'string') {
          options.body = JSON.stringify(reqOpts.body);
        } else {
          options.body = reqOpts.body;
        }
      }

      options.headers = reqOpts.headers as Headers;

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

interface Callback {
  (err: Error|null, response?: r.Response, body?: {}|string): void;
}

const fetchToRequestResponse: FetchToRequestResponse = (res: f.Response) => {
  const response: r.Response = {
    statusCode: res.status,
    statusMessage: res.statusText,
  } as r.Response;
  return response;
};

// Mimics `request`. Can be used as `request(options, callback)`
// or `request.defaults(opts)(options, callback)`
interface TeenyRequest {
  (reqOpts: r.OptionsWithUri, callback: Callback): void;
  defaults:
      ((options: r.OptionsWithUri) =>
           ((reqOpts: r.OptionsWithUri, callback: Callback) => void));
}

// create POST body from two parts as multipart/related content-type
const createMultipartStream =
    (boundary: string, multipart: r.RequestPart[]) => {
      const finale = `--${boundary}--`;
      const stream: PassThrough = new PassThrough();

      for (const part of multipart) {
        const preamble = `--${boundary}\r\nContent-Type: ${
            (part as {['Content-Type']?: string})['Content-Type']}\r\n\r\n`;
        stream.push(preamble);
        if (typeof part.body === 'string') {
          stream.push(part.body);
          stream.push('\r\n');
        } else {
          part.body.pipe(stream, {end: false});
          part.body.on('end', () => {
            stream.push('\r\n');
            stream.push(finale);
            stream.push(null);
          });
        }
      }
      return stream;
    };

const teenyRequest =
    ((reqOpts: r.OptionsWithUri, callback?: Callback) => {
      const [uri, options] = requestToFetchOptions(reqOpts);

      const multipart: r.RequestPart[] = reqOpts.multipart as r.RequestPart[];
      if (reqOpts.multipart && multipart.length === 2) {
        if (!callback) {
          console.log('Error, multipart without callback not implemented.');
          return;
        }
        const boundary = 'someRandomBoundaryString';
        (options.headers as Headers)['Content-Type'] =
            `multipart/related; boundary=${boundary}`;
        options.body = createMultipartStream(boundary, multipart);

        // Multipart upload
        fetch(uri as string, options as f.RequestInit)
            .then((res: f.Response) => {
              const header: string|null = res.headers.get('content-type');
              if (header === 'application/json' ||
                  header === 'application/json; charset=utf-8') {
                const response: r.Response = fetchToRequestResponse(res);
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
        options.compress = false;
        fetch(uri as string, options as f.RequestInit)
            .then((res: f.Response) => {
              if (!res.ok) {
                // tslint:disable-next-line:no-any
                const error: any = new Error(res.statusText);
                error.code = res.status;
                console.log(
                    'whoa there was an error, passing it on: ' + res.statusText);
                requestStream.emit('error', error);
                return;
              }

              const encoding: string|null = res.headers.get('content-encoding');
              res.body.on('error', err => {
                console.log('whoa there was an error, passing it on: ' + err);
                requestStream.emit('error', err);
              });

              // tslint:disable-next-line:no-any
              (res.body as any).toJSON = () => {
                const headers: Headers|
                    {} = {...(encoding && {'content-encoding': encoding})};
                return {headers};
              };

              requestStream.emit('response', res.body);
            })
            .catch((err: Error) => {
              console.log('such a nice error:' + err);
              requestStream.emit('error', err);
            });

        // fetch doesn't supply the raw HTTP stream, instead it
        // returns a PassThrough piped from the HTTP response
        // stream.
        return requestStream;
      }
      // GET or POST with callback
      fetch(uri as string, options as f.RequestInit)
          .then((res: f.Response) => {
            const header: string|null = res.headers.get('content-type');
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
