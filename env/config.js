/**
 * Basic Configuration.
 * - 기본 환경 설정으로, 각 AWS Profile 별로 적용할 serverless custom 환경 설정.
 * - 각 profile별로 주요 변수(특히 환결 설정 파일)를 설정함.
 *
 * 참고: https://velog.io/@doondoony/Serverless-Framework-serverless.yml-%EC%84%A4%EC%A0%95-%EC%A0%95%EB%B3%B4-%EC%88%A8%EA%B8%B0%EA%B8%B0-2hjmsx7nal
 *
 *
 * @param {*} serverless        see `node_modules/serverless/lib/Serverless.js`
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2019-07-19 initial version
 * @date        2019-12-19 optimized for `lemon-core#v2`
 * @date        2022-05-24 optimized for `lemon-core#3.1.1` w/ serverless 3.16
 * @date        2022-08-17 optimized for `nodejs18`
 * @date        2026-10-30 optimized for `nodejs24`
 *
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
const CONF = (serverless) => {
    // console.log('serverless=', serverless);
    console.log('Loading config settings...');
    return {
        none: {
            name: 'none-app',
            runtime: 'nodejs24.x',                              // Node is powered by the V8 JavaScript Engine (used in Chromium)
            region: 'ap-northeast-2',                           // AWS Region to deploy.
            env: 'none.yml',                                    // Environment definitions.
            bucket: '',                                         // Name of S3 bucket. (must be unique across all accounts)
        },
        lemon: {
            name: 'lemon-app',
            runtime: 'nodejs24.x',
            region: 'ap-northeast-2',
            env: 'lemon.yml',                                   // Environment definitions.
            bucket: 'lemon-hello-www',
        },
    };
}

// export as `CONF`
exports = module.exports = { CONF }
