# teeny-request

Like `request`, but much smaller - and with less options. Uses `node-fetch` under the hood. 
Pop it in where you would use `request`. Improves load and parse time of modules. 

```ts
import * from 'teeny-request';

const request = teenyRequest;

request({uri: 'http://www.google.com'}, function (error, response, body) {
  console.log('error:', error); // Print the error if one occurred
  console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
  console.log('body:', body); // Print the JSON for the Google homepage.
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

```ts
request({uri:'http://service.com/upload', method:'POST', json: {key:'value'}}, function(err,httpResponse,body){ /* ... */ })
```

The callback argument gets 3 arguments:

 * An error when applicable (usually from http.ClientRequest object)
 * An response object with statusCode, a statusMessage, and a body
 * The third is the response body (JSON object)



