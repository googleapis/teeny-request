/*!
 * Copyright 2018 Google LLC. All Rights Reserved.
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

import * as assert from 'assert';
import * as nock from 'nock';
import {Readable} from 'stream';
import * as sinon from 'sinon';
import {teenyRequest} from '../src';

import {PassThrough} from 'stream';

// tslint:disable-next-line variable-name
const HttpsProxyAgent = require('https-proxy-agent');

nock.disableNetConnect();
const uri = 'http://example.com';

function mockJson() {
  return nock(uri)
    .get('/')
    .reply(200, {hello: '🌍'});
}

describe('teeny', () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  it('should get JSON', done => {
    const scope = mockJson();
    teenyRequest({uri}, (error, response, body) => {
      assert.ifError(error);
      assert.strictEqual(response.statusCode, 200);
      assert.ok(body.hello);
      scope.done();
      done();
    });
  });

  it('should set defaults', done => {
    const scope = mockJson();
    const defaultRequest = teenyRequest.defaults({timeout: 60000});
    defaultRequest({uri}, (error, response, body) => {
      assert.ifError(error);
      assert.strictEqual(response.statusCode, 200);
      assert.ok(body.hello);
      scope.done();
      done();
    });
  });

  it('response event emits object compatible with request module', done => {
    const reqHeaders = {fruit: 'banana'};
    const resHeaders = {veggies: 'carrots'};
    const scope = nock(uri)
      .get('/')
      .reply(202, 'ok', resHeaders);
    const reqStream = teenyRequest({uri, headers: reqHeaders});
    reqStream
      .on('response', res => {
        assert.strictEqual(res.statusCode, 202);
        assert.strictEqual(res.headers.veggies, 'carrots');
        assert.deepStrictEqual(res.request.headers, reqHeaders);
        assert.deepStrictEqual(res.toJSON(), {
          headers: resHeaders,
        });
        assert(res instanceof Readable);
        scope.done();
        done();
      })
      .on('error', done);
  });

  it('should include the request in the response', done => {
    const path = '/?dessert=pie';
    const scope = nock(uri)
      .get(path)
      .reply(202);
    const headers = {dinner: 'tacos'};
    const url = `${uri}${path}`;
    teenyRequest({url, headers}, (error, response) => {
      assert.ifError(error);
      const req = response.request;
      assert.deepStrictEqual(req.headers, headers);
      assert.strictEqual(req.href, url);
      scope.done();
      done();
    });
  });

  it('should not wrap the error', done => {
    const scope = nock(uri)
      .get('/')
      .reply(200, '🚨', {'content-type': 'application/json'});
    teenyRequest({uri}, err => {
      assert.ok(err);
      assert.ok(err!.message.match(/^invalid json response body/));
      scope.done();
      done();
    });
  });

  it('should include headers in the response', done => {
    const headers = {dinner: 'tacos'};
    const body = {hello: '🌍'};
    const scope = nock(uri)
      .get('/')
      .reply(200, body, headers);
    teenyRequest({uri}, (err, res) => {
      assert.ifError(err);
      assert.strictEqual(headers['dinner'], res.headers['dinner']);
      scope.done();
      done();
    });
  });

  it('should accept the forever option', done => {
    const scope = nock(uri)
      .get('/')
      .reply(200);
    teenyRequest({uri, forever: true}, (err, res) => {
      assert.ifError(err);
      // tslint:disable-next-line no-any
      assert.strictEqual((res.request.agent as any).keepAlive, true);
      scope.done();
      done();
    });
  });

  it('should respect environment variables for proxy config', () => {
    const envVars = ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY'];
    for (const v of envVars) {
      sandbox.stub(process, 'env').value({[v]: 'https://fake.proxy'});
      const expectedBody = {hello: '🌎'};
      const scope = nock(uri)
        .get('/')
        .reply(200, expectedBody);
      teenyRequest({uri}, (err, res, body) => {
        assert.ifError(err);
        scope.done();
        assert.deepStrictEqual(expectedBody, body);
        assert.ok(res.request.agent instanceof HttpsProxyAgent);
      });
    }
  });

  // see: https://github.com/googleapis/nodejs-storage/issues/798
  it('should not throw exception when piped through pumpify', () => {
    const scope = mockJson();
    teenyRequest({uri}).pipe(new PassThrough());
  });

  it('should emit response event when called without callback', done => {
    const scope = mockJson();
    teenyRequest({uri})
      .on('response', res => {
        assert.ok(res);
        return done();
      })
  });
});
