import {Agent} from 'https';
import fetch, * as f from 'node-fetch';
import {PassThrough, Readable, Duplex} from 'stream';
import * as uuid from 'uuid';

export interface CoreOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'HEAD' | 'OPTIONS';
  timeout?: number;
  gzip?: boolean;
  // tslint:disable-next-line no-any
  json?: any;
  headers?: Headers;
  body?: string | {};
  useQuerystring?: boolean;
  // tslint:disable-next-line no-any
  qs?: any;
  proxy?: string;
  multipart?: RequestPart[];
  forever?: boolean;
}

export interface OptionsWithUri extends CoreOptions {
  uri: string;
}

export interface OptionsWithUrl extends CoreOptions {
  url: string;
}

export type Options = OptionsWithUri | OptionsWithUrl;

export interface Request extends Duplex {
  headers: Headers;
  href?: string;
}

// tslint:disable-next-line no-any
export interface Response<T = any> {
  statusCode: number;
  headers: Headers;
  body: T;
  request: Request;
  statusMessage?: string;
}

export interface RequestPart {
  body: string | Readable;
}

// tslint:disable-next-line no-any
export interface RequestCallback<T = any> {
  (err: Error | null, response: Response, body?: T): void;
}

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
function requestToFetchOptions(reqOpts: Options) {
  const options: f.RequestInit = {
    method: reqOpts.method || 'GET',
    ...(reqOpts.timeout && {timeout: reqOpts.timeout}),
    ...(reqOpts.gzip && {compress: reqOpts.gzip}),
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

  let uri = ((reqOpts as OptionsWithUri).uri ||
    (reqOpts as OptionsWithUrl).url) as string;
  if (reqOpts.useQuerystring === true || typeof reqOpts.qs === 'object') {
    const qs = require('querystring');
    const params = qs.stringify(reqOpts.qs);
    uri = uri + '?' + params;
  }

  if (reqOpts.proxy || process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
    const proxy = (process.env.HTTP_PROXY || process.env.HTTPS_PROXY)!;
    options.agent = new HttpsProxyAgent(proxy);
  } else if (reqOpts.forever) {
    options.agent = new Agent({keepAlive: true});
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
function fetchToRequestResponse(opts: Options, res: f.Response) {
  const request = {} as Request;
  request.headers = opts.headers || {};
  request.href = res.url;
  // headers need to be converted from a map to an obj
  const resHeaders = {} as Headers;
  res.headers.forEach((value, key) => (resHeaders[key] = value));

  const response = Object.assign(res.body, {
    statusCode: res.status,
    statusMessage: res.statusText,
    request,
    body: res.body,
    headers: resHeaders,
    toJSON: () => ({headers: resHeaders}),
  });

  return response as Response;
}

/**
 * Create POST body from two parts as multipart/related content-type
 * @private
 * @param boundary
 * @param multipart
 */
function createMultipartStream(boundary: string, multipart: RequestPart[]) {
  const finale = `--${boundary}--`;
  const stream: PassThrough = new PassThrough();

  for (const part of multipart) {
    const preamble = `--${boundary}\r\nContent-Type: ${
      (part as {['Content-Type']?: string})['Content-Type']
    }\r\n\r\n`;
    stream.write(preamble);
    if (typeof part.body === 'string') {
      stream.write(part.body);
      stream.write('\r\n');
    } else {
      part.body.pipe(
        stream,
        {end: false}
      );
      part.body.on('end', () => {
        stream.write('\r\n');
        stream.write(finale);
        stream.end();
      });
    }
  }
  return stream;
}

function teenyRequest(reqOpts: Options): Request;
function teenyRequest(reqOpts: Options, callback: RequestCallback): void;
function teenyRequest(
  reqOpts: Options,
  callback?: RequestCallback
): Request | void {
  const {uri, options} = requestToFetchOptions(reqOpts);

  const multipart = reqOpts.multipart as RequestPart[];
  if (reqOpts.multipart && multipart.length === 2) {
    if (!callback) {
      console.log('Error, multipart without callback not implemented.');
      return;
    }
    const boundary: string = uuid.v4();
    (options.headers as Headers)[
      'Content-Type'
    ] = `multipart/related; boundary=${boundary}`;
    options.body = createMultipartStream(boundary, multipart);

    // Multipart upload
    fetch(uri, options).then(
      res => {
        const header = res.headers.get('content-type');
        const response = fetchToRequestResponse(reqOpts, res);
        const body = response.body;
        if (
          header === 'application/json' ||
          header === 'application/json; charset=utf-8'
        ) {
          res.json().then(
            json => {
              response.body = json;
              callback(null, response, json);
            },
            (err: Error) => {
              callback(err, response, body);
            }
          );
          return;
        }

        res.text().then(
          text => {
            response.body = text;
            callback(null, response, text);
          },
          err => {
            callback(err, response, body);
          }
        );
      },
      err => {
        callback(err, null!, null);
      }
    );
    return;
  }

  if (callback === undefined) {
    // Stream mode
    const requestStream = new Duplex();
    options.compress = false;
    fetch(uri, options).then(
      res => {
        res.body.on('error', err => {
          console.log('whoa there was an error, passing it on: ' + err);
          requestStream.emit('error', err);
        });

        const response = fetchToRequestResponse(reqOpts, res);
        requestStream.emit('response', response);
      },
      err => {
        console.log('such a nice error:' + err);
        requestStream.emit('error', err);
      }
    );

    // fetch doesn't supply the raw HTTP stream, instead it
    // returns a PassThrough piped from the HTTP response
    // stream.
    return requestStream as Request;
  }
  // GET or POST with callback
  fetch(uri, options).then(
    res => {
      const header = res.headers.get('content-type');
      const response = fetchToRequestResponse(reqOpts, res);
      const body = response.body;
      if (
        header === 'application/json' ||
        header === 'application/json; charset=utf-8'
      ) {
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
          }
        );
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
        }
      );
    },
    err => {
      callback(err, null!, null);
    }
  );
  return;
}

teenyRequest.defaults = (defaults: CoreOptions) => {
  return (reqOpts: Options, callback?: RequestCallback): Request | void => {
    const opts = {...defaults, ...reqOpts};
    if (callback === undefined) {
      return teenyRequest(opts);
    }
    teenyRequest(opts, callback);
  };
};

export {teenyRequest};
