import * as assert from 'assert';
import * as nock from 'nock';
import * as request from 'request';
import {teenyRequest} from '../src';

nock.disableNetConnect();
const uri = 'http://example.com';

function mockJson() {
  return nock(uri).get('/').reply(200, {'hello': '🌍'});
}

function nockSuccessfulResponse() {
  return nock(uri).get('/').reply(202, 'ok', {
    'X-Example-Header': 'test-header-value',
  });
}

describe('teeny', () => {
  it('should get JSON', (done) => {
    const scope = mockJson();
    teenyRequest({uri}, (error, response, body) => {
      assert.ifError(error);
      assert.strictEqual(response.statusCode, 200);
      assert.ok(body.hello);
      scope.done();
      done();
    });
  });

  it('should set defaults', (done) => {
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
    const scope = nockSuccessfulResponse();
    const reqStream = teenyRequest({uri});
    reqStream
        .on('response',
            message => {
              assert.strictEqual(202, message.statusCode);
              assert.strictEqual(
                  'test-header-value', message.headers['x-example-header']);
              scope.done();
              done();
            })
        .on('error', done);
  });

  it('should include the request in the response', (done) => {
    const path = '/?dessert=pie';
    const scope = nock(uri).get(path).reply(202);
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

  it('should not wrap the error', (done) => {
    const scope = nock(uri).get('/').reply(
        200, '🚨', {'content-type': 'application/json'});
    teenyRequest({uri}, err => {
      assert.ok(err);
      assert.ok(err.message.match(/^invalid json response body/));
      scope.done();
      done();
    });
  });

  it('should include headers in the response', (done) => {
    const headers = {dinner: 'tacos'};
    const body = {'hello': '🌍'};
    const scope = nock(uri).get('/').reply(200, body, headers);
    teenyRequest({uri}, (err, res) => {
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
