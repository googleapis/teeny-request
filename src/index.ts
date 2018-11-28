import * as r from 'request';  // Only for type declarations
import fetch, * as f from 'node-fetch';
import {PassThrough} from 'stream';
import * as uuid from 'uuid';

// tslint:disable-next-line variable-name
const HttpsProxyAgent = require('https-proxy-agent');

interface RequestToFetchOptions {
  (reqOpts: r.Options): [string, f.RequestInit];
}

interface Headers {
  [index: string]: string;
}

interface FetchToRequestResponse {
  (res: f.Response): r.Response;
}

const requestToFetchOptions: RequestToFetchOptions = (reqOpts: r.Options) => {
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

  let uri = ((reqOpts as r.OptionsWithUri).uri ||
             (reqOpts as r.OptionsWithUrl).url) as string;
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
  (reqOpts: r.Options, callback: r.RequestCallback): void;
  (reqOpts: r.Options): PassThrough;
  defaults:
      ((options: r.Options) =>
           ((reqOpts: r.Options, callback?: r.RequestCallback) => void));
}

// create POST body from two parts as multipart/related content-type
const createMultipartStream =
    (boundary: string, multipart: r.RequestPart[]) => {
      const finale = `--${boundary}--`;
      const stream: PassThrough = new PassThrough();

      for (const part of multipart) {
        const preamble = `--${boundary}\r\nContent-Type: ${
            (part as {['Content-Type']?: string})['Content-Type']}\r\n\r\n`;
        stream.write(preamble);
        if (typeof part.body === 'string') {
          stream.write(part.body);
          stream.write('\r\n');
        } else {
          part.body.pipe(stream, {end: false});
          part.body.on('end', () => {
            stream.write('\r\n');
            stream.write(finale);
            stream.end();
          });
        }
      }
      return stream;
    };

const teenyRequest =
    ((reqOpts: r.Options, callback?: r.RequestCallback) => {
      const [uri, options] = requestToFetchOptions(reqOpts);

      const multipart: r.RequestPart[] = reqOpts.multipart as r.RequestPart[];
      if (reqOpts.multipart && multipart.length === 2) {
        if (!callback) {
          console.log('Error, multipart without callback not implemented.');
          return;
        }
        const boundary: string = uuid.v4();
        (options.headers as Headers)['Content-Type'] =
            `multipart/related; boundary=${boundary}`;
        options.body = createMultipartStream(boundary, multipart);

        // Multipart upload
        fetch(uri as string, options as f.RequestInit)
            .then((res: f.Response) => {
              const header: string|null = res.headers.get('content-type');
              const response = fetchToRequestResponse(res);
              const body = response.body;
              if (header === 'application/json' ||
                  header === 'application/json; charset=utf-8') {
                res.json()
                    .then(json => {
                      response.body = json;
                      callback(null, response, json);
                    })
                    .catch((err: Error) => {
                      callback(err, response, body);
                    });
                return;
              }

              res.text()
                  .then(text => {
                    response.body = text;
                    callback(null, response, text);
                  })
                  .catch(err => {
                    callback(err, response, body);
                  });
            })
            .catch((err: Error) => {
              callback(err, null!, null);
            });
        return;
      }

      if (callback === undefined) {  // Stream mode
        const requestStream: PassThrough = new PassThrough();
        options.compress = false;
        fetch(uri as string, options as f.RequestInit)
            .then((res: f.Response) => {
              if (!res.ok) {
                res.text()
                    .then(text => {
                      // tslint:disable-next-line:no-any
                      const error: any = new Error(text);
                      error.code = res.status;
                      requestStream.emit('error', error);
                      return;
                    })
                    .catch(error => {
                      requestStream.emit('error', error);
                    });
                return;
              }

              res.body.on('error', err => {
                console.log('whoa there was an error, passing it on: ' + err);
                requestStream.emit('error', err);
              });

              const headers = Object.assign({}, res.headers.raw());

              requestStream.emit('response', {
                headers,
                statusCode: res.status,
                statusMessage: res.statusText,
              });
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
            const response = fetchToRequestResponse(res);
            const body = response.body;
            if (header === 'application/json' ||
                header === 'application/json; charset=utf-8') {
              if (response.statusCode === 204) {
                // Probably a DELETE
                callback(null, response, body);
                return;
              }
              res.json()
                  .then(json => {
                    response.body = json;
                    callback(null, response, json);
                  })
                  .catch((err: Error) => {
                    callback(err, response, body);
                  });
              return;
            }

            res.text()
                .then(text => {
                  const response = fetchToRequestResponse(res);
                  response.body = text;
                  callback(null, response, text);
                })
                .catch(err => {
                  callback(err, response, body);
                });
          })
          .catch((err: Error) => {
            callback(err, null!, null);
          });
      return;
    }) as TeenyRequest;

teenyRequest.defaults = (defaults: r.Options) => {
  return (reqOpts: r.Options, callback?: r.RequestCallback): PassThrough|
      void => {
        const opts = {...defaults, reqOpts};
        if (callback === undefined) {
          return teenyRequest(opts);
        } else {
          teenyRequest(opts, callback);
        }
      };
};

export {teenyRequest};
