import * as assert from 'assert';
import * as nock from 'nock';
import * as request from 'request';
import { Readable } from 'stream';

import { teenyRequest } from '../src';

nock.disableNetConnect();
const uri = 'http://example.com';

function mockJson() {
  return nock(uri)
    .get('/')
    .reply(200, { hello: '🌍' });
}

describe('teeny', () => {
  it('should get JSON', done => {
    const scope = mockJson();
    teenyRequest({ uri }, (error, response, body) => {
      assert.ifError(error);
      assert.strictEqual(response.statusCode, 200);
      assert.ok(body.hello);
      scope.done();
      done();
    });
  });

  it('should set defaults', done => {
    const scope = mockJson();
    const defaultRequest = teenyRequest.defaults({ timeout: 60000 });
    defaultRequest({ uri }, (error, response, body) => {
      assert.ifError(error);
      assert.strictEqual(response.statusCode, 200);
      assert.ok(body.hello);
      scope.done();
      done();
    });
  });

  it('response event emits object compatible with request module', done => {
    const reqHeaders = { fruit: 'banana' };
    const resHeaders = { veggies: 'carrots' };
    const scope = nock(uri)
      .get('/')
      .reply(202, 'ok', resHeaders);
    const reqStream = teenyRequest({ uri, headers: reqHeaders });
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
    const headers = { dinner: 'tacos' };
    const url = `${uri}${path}`;
    teenyRequest({ url, headers }, (error, response) => {
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
      .reply(200, '🚨', { 'content-type': 'application/json' });
    teenyRequest({ uri }, err => {
      assert.ok(err);
      assert.ok(err.message.match(/^invalid json response body/));
      scope.done();
      done();
    });
  });

  it('should include headers in the response', done => {
    const headers = { dinner: 'tacos' };
    const body = { hello: '🌍' };
    const scope = nock(uri)
      .get('/')
      .reply(200, body, headers);
    teenyRequest({ uri }, (err, res) => {
      assert.ifError(err);
      assert.strictEqual(headers['dinner'], res.headers['dinner']);
      scope.done();
      done();
    });
  });

  it('should be castable to `Request`', () => {
    const r = teenyRequest as typeof request;
    assert.ok(r);
  });
});
