/**
 * API: `/hello`
 * - public service api
 *
 *
 * @author  Tyler <tyler@lemoncloud.io>
 * @date    2020-06-10 refactor with api
 *
 * @copyright (C) 2019 LemonCloud Co Ltd. - All Rights Reserved.
 */
import { $U, _log, _inf, _err } from 'lemon-core';
const NS = $U.NS('HELO', 'yellow'); // NAMESPACE TO BE PRINTED.

//! import core services.
import { NextHandler, GeneralWEBController } from 'lemon-core';
import $service, { HelloService } from '../service/hello-service';

/** ********************************************************************************************************************
 *  MAIN IMPLEMENTATION.
 ** ********************************************************************************************************************/
/**
 * class: `HelloAPIController`
 * - handle hello api-service.
 */
class HelloAPIController extends GeneralWEBController {
    private NODES: {};
    protected service: HelloService;

    /**
     * default constructor.
     */
    public constructor(service?: HelloService) {
        super('hello');

        //! shared memory.
        // WARN! - `serverless offline`는 상태를 유지하지 않으므로, NODES값들이 실행때마다 리셋이될 수 있음.
        this.NODES = [{ name: 'lemon' }, { name: 'cloud' }];
        this.service = service ? service : $service;
    }

    /**
     * name of this resource.
     */
    public hello = () => `hello-api-controller:${this.type()}`;

    /**
     * list hello
     *
     * ```sh
     * $ http ':8086/hello'
     */
    public listHello: NextHandler = (ID, $param, $body, $ctx) => {
        _log(NS, `listHello(${ID})....`);

        const that: any = {};
        that.name = $U.env('NAME'); // read via process.env
        return Promise.resolve(that).then(_ => {
            _.list = this.NODES;
            return _;
        });
    };

    /**
     * get hello hello
     *
     * ```sh
     * $ http ':8086/hello/0'
     */
    public getHello: NextHandler = async (id, param, body, context) => {
        _log(NS, `getHello(${id})...`);
        _log(NS, `> context =`, $U.json(context));
        return { id, hello: this.hello(), context };
    };

    /**
     * Read the channel url.
     *
     * ```sh
     * $ http ':8888/hello/public/test-channel'
     */
    public getHelloTestChannel: NextHandler = (id, $param, $body, $ctx) => {
        _log(NS, `do_get_test_channel(${id})....`);
        return this.service.do_load_slack_channel(id).then((channel: string) => {
            return { id, channel };
        });
    };
}

//! export as default.
export default new HelloAPIController();
