import * as assert from 'assert';
import * as r from 'request';

import {teenyRequest} from '../src';

describe('teeny', () => {
  it('should get JSON', (done) => {
    teenyRequest(
        {uri: 'https://jsonplaceholder.typicode.com/todos/1'},
        // tslint:disable-next-line:no-any
        (error: Error|null, response?: r.Response, body?: any) => {
          assert.ifError(error);
          assert.strictEqual(response!.statusCode, 200);
          assert.notEqual(body!.userId, null);

          done();
        });
  }), it('should set defaults', (done) => {
    const defaultRequest = teenyRequest.defaults({timeout: 60000} as r.Options);
    defaultRequest(
        {uri: 'https://jsonplaceholder.typicode.com/todos/1'},
        // tslint:disable-next-line:no-any
        (error: Error|null, response?: r.Response, body?: any) => {
          assert.ifError(error);
          assert.strictEqual(response!.statusCode, 200);
          assert.notEqual(body!.userId, null);

          done();
        });
  });
});