/**
 * Express Server Application.
 * - standalone http service with express.
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2019-08-09 optimized with `lemon-core#1.0.1`
 * @date        2019-11-06 add `credentials()` for loading profile.
 * @date        2019-11-26 optimized with `lemon-core#2.0.0`
 *
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
/** ****************************************************************************************************************
 *  Override Environ
 ** ****************************************************************************************************************/
//NOTE - 다음이 있어야, Error 발생시 ts파일에서 제대로된 스택 위치를 알려줌!!!.
require('source-map-support').install();
import environ from 'lemon-core/dist/environ';

//! override environment with yml (only for local)
const $env = environ(process);
process.env = $env;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $engine, $U, _log, _inf, _err } from 'lemon-core';
import { $web } from './engine';
const NS = $U.NS('EXPR', 'yellow');

import { buildExpress } from 'lemon-core';
import $core from 'lemon-core';
export const { app, createServer } = buildExpress($engine, $web);

//! dynamic loading credentials by profile. (search PROFILE -> NAME)
export const credentials = async (name?: string) => {
    _log(NS, `credentials(${name})..`);
    const NAME = name || ($engine.environ('NAME', '') as string);
    const profile = $engine.environ('PROFILE', NAME) as string;
    return $core.tools.credentials(profile);
};

//! load yml data via './data/<file>.yml'
export const loadDataYml = (file: string) => {
    _log(NS, `loadDataYml(${name})..`);
    return $core.tools.loadDataYml(file, 'data');
};

//! default exports.
export default { app, createServer };
