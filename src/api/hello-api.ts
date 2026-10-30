/**
 * `hello-api.ts`
 * - service endpoint for `/hello`
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2024-11-27 initial version with `lemon-core#3.2.10`
 * @date        2026-10-30 v5: local-only branches use `$U.isLocalMode()` (lemon-core#5.0.11).
 *
 * @copyright (C) lemoncloud.io 2024 - All Rights Reserved. (https://eureka.codes)
 */
import $cores, { $T, $U, _log, _inf, NextHandler, NextContext } from 'lemon-core';
import { GeneralWEBController, $info, onlyDefined, LambdaALBHandler } from 'lemon-core';
import { Model, TestModel } from '../service/hello-model';
import $service, { HelloService } from '../service/hello-service';
import { SlackResponse, SlackMessage, SlackTransformer } from '../service/slack-service';
import { PostSnsBody, PostSqsBody, MessagePayload } from '../service/views';
import { RouteRule, SlackChannelModel } from '../service/slack-types';
const NS = $U.NS('hello', 'yellow'); // NAMESPACE TO BE PRINTED.

//* v5: ALB handler type from the root class (no `lemon-core/dist/*` deep import; removed in v6).
type ALBNextHandler = Parameters<LambdaALBHandler['setHandler']>[0];

/**
 * class: `HelloAPIController`
 * - handle of `/hello` type
 */
export class HelloAPIController extends GeneralWEBController {
    /** sample data */
    private BUFF: TestModel[] = [
        {
            name: '1st',
        },
    ];

    /**
     * default constructor.
     */
    public constructor(readonly service: HelloService = $service) {
        super('hello');
        _log(NS, `HelloAPIController()...`);

        //* attach sns listener
        $cores.cores.lambda.sns.addListener(this.doPostEvent);
    }

    /**
     * name of this resource.
     */
    public hello = () => `hello-api-controller:${this.type()}`;

    /**
     * transform from model to view.
     */
    public modelAsView = <T extends Model>(model: T) => $U.cleanup({ ...model }) as T;

    /**
     * list hello
     *
     * ```sh
     * $ http ':8000/hello'
     */
    public doList: NextHandler = async (id, param, body, context) => {
        const errScope = `doList(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        const name = $U.env('NAME'); // read via process.env
        const list = this.BUFF?.map((N, i) => this.modelAsView({ id: `${i}`, name: N.name }));
        return { name, list };
    };

    /**
     * get hello hello
     *
     * ```sh
     * $ http ':8000/hello/0'
     */
    public doGet: NextHandler = async (id, param, body, context) => {
        const errScope = `getHello(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        const i = $U.N(id, 0);
        const val = this.BUFF[i];
        if (val === undefined) throw new Error(`404 NOT FOUND - id:${id}`);
        return this.modelAsView({ ...val, id: `${i}` });
    };

    /**
     * Only Update with incremental support
     *
     * ```sh
     * $ echo '{"name":1}' | http PUT ':8000/hello/1'
     */
    public doPut: NextHandler = async (id, param, body, context) => {
        const errScope = `doPut(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        const node = await this.doGet(id, null, null, context);
        const i = $U.N(node?.id, 0);
        this.BUFF[i] = { ...node, ...body };
        return this.modelAsView(this.BUFF[i]);
    };

    /**
     * Insert new Node at position 0.
     *
     * ```sh
     * $ http POST :8000/hello/0 name=hello
     */
    public doPost: NextHandler = async (id, param, body, context) => {
        const errScope = `doPost(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        if (id == 'echo') return this.doPostEcho('0', param, body, context);

        //* append into array.
        _log(NS, errScope);
        const i = $U.N(id, 0);
        if (i) throw new Error(`@id[${id}] (number) is invalid - ${errScope}`);
        if (!body?.name) throw new Error(`.name (string) is required - ${errScope}`);
        const name = $T.S2(body?.name, '').trim(); // clear new-lines
        const model: TestModel = { name, _id: `${this.BUFF.length}` };
        this.BUFF.push(model);

        // returns the last-index.
        return this.modelAsView({ ...model, id: `${this.BUFF.length - 1}` });
    };

    /**
     * echo the request.
     *
     * ```sh
     * $ http POST :8000/hello/0/echo name=hello
     */
    public doPostEcho: NextHandler = async (id, param, body, $ctx) => {
        const errScope = `doPostEcho(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        const context = $T.onlyDefined<NextContext>({
            domain: $ctx?.domain,
            clientIp: $ctx?.clientIp,
            userAgent: $ctx?.userAgent,
            authorization: $ctx?.authorization,
            referer: $ctx?.referer,
            cookie: $ctx?.cookie,
        });
        return { id, cmd: 'echo', param, body, context };
    };

    /**
     * send message to slack by channel configuration.
     * - support routeing via `SlackService.route()` (see `SlackChannelModel.rules`)
     *
     * ```sh
     * # use default channel (as public)
     * $ http :8000/hello/0/slack text=hello                                # to default channel(public).
     * $ http :8000/hello/0/slack text=hello channel=error                  # to `error` channel via public.
     *
     * # force to use `error` channel config.
     * $ http :8000/hello/error/slack text=hello                            # to `error` channel.
     *
     * # force to use `error` channel config (ignore channel param)
     * $ http :8000/hello/error/slack text=hello channel=public             # to `error` channel.
     * $ http :8000/hello/public/slack text=hello channel=error             # to `public` channel.
     *
     * # not defined channel name.
     * $ http :8000/hello/some/slack text=hello                             # to `some` channel which is not defined.
     * $ http :8000/hello/0/slack text=hello channel=some                   # to `some` channel which is not defined.
     */
    public doPostSlack: NextHandler<any, SlackResponse, SlackMessage> = async (id, param, body, $ctx) => {
        const errScope = `doPostSlack(${this.type()}/${id ?? ''})`;
        _inf(NS, `${errScope} ...`);
        id = id === '0' ? null : $T.S2(id);

        // STEP.0 validate parameters.
        // const direct = !!$U.N(param?.direct, param?.direct === '' ? 1 : 0);
        if (!body) throw new Error(`.body (SlackMessage) is required - ${errScope}`);

        // STEP.2 prepare slack message via body.
        const message: SlackMessage =
            body && typeof body === 'object' ? body : { text: `${body}`, attachments: undefined };
        _log(NS, '> message :=', $U.json(message));

        // STEP.3 send to slack. (no channel falls back to `body.channel`, then `public` so its routing rules apply)
        const channel: string = id ? id : $T.S2(message?.channel).trim() || 'public';
        const $res = await this.service.$slack.route(message, { channel });
        _log(NS, `> sent[${channel ?? ''}] =`, $U.json($res?.$sent));

        // return sent result.
        return $res?.$sent;
    };

    /**
     * process SNS Event and post to Slack
     *
     * ```sh
     * cat sample/error-1.json | http ':8000/hello/0/event?subject=error'
     * cat sample/slack-1.json | http ':8000/hello/0/event'
     */
    public doPostEvent: NextHandler = async (id, $param, $body, $ctx) => {
        const errScope = `doPostEvent(${this.type()}/${id ?? ''})`;
        _inf(NS, `${errScope} ...`);
        $body && _log(NS, `> body[${id}]=`, typeof $body, $U.json($body));

        //* extract the 1st key name of object.
        const _1st = (o: any) => {
            if (o && typeof o == 'object') {
                const keys = Object.keys(o);
                return keys.length > 0 ? keys[0] : '';
            } else if (o && typeof o == 'string') {
                return `${o}`.trim();
            }
            return '';
        };
        const subject = `${$param?.subject || _1st($body) || ''}`.trim();

        //* decode next-chain.
        const transform: SlackTransformer = this.service.$slack.asTransformer(subject);
        if (!transform) throw new Error(`@transform(${subject}) is not defined - ${errScope}`);

        //* transform to slack-body..
        const { channel, body } = await Promise.resolve(transform({ subject, data: $body, context: $ctx }));
        _log(NS, `> body[<${typeof channel}>${channel}] =`, $U.json(body));

        // send to slack.
        return this.doPostSlack(channel, { ...$param }, body, $ctx);
    };

    /**
     * Save data of channel.
     * - if body is null, then delete.
     *
     * ```sh
     * $ http :8000/hello/public/channel name=public
     * $ http :8000/hello/public/channel channel=
     */
    public doGetChannel: NextHandler = async (id, param, body, context) =>
        this.doPostChannel(id, param, undefined, context);
    public doPostChannel: NextHandler = async (id, param, body, context) => {
        const errScope = `doPostChannel(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        id = id === '0' ? null : $T.S2(id);
        if (!id) throw new Error(`@id (string) is required - ${errScope}`);
        _log(NS, `> body =`, $U.json(body));
        const isGet = !body;

        // mask a secret token for non-local response. ex) 'super-secret' -> '****cret'
        const _maskToken = (token: string): string => (token ? `****${token.slice(-4)}` : token);

        const isLocal = $U.isLocalMode(); //* v5 B5: runtime local mode, never from `context.domain`.
        const $org = await this.service.$slack.default(id);
        if (isGet) {
            if (!$org) throw new Error(`404 NOT FOUND - no channel data @${errScope}`);
            return {
                ...$org,
                endpoint: !isLocal ? $org?.endpoint?.substring(0, 12) : $org?.endpoint,
                token: !isLocal ? _maskToken($org?.token) : $org?.token,
            };
        }

        // build model to update.
        const model = onlyDefined<SlackChannelModel>({
            channel: body?.channel !== undefined ? $T.S2(body?.channel) : undefined,
            name: body?.name !== undefined ? $T.S2(body?.name) : undefined,
            endpoint: body?.endpoint !== undefined ? $T.S2(body?.endpoint) : undefined,
            useS3: body?.useS3 !== undefined ? !!$T.B(body?.useS3) : undefined,
            stereo: body?.stereo !== undefined ? $T.S2(body?.stereo) : undefined,
            token: body?.token !== undefined ? $T.S2(body?.token) : undefined,
            rules: Array.isArray(body?.rules)
                ? (body.rules as any[]).map(N =>
                      onlyDefined<RouteRule>({
                          pattern: $T.S2(N?.pattern),
                          copyTo: N?.copyTo !== undefined ? $T.S2(N?.copyTo) : undefined,
                          moveTo: N?.moveTo !== undefined ? $T.S2(N?.moveTo) : undefined,
                          color: N?.color !== undefined ? $T.S2(N?.color) : undefined,
                      }),
                  )
                : undefined,
        });

        // update (or delete)
        return await this.service.$slack.$channel.save(id, body?.channel === '' ? null : { ...$org, ...model });
    };

    /**
     * Delete Node (or mark deleted)
     *
     * ```sh
     * $ http DELETE ':8000/hello/1'
     */
    public doDelete: NextHandler = async (id, param, body, context) => {
        const errScope = `doDelete(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);

        // find, and delete by index
        const node = await this.doGet(id, null, null, context);
        const i = $U.N(node?.id, 0);
        delete this.BUFF[i];
        return this.modelAsView(node);
    };

    /**
     * for ALB (Application Load Balancer)
     */
    public doALB: ALBNextHandler = async (id, thiz, body, context) => {
        const errScope = `doALB(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        const method = body?.httpMethod ?? 'GET';
        const path = body?.path ?? '/';
        const userAgent = context?.userAgent ?? 'Unknown';
        return thiz.buildResponse(200, `${method} ${path}\n${userAgent}`, { origin: null, credentials: null });
    };

    /**
     * Save data into DynamoDB
     *
     * ```sh
     * $ http POST :8000/hello/100001/dynamo body='{"name":"test"}'
     * $ http :8000/hello/100001/dynamo name=test hello=world
     */
    public doPostDynamo: NextHandler = async (id, param, body, context) => {
        const errScope = `doPostDynamo(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        if (!id) throw new Error(`@id (string) is required - ${errScope}`);
        return this.service.$test.saveToDynamo(id, body);
    };

    /**
     * Read data from DynamoDB
     *
     * ```sh
     * $ http :8000/hello/100001/dynamo
     */
    public doGetDynamo: NextHandler = async (id, param, body, context) => {
        const errScope = `doGetDynamo(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        return this.service.$test.readFromDynamo(id);
    };

    /**
     * Send data to SQS
     *
     * ```sh
     * $ http POST :8000/hello/0/sqs type=hello id=10001 cmd=dynamo body='{"name": "from-sqs"}'
     * $ http POST :8000/hello/0/sqs \  
        service=lemon-hello-api \
        type=hello \
        id=10001 \
        cmd=dynamo \
        body:='{"name": "from-sqs22"}'
     */
    public doPostSqs: NextHandler = async (id, param, body: PostSqsBody, context) => {
        const errScope = `doPostSqs(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        const isLocal = $U.isLocalMode(); //* v5 B5: runtime local mode, never from `context.domain`.
        // WARN! `service` is ONLY possible in local environment.
        const service = isLocal ? $T.S2(body?.service, $info().service) : $info().service;
        const $body = $T.onlyDefined<MessagePayload>({
            ...(body as MessagePayload),
            service,
        });
        return this.service.$test.sendToSqs($body, context);
    };

    /**
     * Send data to SNS
     *
     * ```sh
     * $ http POST :8000/hello/0/sns
     */
    public doPostSns: NextHandler = async (id, param, body: PostSnsBody, context) => {
        const errScope = `doPostSns(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        const isLocal = $U.isLocalMode(); //* v5 B5: runtime local mode, never from `context.domain`.
        // WARN! `service` is ONLY possible in local environment.
        const service = isLocal ? $T.S2(body?.service, $info().service) : $info().service;
        const $body = $T.onlyDefined<MessagePayload>({
            ...(body as MessagePayload),
            service,
        });
        return this.service.$test.sendToSns($body, context);
    };
}

//*export as default.
export default new HelloAPIController();
