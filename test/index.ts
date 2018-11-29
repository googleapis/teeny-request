import * as assert from 'assert';
import * as nock from 'nock';
import * as r from 'request';

import {teenyRequest} from '../src';

function nockSuccessfulResponse() {
  return nock('http://www.example.com').get('/').reply(202, 'ok', {
    'X-Example-Header': 'test-header-value',
  });
}

describe('teeny', () => {
  it('should get JSON', (done) => {
    teenyRequest(
        {uri: 'https://jsonplaceholder.typicode.com/todos/1'},
        (error, response, body) => {
          assert.ifError(error);
          assert.strictEqual(response!.statusCode, 200);
          assert.notEqual(body!.userId, null);
          done();
        });
  });

  it('should set defaults', (done) => {
    const defaultRequest = teenyRequest.defaults({timeout: 60000});
    defaultRequest(
        {uri: 'https://jsonplaceholder.typicode.com/todos/1'},
        (error, response, body) => {
          assert.ifError(error);
          assert.strictEqual(response!.statusCode, 200);
          assert.notEqual(body!.userId, null);
          done();
        });
  });

  it('response event emits object compatible with request module', done => {
    const mock = nockSuccessfulResponse();

    const reqStream = teenyRequest({uri: 'http://www.example.com'});
    reqStream
        .on('response',
            (message) => {
              assert.equal(202, message.statusCode);
              assert.equal(
                  'test-header-value', message.headers['x-example-header']);
              assert.ifError(mock.done());
              done();
            })
        .on('error', (err) => {
          done(err);
        });
  });
});
