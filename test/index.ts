
'use strict';

import {teenyRequest} from '../src';
  
import * as assert from 'assert';

describe('teeny', () => {
    it('should get JSON', (done) => {
        teenyRequest({uri: 'http://ip.jsontest.com/'}, function (error: any, response:any, body:any) {
            assert.ifError(error);
            assert.strictEqual(response.statusCode, 200);
            console.log(body.ip);
            assert.notEqual(body.ip, null);
            
            done();
        });
    })
})