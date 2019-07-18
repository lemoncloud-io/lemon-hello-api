/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable camelcase */
/**
 * Express Server Application.
 * - standalone http service with express.
 *
 *
 * ```bash
 * #run-server (use lemon.yml:local)
 * $ npm install -g nodemon
 * $ ENV=lemon STAGE=local nodemon express.js
 * ```
 *
 * @author Steve Jung <steve@lemoncloud.io>
 * @date   2019.JAN.10
 */
// COMMON ENVIRONMENT LOADER

// MAIN EXPRESS BOOT-LOADER.
const NS = 'EXPR';

const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const http = require('http');
const $pack = require('../package.json');
const $env = require('../env/environ')(process);

const app = express();

// app.use(bodyParser.json({limit:'10mb'})); //default limit 100kb
// const WebSocket = require('ws');
const uploader = multer({ dest: '../uploads/' });

//! load configuration.
const handler = require('./index')(global, { env: $env });

//! middle ware
const middle = (req, res, next) => {
  //! prepare event
  const event = {
    queryStringParameters: req.query || {},
    pathParameters: req.params,
    httpMethod: req.method,
    connection: req.connection,
    url: req.url,
    headers: req.headers,
    body: req.body,
  };
  const context = { source: 'express' };
  const callback = (err, data) => {
    if (data.headers) {
      Object.keys(data.headers).map(k => res.setHeader(k, data.headers[k]));
    }
    res.setHeader('Content-Type', 'application/json');
    res.status(data.statusCode || 200)
      .send(data.body);
  };

  //! attach to req.
  req.$event = event;
  req.$context = context;
  req.$callback = callback;

  //! use json parser or multer.
  const method = req.method || '';
  const ctype = (req.headers && req.headers['content-type']) || '';
  // _log(NS, '!',method,':', url,' - ', ctype);

  if (ctype.indexOf('multipart/') >= 0) {
    const parser = uploader.single('file');
    parser(req, res, () => {
      // _inf(NS, '> body =', req.body);
      event.body = req.body || {};
      event.body.file = req.file;
      next();
    });
  } else if (method === 'POST' || method === 'PUT') {
    const parser = bodyParser.json({ limit: '10mb' });
    parser(req, res, () => {
      // _inf(NS, '> body =', req.body);
      event.body = req.body;
      next();
    });
  } else {
    next();
  }
};

/** ********************************************************************************************************************
 *  ROUTE SETTING
 ** ****************************************************************************************************************** */
//! default app.
app.get('', (req, res) => {
  res.status(200).send($pack.name || 'LEMON API');
});

//! handle request to handler.
const handle_hello = (req, res) => handler.hello(req.$event, req.$context, req.$callback, res);

//! WARN - MUST sync with 'serverless.yml'
//! hello
app.get('/hello', middle, handle_hello);
app.get('/hello/:id', middle, handle_hello);
app.get('/hello/:id/:cmd', middle, handle_hello);
app.put('/hello/:id', middle, handle_hello);
app.post('/hello/:id', middle, handle_hello);
app.post('/hello/:id/:cmd', middle, handle_hello);
app.delete('/hello/:id', middle, handle_hello);

// get running parameter like -h api.
function getRunParam(o, defval, argv) {
  // eslint-disable-next-line no-param-reassign
  argv = argv || process.argv || []; // use scope.
  const nm = `-${o}`;
  let i = argv.indexOf(nm);
  i = i > 0 ? i : argv.indexOf(o);
  if (i >= 0) {
    const ret = argv[i + 1];
    //! decode param.
    if (typeof defval === 'boolean') {
      return ret === 'true' || ret === 't' || ret === 'y' || ret === '1';
    } if (typeof defval === 'number') {
      return Math.round(ret / 1);
    }
    return ret;
  }
  return defval;
}

//! finally listen to port.
const createServer = (options = null) => {
  // eslint-disable-next-line no-param-reassign
  options = options || {};
  const server = http.createServer(app);

  //! fetch server post.
  const port = getRunParam('-port', 8081, options.argv);

  //! list port.
  // eslint-disable-next-line no-underscore-dangle
  const _inf = console.log;
  server.listen(port, () => {
    _inf(NS, 'Server Listen on Port =', server.address().port);
  }).on('error', (e) => {
    _inf(NS, '!ERR - listen.err = ', e);
  });

  return server;
};

//! check if this is main
if (typeof require !== 'undefined' && require.main === module) {
  createServer();
}

// export default
module.exports = { createServer, app, express };
