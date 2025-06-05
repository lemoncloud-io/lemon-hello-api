/**
 * `hello-service.ts`
 * - common service for `hello`
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2024-11-27 initial version with `lemon-core#3.2.10`
 *
 * @copyright (C) lemoncloud.io 2024 - All Rights Reserved. (https://eureka.codes)
 */
import { $U, _log, CoreManager, CoreService, $T, ProtocolParam, NextContext, STAGE, NextMode } from 'lemon-core';
import { AWSSNSService, AWSSQSService, DynamoOption, DynamoService, GeneralItem, $protocol } from 'lemon-core';
import { $FIELD, Model, ModelType, TestModel } from './hello-model';
import { SnsPayload, MessagePayload } from './types';

const NS = $U.NS('hello', 'blue'); // NAMESPACE TO BE PRINTED.

/**
 * class: `HelloService`
 * - catch `report-error` via SNS, then save into S3 and post to slack.
 */
export class HelloService extends CoreService<Model, ModelType> {
    public readonly $test: MyTestManager;

    /**
     * default constructor w/ optional parameters.
     *
     * @param tableName target table-name, or dummy `.yml` file.
     * @param params optional parameters.
     */
    public constructor(tableName?: string) {
        super(tableName);
        _log(NS, `HelloService(${this.tableName}, ${this.NS})...`);
        this.$test = new MyTestManager(this);
    }

    /**
     * hello.
     */
    public hello = () => `hello-service`;
}

/**
 * class: `MyCoreManager`
 * - shared core manager for all model.
 * - handle 'name' like unique value in same type.
 */
// eslint-disable-next-line prettier/prettier
export class MyCoreManager<T extends Model, S extends CoreService<T, ModelType>> extends CoreManager<T, ModelType, S> {
    public readonly parent: S;
    public constructor(type: ModelType, parent: S, fields: string[], uniqueField?: string) {
        super(type, parent, fields, uniqueField);
        this.parent = parent;
    }

    /** say hello */
    public hello = () => `${this.storage.hello()}`;

    /**
     * get model by id
     */
    public async getModelById(id: string): Promise<T> {
        return this.storage.read(id).catch(e => {
            if (`${e.message}`.startsWith('404 NOT FOUND')) throw new Error(`404 NOT FOUND - ${this.type}:${id}`);
            throw e;
        });
    }

    /**
     * validate name format
     * - just check empty string.
     * @param name unique name in same type group.
     */
    public validateName = (name: string): boolean => (this.$unique ? this.$unique.validate(name) : true);

    /**
     * convert to internal id by name
     * @param name unique name in same type group.
     */
    public asIdByName = (name: string): string => (this.$unique ? this.$unique.asLookupId(name) : null);

    /**
     * lookup model by name
     * - use `stereo` property to link with the origin.
     *
     * @param name unique name in same type group.
     */
    public findByName = async (name: string): Promise<T> => {
        if (this.$unique) return this.$unique.findOrCreate(name);
        throw new Error(`400 NOT SUPPORT - ${this.type}:#${name}`);
    };
}

/**
 * class: `MyTestManager`
 * - manager for test-model.
 */
export class MyTestManager extends MyCoreManager<TestModel, HelloService> {
    public readonly $dynamo: DynamoService<GeneralItem>;
    public readonly $sqs: AWSSQSService;
    public readonly $sns: AWSSNSService;

    public constructor(parent: HelloService) {
        super('test', parent, $FIELD.test, 'name');

        const option: DynamoOption = {
            tableName: $U.env('MY_DYNAMO_TABLE', 'eureka-hello-table-dev'),
            idName: $U.env('ID_NAME', '_id'),
        };
        const sqsEndpoint = $U.env(
            'SQS_ENDPOINT',
            'https://sqs.ap-northeast-2.amazonaws.com/085403634746/eureka-hello-sqs-dev',
        );

        this.$dynamo = new DynamoService(option);
        this.$sqs = new AWSSQSService(sqsEndpoint, 'ap-northeast-2');
        this.$sns = new AWSSNSService();
    }

    // 시나리오 만들어서 더미랑 테스트 통과
    // 외부 api 호춡에서 찔러서 코드가 실행되어야함
    // 쪼개고 쓰기
    // 테스트 컨셉 + 시나리오
    // creatHttp 이용
    public doTest = async (id: string, data: GeneralItem) => {
        const model = await this.$dynamo.saveItem(id, data);
        const getModel = await this.$dynamo.readItem(id);
        return { model, getModel };
    };
    /**
     * Save data into DynamoDB
     */
    public saveToDynamo = async (id: string, data: GeneralItem) => {
        const res = await this.$dynamo.saveItem(id, data);
        return { res };
    };
    /**
     * Read data from DynamoDB
     */
    public readFromDynamo = async (id: string) => {
        const res = await this.$dynamo.readItem(id);
        return { res };
    };
    /**
     * Send data to SQS
     */
    public sendToSqs = async (params: MessagePayload, context: NextContext) => {
        const errScope = `sendToSqs(${params?.type}/${params?.id}/${params?.cmd})`;
        _log(NS, `${errScope} ...`);

        const service = params?.service ?? 'eureka-hello-api';
        const stage: STAGE = (params?.stage as STAGE) ?? 'dev';
        const type = params?.type ?? 'hello';
        const id = params?.id ?? '0';
        const mode: NextMode = (params?.mode as NextMode) ?? 'POST';
        const cmd = params?.cmd ?? undefined;
        const queryParam = params?.param ?? undefined;
        const requestBody = params?.body ?? undefined;

        if (!service) throw new Error(`@params.service is required - ${errScope}`);
        if (!type) throw new Error(`@params.type is required - ${errScope}`);
        if (!mode) throw new Error(`@params.mode is required - ${errScope}`);

        // 1) build ProtocolParam
        const protocolParam: ProtocolParam = {
            service,
            stage,
            type,
            mode,
            id,
            cmd,
            param: $T.onlyDefined(queryParam),
            body: $T.onlyDefined(requestBody),
            context,
        };

        // 2) build MessageAttributes
        const attrs: { [key: string]: string | number } = {
            Subject: 'x-protocol-service',
            accountId: context.accountId || '',
            requestId: context.requestId || '',
        };

        // 3) send message to SQS
        const messageId = await this.$sqs.sendMessage(protocolParam, attrs);

        return { messageId };
    };

    /**
     * Send data to SNS
     */
    public sendToSns = async (params: SnsPayload, context: NextContext): Promise<{ messageId: string }> => {
        const errScope = `sendToSns(${params.payload.type}/${params.payload.id}/${params.payload.cmd})`;
        _log(NS, `${errScope} ...`);

        // 2) build ProtocolParam
        const protocolParam: ProtocolParam = {
            service: params?.payload?.service ?? 'eureka-hello-api',
            stage: (params?.payload?.stage as STAGE) ?? 'dev',
            type: params?.payload?.type ?? 'hello',
            mode: (params?.payload?.mode as NextMode) ?? 'POST',
            id: params?.payload?.id ?? '0',
            cmd: params?.payload?.cmd ?? undefined,
            param: $T.onlyDefined(params?.payload?.param),
            body: $T.onlyDefined(params?.payload?.body),
            context,
        };

        if (!protocolParam.service) throw new Error(`@params.service is required - ${errScope}`);
        if (!protocolParam.type) throw new Error(`@params.type is required - ${errScope}`);
        if (!protocolParam.mode) throw new Error(`@params.mode is required - ${errScope}`);

        // 3) build $protocol
        const _S2 = (name: string, required = true) => {
            const s = $T.S2((protocolParam as any)?.[name]);
            if (!s && required) throw new Error(`@request.${name} (string) is required - ${errScope}`);
            return s;
        };
        const [service, type, _id, cmd] = [_S2('service'), _S2('type'), _S2('id'), _S2('cmd', false)];
        const path = `/${type}/${_id}` + (cmd ? `/${cmd}` : '');
        const target = `//${service}${path}`;
        const prot = $protocol(context, target, { isProd: false });

        // 4) notify
        const messageId = await prot.notify(undefined, protocolParam?.body, protocolParam?.mode);
        // const messageId = await this.$sns.publish(target, subject, payload);

        return { messageId };
    };
}

//*export default
export default new HelloService();
