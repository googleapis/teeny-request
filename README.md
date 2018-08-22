# teeny-request

Like `request`, but much smaller - and with less options. Uses `node-fetch` under the hood. 
Pop it in where you would use `request`. Improves load and parse time of modules. 

```ts
import {teenyRequest as request} from 'teeny-request';

request({uri: 'http://ip.jsontest.com/'}, function (error, response, body) {
  console.log('error:', error); // Print the error if one occurred
  console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
  console.log('body:', body); // Print the JSON.
});
```

## teenyRequest(options, callback)

Options are limited to the following 

* uri
* method, default GET
* headers
* json
* qs
* useQuerystring
* timeout in ms
* gzip
* proxy

```ts
request({uri:'http://service.com/upload', method:'POST', json: {key:'value'}}, function(err,httpResponse,body){ /* ... */ })
```

The callback argument gets 3 arguments:

 * An error when applicable (usually from http.ClientRequest object)
 * An response object with statusCode, a statusMessage, and a body
 * The third is the response body (JSON object)

## defaults(options)

Set default options for every `teenyRequest` call.

```ts
let defaultRequest = teenyRequest.defaults({timeout: 60000});
      defaultRequest({uri: 'http://ip.jsontest.com/'}, function (error, response, body) {
            assert.ifError(error);
            assert.strictEqual(response.statusCode, 200);
            console.log(body.ip);
            assert.notEqual(body.ip, null);
            
            done();
        });
```        

## Proxy environment variables
If environment variables `HTTP_PROXY` or `HTTPS_PROXY` are set, they are respected. `NO_PROXY` is currently not implemented.

## Thanks
Special thanks to [billyjacobson](https://github.com/billyjacobson) for suggesting the name. Please report all bugs to them. 