# lemoncloud-backbone-js

@version: 0.1.0
@date:    1/10/2019, 11:19:36 PM

Shared Backbone module by [lemoncloud](https://lemoncloud.io)


# Usage

설치하기.

```bash
$ npm install express body-parser
```

express에서 라우터 등록하기. (example for dynamo)

```js
//! handle request to handler.
const handle_dynamo = (req, res) =>     handler.dynamo(req.$event, req.$context, req.$callback);

//! router: dynamo
app.get('/dynamo',                  middle, handle_dynamo);
app.get('/dynamo/:type',            middle, handle_dynamo);
app.get('/dynamo/:type/:id',        middle, handle_dynamo);
app.get('/dynamo/:type/:id/:cmd',   middle, handle_dynamo);
app.put('/dynamo/:type/:id',        middle, handle_dynamo);
app.put('/dynamo/:type/:id/:cmd',   middle, handle_dynamo);
app.post('/dynamo/:type/:id',       middle, handle_dynamo);
app.delete('/dynamo/:type/:id',     middle, handle_dynamo);
```


----------------
# VERSION INFO #

Version History


