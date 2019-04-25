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
////////////////////////////////////////////////////////////////////////
// COMMON ENVIRONMENT LOADER
const $env = require('./env/environ')(process);
const package = require('./package.json');

////////////////////////////////////////////////////////////////////////
// MAIN EXPRESS BOOT-LOADER.
const NS = 'EXPR';

const debug = require('debug')(package.name||'lemon-express');
const express = require('express');
const http = require('http');
const url = require('url');
const bodyParser = require('body-parser');
const multer = require('multer');

const app = express();
const server = http.createServer(app);

// app.use(bodyParser.json({limit:'10mb'})); //default limit 100kb
// const WebSocket = require('ws');
const uploader = multer({dest: '../uploads/'});

//! load configuration.
const handler = require($env.SRC+'index')(global, {env: $env});

//! middle ware
const middle = (req, res, next) => {
    //! prepare event
    const event = {
        queryStringParameters : req.query||{},
        pathParameters : req.params,
        httpMethod: req.method,
        connection: req.connection,
        url: req.url,
        headers: req.headers,
        body: req.body
    }
    const context = {source:'express'};
    const callback = (err, data) => {
        if (data.headers){
            Object.keys(data.headers).map(k => {
                res.setHeader(k, data.headers[k]);
            })
        }
        const body = data.body||'';
        res.setHeader('Content-Type', 'application/json');
        res.status(data.statusCode||200)
            .send(data.body);
    }

    //! attach to req.
    req.$event = event;
    req.$context = context;
    req.$callback = callback;

    //! use json parser or multer.
    const method = req.method||'';
    const url   = req.url||'';
    const ctype = req.headers && req.headers['content-type']||'';
    // _log(NS, '!',method,':', url,' - ', ctype);

    if (ctype.indexOf('multipart/') >= 0){
        const parser = uploader.single('file');
        parser(req, res, ()=>{
            // _inf(NS, '> body =', req.body);
            event.body = req.body||{};
            event.body.file = req.file;
            next();
        })
    } else if (method == 'POST' || method == 'PUT'){
        const parser = bodyParser.json({limit:'10mb'});
        parser(req, res, ()=>{
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
 ** *******************************************************************************************************************/
//! default app.
app.get('', (req, res)=>{
    res.status(200).send(package.name||'LEMON API');
});

//! handle request to handler.
const handle_hello = (req, res) =>     handler.hello(req.$event, req.$context, req.$callback);

//! WARN - MUST sync with 'serverless.yml'
//! hello
app.get('/hello',                   middle, handle_hello);
app.get('/hello/:id',               middle, handle_hello);
app.get('/hello/:id/:cmd',          middle, handle_hello);
app.put('/hello/:id',               middle, handle_hello);
app.post('/hello/:id',              middle, handle_hello);
app.post('/hello/:id/:cmd',         middle, handle_hello);
app.delete('/hello/:id',            middle, handle_hello);


/** ********************************************************************************************************************
 *  SERVER LISTEN
 ** *******************************************************************************************************************/
//! finally listen to port.
if (server)
{
    //! fetch server post.
    const port = _get_run_param('-port', 8081);

    //! list port.
    server.listen(port, function listening() {
        _inf(NS, 'Server Listen on Port =', server.address().port);
    }).on('error', function(e){
        _err(NS, '!ERR - listen.err = ', e);
    })

	// get running parameter like -h api.
	function _get_run_param(o, defval){
		var argv = process.argv || [];		// use scope.
		var nm = '-'+o;
		var i = argv.indexOf(nm);
		i = i > 0 ? i : argv.indexOf(o);
		if (i >= 0) {
			var ret = argv[i+1];
			//! decode param.
			if (typeof defval === 'boolean'){
				return ret === 'true' || ret === 't' || ret === 'y' || ret === '1';
			} else if (typeof defval === 'number'){
				return parseInt(ret);
			} else {
                return ret;
			}
		}
		return defval;
	}
}
