import * as r from 'request';  // Only for type declarations
import fetch, * as f from 'node-fetch';
import {PassThrough} from 'stream';
import * as uuid from 'uuid';

// tslint:disable-next-line variable-name
const HttpsProxyAgent = require('https-proxy-agent');

export class RequestError extends Error {
  code?: number;
}

interface Headers {
  [index: string]: string;
}

/**
 * Convert options from Request to Fetch format
 * @private
 * @param reqOpts Request options
 */
function requestToFetchOptions(reqOpts: r.Options) {
  const options: f.RequestInit = {
    method: reqOpts.method || 'GET',
    ...reqOpts.timeout && {timeout: reqOpts.timeout},
    ...reqOpts.gzip && {compress: reqOpts.gzip},
  };

  if (typeof reqOpts.json === 'object') {
    // Add Content-type: application/json header
    reqOpts.headers = reqOpts.headers || {};
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

  return {uri, options};
}

/**
 * Convert a response from `fetch` to `request` format.
 * @private
 * @param opts The `request` options used to create the request.
 * @param res The Fetch response
 * @returns A `request` response object
 */
function fetchToRequestResponse(opts: r.Options, res: f.Response) {
  const request = res.body as {} as r.Request;
  request.headers = opts.headers || {};
  request.href = res.url;
  // headers need to be converted from a map to an obj
  const headers = {} as Headers;
  res.headers.forEach((value, key) => headers[key] = value);
  return {
    statusCode: res.status,
    statusMessage: res.statusText,
    request,
    body: res.body,
    headers,
  } as r.Response;
}

/**
 * Create POST body from two parts as multipart/related content-type
 * @private
 * @param boundary
 * @param multipart
 */
function createMultipartStream(boundary: string, multipart: r.RequestPart[]) {
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
}

function teenyRequest(reqOpts: r.Options): PassThrough;
function teenyRequest(reqOpts: r.Options, callback: r.RequestCallback): void;
function teenyRequest(
    reqOpts: r.Options, callback?: r.RequestCallback): PassThrough|void {
  const {uri, options} = requestToFetchOptions(reqOpts);

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
    fetch(uri, options)
        .then(
            res => {
              const header = res.headers.get('content-type');
              const response = fetchToRequestResponse(reqOpts, res);
              const body = response.body;
              if (header === 'application/json' ||
                  header === 'application/json; charset=utf-8') {
                res.json().then(
                    json => {
                      response.body = json;
                      callback(null, response, json);
                    },
                    (err: Error) => {
                      callback(err, response, body);
                    });
                return;
              }

              res.text().then(
                  text => {
                    response.body = text;
                    callback(null, response, text);
                  },
                  err => {
                    callback(err, response, body);
                  });
            },
            err => {
              callback(err, null!, null);
            });
    return;
  }

  if (callback === undefined) {  // Stream mode
    const requestStream = new PassThrough();
    options.compress = false;
    fetch(uri, options)
        .then(
            res => {
              if (!res.ok) {
                res.text().then(
                    text => {
                      const error = new RequestError(text);
                      error.code = res.status;
                      requestStream.emit('error', error);
                      return;
                    },
                    error => {
                      requestStream.emit('error', error);
                    });
                return;
              }

              res.body.on('error', err => {
                console.log('whoa there was an error, passing it on: ' + err);
                requestStream.emit('error', err);
              });

              const headers = {} as Headers;
              res.headers.forEach((value, key) => headers[key] = value);

              requestStream.emit('response', {
                headers,
                statusCode: res.status,
                statusMessage: res.statusText,
              });
            },
            err => {
              console.log('such a nice error:' + err);
              requestStream.emit('error', err);
            });

    // fetch doesn't supply the raw HTTP stream, instead it
    // returns a PassThrough piped from the HTTP response
    // stream.
    return requestStream;
  }
  // GET or POST with callback
  fetch(uri, options)
      .then(
          res => {
            const header = res.headers.get('content-type');
            const response = fetchToRequestResponse(reqOpts, res);
            const body = response.body;
            if (header === 'application/json' ||
                header === 'application/json; charset=utf-8') {
              if (response.statusCode === 204) {
                // Probably a DELETE
                callback(null, response, body);
                return;
              }
              res.json().then(
                  json => {
                    response.body = json;
                    callback(null, response, json);
                  },
                  err => {
                    callback(err, response, body);
                  });
              return;
            }

            res.text().then(
                text => {
                  const response = fetchToRequestResponse(reqOpts, res);
                  response.body = text;
                  callback(null, response, text);
                },
                err => {
                  callback(err, response, body);
                });
          },
          err => {
            callback(err, null!, null);
          });
  return;
}

teenyRequest.defaults = (defaults: r.OptionalUriUrl) => {
  return (reqOpts: r.Options, callback?: r.RequestCallback): PassThrough|
      void => {
        const opts = {...defaults, ...reqOpts};
        if (callback === undefined) {
          return teenyRequest(opts);
        }
        teenyRequest(opts, callback);
      };
};

export {teenyRequest};
