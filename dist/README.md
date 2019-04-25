# lemoncloud-backbone-js

@version: 1.0.0
@date:    4/25/2019, 3:20:13 PM

Shared Backbone module by [lemoncloud](https://lemoncloud.io)


# Usage

설치하기.

```bash
$ npm install express body-parser
```

express에서 라우터 등록하기. (example for `hello`)

```js
//! handle request to handler.
const handle_hello = (req, res) =>     handler.hello(req.$event, req.$context, req.$callback);

//! router: hello
app.get('/hello',                   middle, handle_hello);
app.get('/hello/:id',               middle, handle_hello);
app.get('/hello/:id/:cmd',          middle, handle_hello);
app.put('/hello/:id',               middle, handle_hello);
app.post('/hello/:id',              middle, handle_hello);
app.post('/hello/:id/:cmd',         middle, handle_hello);
app.delete('/hello/:id',            middle, handle_hello);
```


----------------
# VERSION INFO #

Version History

| Version   | Description
|--         |--
| 1.0.0     | initial version with full deploy by profile+stage
