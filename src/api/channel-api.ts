/**
 * API: `/channel`
 * - service api for channel-model
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2022-09-13 support route by channel's rules.
 *
 * @copyright (C) 2022 LemonCloud Co Ltd. - All Rights Reserved.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $U, $T, _log, _inf, _err, NUL404 } from 'lemon-core';
import { GeneralWEBController, NextHandler } from 'lemon-core';
import { ChannelModel, RouteRule } from '../service/hello-model';
import $service, { HelloService } from '../service/hello-service';
const NS = $U.NS('channel', 'yellow'); // NAMESPACE TO BE PRINTED.

/**
 * class: `ChannelAPIController`
 */
export class ChannelAPIController extends GeneralWEBController {
    private NODES: { name: string }[];
    protected service: HelloService;

    /**
     * default constructor.
     */
    public constructor(service?: HelloService) {
        super('channel');
        this.service = service || $service;
        _log(NS, `ChannelAPIController()...`);
    }

    /**
     * name of this resource.
     */
    public hello = () => `channel-api-controller:${this.type()}`;

    /**
     * get model by id
     *
     * ```sh
     * $ http ':8888/channel/public'
     * $ http ':8888/channel/todaq'
     *
     * # test kms + dynamo
     * $ http --auth-type aws4 --auth profile=securenet 'https://kewad9a8c5.execute-api.ap-northeast-2.amazonaws.com/prod/channel/public'
     */
    public doGet: NextHandler = async (id, param, body, context) => {
        _log(NS, `doGet(${id})....`);
        id = id === '0' ? '' : $T.S2(id).trim();
        if (!id) throw new Error(`@id (string) is required!`);
        const throwable = !!$T.B(param?.throw, param?.throw === '' ? 1 : 0);

        //! load the default endpoint from environment.
        const endpoint = await this.service.loadSlackChannel(id, { throwable });
        endpoint && _inf(NS, `> endpoint @env[${id}] :=`, endpoint);

        //! find from DB, and show in detail
        const model = await this.service.$channel.prepare(id, { endpoint }, true);
        return model;
    };

    /**
     * update model by id
     *
     * ```sh
     * $ http PUT ':8888/channel/public' name=public
     */
    public doPut: NextHandler = async (id, param, body: ChannelModel, context) => {
        _log(NS, `doPut(${id})....`);
        id = id === '0' ? '' : $T.S2(id).trim();
        if (!id) throw new Error(`@id (string) is required!`);

        // STEP.0 validate parameters.
        const name = body?.name !== undefined ? $T.S2(body.name, '', ' ').trim() : undefined;
        const useS3 = body?.useS3 !== undefined ? $T.B(body.useS3) : undefined;
        const channel = body?.channel !== undefined ? $T.S2(body.channel, '', ' ').trim() : undefined;
        const endpoint = body?.endpoint !== undefined ? $T.S2(body.endpoint, '', ' ').trim() : undefined;

        // STEP.1 find the target model (null if not found)
        const $org = await this.service.$channel.find(id);
        $org && _inf(NS, `> origin =`, typeof $org, $U.json($org));

        // STEP.2 prepare model to update
        const model: ChannelModel = {};
        if (name !== undefined) model.name = name;
        if (useS3 !== undefined) model.useS3 = useS3;
        if (channel !== undefined) model.channel = channel;
        if (endpoint !== undefined) model.endpoint = endpoint;

        // STEP.3 update.
        if (Object.keys(model).length > 0) {
            const saved = $org
                ? await this.service.$channel.update(id, model)
                : await this.service.$channel.save(id, model);
            _inf(NS, `> updated =`, $U.json(saved));
            return { ...$org, ...saved, id };
        }

        //! returns.
        return { ...$org, id };
    };

    /**
     * add route-rule into target channel rules.
     *
     *```sh
     * echo '{"pattern":"hello","copyTo":"alarm","color":"red"}' | http PUT ':8888/channel/public/rules'
     * echo '{"pattern":"SNS: DeliveryFailure","moveTo":"stage"}' | http PUT ':8888/channel/public/rules'
     * # test route to some
     * echo '{"pattern":"oauth-token","moveTo":"error"}' | http PUT ':8888/channel/public/rules'
     * echo '{"pattern":"error-report","copyTo":"error"}' | http PUT ':8888/channel/public/rules'
     */
    public doPutRules: NextHandler = async (id, param, body: RouteRule | RouteRule[], context) => {
        _log(NS, `doPutRules(${id})....`);
        id = id === '0' ? '' : $T.S2(id).trim();
        if (!id) throw new Error(`@id (string) is required!`);
        if (typeof body !== 'object' || !body) throw new Error(`@body (object) is required`);

        // STEP.0 validate parameters.
        const list = Array.isArray(body) ? body.map<RouteRule>(N => ({ ...N })) : [body];
        const rules0 = list.map(N => this.service.$channel.asRule(N)).filter(N => !!N);

        // STEP.1 find(or prepare) model.
        const model = await this.service.$channel.prepare(id, { rules: [] }, true);

        // STEP.2 and update.
        const rules = [...(model.rules || []), ...rules0];
        const updated = await this.service.$channel.update(id, { rules });
        _inf(NS, `> updated =`, $U.json(updated));

        //! returns.
        return updated;
    };
}

//! export as default.
export default new ChannelAPIController();
