/**
 * Basic Configuration.
 * - Before using thie, make credentials for your AWS Profile.
 * - customize the basic custom config for `serverless.yml`
 *
 * 참고: https://velog.io/@doondoony/Serverless-Framework-serverless.yml-%EC%84%A4%EC%A0%95-%EC%A0%95%EB%B3%B4-%EC%88%A8%EA%B8%B0%EA%B8%B0-2hjmsx7nal
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2019-07-19 initial version
 * @date        2020-07-15 cleanup messages
 *
 * @copyright (C) lemoncloud.io 2020 - All Rights Reserved.
 */
const CONF = (serverless) => {
    serverless.cli.consoleLog('Loading config settings...');
    return {
        lemon: {
            name: "lemon-app",
            runtime: 'nodejs10.x',                              // Node is powered by the V8 JavaScript Engine (used in Chromium)
            region: "ap-northeast-2",
            env: "lemon.yml",                                   // environment file
            stream: undefined,                                  // Table Stream ARN
            securityGroupIds: ['sg-08770106971509def'],         // securityGroup : `lemon-services-api`
            subnetIds: ['subnet-0a53bcd7f3d256ce4','subnet-0ee4d1ca5eb964fc5'],   // subnetIds in VPC
            kmsKey: '*',                                        // KMS key-id
            bucket: 'lemon-hello-www',                          // Name of S3 public bucket.
        },
        ssocio: {
            name: "ssocio-app",
            runtime: 'nodejs10.x',                              // Node is powered by the V8 JavaScript Engine (used in Chromium)
            region: "ap-northeast-2",
            env: "ssocio.yml",                                  // environment file
            stream: undefined,                                  // Table Stream ARN
            securityGroupIds: undefined,                        // securityGroupIds in VPC
            subnetIds: undefined,                               // subnetIds in VPC
            kmsKey: '*',                                        // KMS key-id
            bucket: 'ssocio-hello-wwww',                        // Name of S3 public bucket.
        },
        kong: {
            name: "kong-app",
            runtime: 'nodejs10.x',                              // Node is powered by the V8 JavaScript Engine (used in Chromium)
            region: "ap-northeast-2",
            env: "kong.yml",                                    // environment file
            stream: undefined,                                  // Table Stream ARN
            securityGroupIds: undefined,                        // securityGroupIds in VPC
            subnetIds: undefined,                               // subnetIds in VPC
            kmsKey: '*',                                        // KMS key-id
            bucket: 'kong-hello-www',                           // Name of S3 public bucket.
        },
        jober: {
            name: "jober-app",
            runtime: 'nodejs10.x',                              // Node is powered by the V8 JavaScript Engine (used in Chromium)
            region: "ap-northeast-2",
            env: "jober.yml",                                   // environment file
            stream: undefined,                                  // Table Stream ARN
            securityGroupIds: undefined,                        // securityGroupIds in VPC
            subnetIds: undefined,                               // subnetIds in VPC
            kmsKey: '*',                                        // KMS key-id
            bucket: 'jober-hello-wwww',                         // Name of S3 public bucket.
        },
        comics: {
            name: "comics-app",
            runtime: 'nodejs10.x',                              // Node is powered by the V8 JavaScript Engine (used in Chromium)
            region: "ap-northeast-2",
            env: "comics.yml",                                  // environment file
            stream: undefined,                                  // Table Stream ARN
            securityGroupIds: undefined,                        // securityGroupIds in VPC
            subnetIds: undefined,                               // subnetIds in VPC
            kmsKey: '*',                                        // KMS key-id
            bucket: 'comics-hello-wwww',                        // Name of S3 public bucket.
        },
        adam: {
            name: "adam-app",
            runtime: 'nodejs10.x',                              // Node is powered by the V8 JavaScript Engine (used in Chromium)
            region: "ap-northeast-2",
            env: "adam.yml",                                    // environment file
            stream: undefined,                                  // Table Stream ARN
            securityGroupIds: undefined,                        // securityGroupIds in VPC
            subnetIds: undefined,                               // subnetIds in VPC
            kmsKey: '*',                                        // KMS key-id
            bucket: 'adam-hello-www',                           // Name of S3 public bucket.
        },
        none: {
            name: "none-app",
            runtime: 'nodejs10.x',                              // Node is powered by the V8 JavaScript Engine (used in Chromium)
            region: "ap-northeast-2",
            env: "none.yml",                                    // environment file
            stream: undefined,                                  // Table Stream ARN
            securityGroupIds: undefined,                        // securityGroupIds in VPC
            subnetIds: undefined,                               // subnetIds in VPC
            kmsKey: undefined,                                  // KMS key-id
        },
    };
}

//! export
exports = module.exports = {CONF}
