/**
 * Express Server Application.
 * - standalone http service with express.
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2024-11-27 initial version with `lemon-core#3.2.10`
 *
 * @copyright (C) lemoncloud.io 2024 - All Rights Reserved. (https://eureka.codes)
 */
/** ****************************************************************************************************************
 *  Override Environ
 ** ****************************************************************************************************************/
//NOTE - 다음이 있어야, Error 발생시 ts파일에서 제대로된 스택 위치를 알려줌!!!.
require('source-map-support').install();
import environ from 'lemon-core/dist/environ';

//* override environment with yml (only for local)
const $env = environ(process);
process.env = $env;

//* load the main cores.
import $cores, { $engine, $U, _log, buildExpress } from 'lemon-core';
const NS = $U.NS('EXPR', 'yellow');

//* build the express engine
import { $web } from './engine';
export const { app, createServer } = buildExpress($engine, $web);

//* dynamic loading credentials by profile. (search PROFILE -> NAME)
export const credentials = async (name?: string) => {
    _log(NS, `credentials(${name})..`);
    const NAME = name || ($engine.environ('NAME', '') as string);
    const profile = $engine.environ('PROFILE', NAME) as string;
    return $cores.tools.asyncCredentials(profile);
};

//* load yml data via './data/<file>.yml'
export const loadDataYml = (file: string) => {
    _log(NS, `loadDataYml(${name})..`);
    return $cores.tools.loadDataYml(file, 'data');
};

//* customize createServer().
const _createServer = () => {
    //NOTE - `app` is ready during default initializer.

    /**
     * echo request information.
     *
     * ```sh
     * $ http POST ':8000/echo?x=y' x-head:1 a=b
     */
    app.post('/echo', (req: any, res: any) => {
        _log(NS, 'echo()...');
        const method = req.method;
        const headers = req.headers;
        const body = req.body;
        const param = req.query;
        param && _log(NS, `> param =`, param);
        body && _log(NS, `> body =`, body);
        res.status(200).json({ method, headers, body, param });
    });

    // create-server....
    return createServer();
};

// default exports.
export default { app, createServer: _createServer };
