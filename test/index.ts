import * as assert from 'assert';
import * as nock from 'nock';
import * as r from 'request';

import {teenyRequest} from '../src';

nock.disableNetConnect();
const uri = 'http://example.com';

function mockJson() {
  return nock(uri).get('/').reply(200, {'hello': '🌍'});
}

function nockSuccessfulResponse() {
  return nock('http://example.com').get('/').reply(202, 'ok', {
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
              assert.equal(202, message.statusCode);
              assert.equal(
                  'test-header-value', message.headers['x-example-header']);
              scope.done();
              done();
            })
        .on('error', done);
  });
});
