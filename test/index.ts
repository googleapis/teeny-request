
'use strict';

import { teenyRequest } from '../src';
import * as assert from 'assert';

describe('teeny', () => {
  it('should get JSON', (done) => {
    teenyRequest({ uri: 'https://jsonplaceholder.typicode.com/todos/1' }, function (error: any, response: any, body: any) {
      assert.ifError(error);
      assert.strictEqual(response.statusCode, 200);
      console.log(body.ip);
      assert.notEqual(body.userId, null);

      done();
    });
  }),
    it('should set defaults', (done) => {
      let defaultRequest = teenyRequest.defaults({ timeout: 60000 } as any);
      defaultRequest({ uri: 'https://jsonplaceholder.typicode.com/todos/1' }, function (error: any, response: any, body: any) {
        assert.ifError(error);
        assert.strictEqual(response.statusCode, 200);
        console.log(body.ip);
        assert.notEqual(body.userId, null);

        done();
      });
    })
});