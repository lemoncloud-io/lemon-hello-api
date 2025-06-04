/**
 * `hello-api.ts`
 * - service endpoint for `/hello`
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2024-11-27 initial version with `lemon-core#3.2.10`
 *
 * @copyright (C) lemoncloud.io 2024 - All Rights Reserved. (https://eureka.codes)
 */
import { $T, $U, _log, NextHandler, GeneralWEBController } from 'lemon-core';
import { Model, TestModel } from '../service/hello-model';
import { HelloService } from '../service/hello-service';
import { ALBNextHandler } from 'lemon-core/dist/cores/lambda/lambda-alb-handler';
import { PostSnsBody, PostSqsBody, MessagePayload, SnsPayload } from '../service/views';
const NS = $U.NS('hello', 'yellow'); // NAMESPACE TO BE PRINTED.

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
    public constructor(readonly service?: HelloService) {
        super('hello');
        _log(NS, `HelloAPIController()...`);

        const tableName = $U.env('MY_DYNAMO_TABLE');
        this.service = service ?? new HelloService(tableName);
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
    public getHello: NextHandler = async (id, param, body, context) => {
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
    public putHello: NextHandler = async (id, param, body, context) => {
        const errScope = `putHello(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        const node = await this.getHello(id, null, null, context);
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
        const name = $T.S2(body?.name, '', ' ').trim(); // clear new-lines
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
    public doPostEcho: NextHandler = async (id, param, body, context) => {
        const errScope = `doPostEcho(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        return { id, cmd: 'echo', param, body, context };
    };

    /**
     * Delete Node (or mark deleted)
     *
     * ```sh
     * $ http DELETE ':8000/hello/1'
     */
    public deleteHello: NextHandler = async (id, param, body, context) => {
        const errScope = `deleteHello(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);

        // find, and delete by index
        const node = await this.getHello(id, null, null, context);
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
     * $ http GET :8000/hello/0/dynamo
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
     * $ http POST :8000/hello/0/sqs \  
        service=eureka-hello-api \
        type=hello \
        id=10001 \
        cmd=dynamo \
        body:='{"name": "from-sqs22"}'
     */
    public doPostSqs: NextHandler = async (id, param, body: PostSqsBody, context) => {
        const errScope = `doPostSqs(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        return this.service.$test.sendToSqs(body as MessagePayload, context);
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
        return this.service.$test.sendToSns(body as SnsPayload, context);
    };
}

//*export as default.
export default new HelloAPIController();
