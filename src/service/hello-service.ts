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
import $cores, { $T, $U, _log, NextContext, $protocol, NUL404 } from 'lemon-core';
import { CoreManager, CoreService, GeneralItem, AWSS3Service } from 'lemon-core';
import { $FIELD, Model, ModelType, TestModel } from './hello-model';
import { MessagePayload } from './types';
import { SlackService } from './slack-service';
import { SlackChannelModel, StorageSupportable } from './slack-types';
const NS = $U.NS('hello', 'blue'); // NAMESPACE TO BE PRINTED.

/**
 * class: `HelloService`
 * - catch `report-error` via SNS, then save into S3 and post to slack.
 */
export class HelloService extends CoreService<Model, ModelType> {
    public readonly $test: MyTestManager;
    public readonly $slack: SlackService;

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

        type MyModel = TestModel<SlackChannelModel>;
        // support s3 to store large message body.
        const _s3 = (): AWSS3Service => {
            const EP = $U.env('MY_S3_BUCKET');
            if (EP) return $cores.cores.aws.s3;
            return null;
        };
        // support for slack data.
        const _db = (thiz: HelloService) =>
            new (class MyChannel implements StorageSupportable<SlackChannelModel> {
                public hello = () => `hello-service-channel-storage`;
                public async read(id: string): Promise<SlackChannelModel> {
                    const data = await thiz.$test.retrieve(`@${id}`).catch<MyModel>(NUL404);
                    if (data?.meta$) return data.meta$;
                    return null;
                }
                public async save(id: string, data?: SlackChannelModel): Promise<SlackChannelModel> {
                    if (data === null) return (await thiz.$test.delete(`@${id}`, true)) as SlackChannelModel;
                    const $org = await this.read(id);
                    const meta$ = { ...$org, ...data };
                    const result = await thiz.$test.save(`@${id}`, { meta$ });
                    return result?.meta$;
                }
            })();
        // initialize slack service.
        this.$slack = new SlackService(_db(this), { $s3s: _s3() });
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
    public constructor(parent: HelloService) {
        super('test', parent, $FIELD.test, 'name');
    }
    /**
     * Save data into DynamoDB
     */
    public saveToDynamo = async (id: string, data: GeneralItem) => {
        const res = await this.save(id, data);
        return { res };
    };
    /**
     * Read data from DynamoDB
     */
    public readFromDynamo = async (id: string) => {
        const res = await this.getModelById(id);
        return { res };
    };

    /**
     * Send data to SQS using protocolService.enqueue()
     */
    public sendToSqs = async (params: MessagePayload, context: NextContext) => {
        const errScope = `sendToSqs(${params?.type}/${params?.id}/${params?.cmd})`;
        _log(NS, `${errScope} ...`);

        // validation
        if (!params?.service) throw new Error(`.service (string) is requried - ${errScope}`);
        if (!params?.type) throw new Error(`.type is required - ${errScope}`);

        // 1) target/protocol 생성
        const target = this.buildTarget(params);

        // 2) protocol 객체 생성
        const prot = $protocol(context, target);

        // 3) enqueue 호출 (SQS 발송)
        const messageId = await prot.enqueue(
            $T.onlyDefined(params), // param
            $T.onlyDefined(params.body), // body
            params?.mode, // mode
            undefined, // callback
            undefined, // delaySeconds
        );

        return { messageId };
    };

    /**
     * Send data to SNS using protocolService.notify()
     */
    public sendToSns = async (params: MessagePayload, context: NextContext): Promise<{ messageId: string }> => {
        const errScope = `sendToSns(${params?.type}/${params?.id}/${params?.cmd})`;
        _log(NS, `${errScope} ...`);

        // validation
        if (!params?.service) throw new Error(`.service is required - ${errScope}`);
        if (!params?.type) throw new Error(`.type is required - ${errScope}`);

        // 1) target/protocol 생성
        const target = this.buildTarget(params);

        // 2) protocol 객체 생성
        const prot = $protocol(context, target);

        // 3) notify 호출 (SNS 발송)
        const messageId = await prot.notify(
            $T.onlyDefined(params.param), // param
            $T.onlyDefined(params.body), // body
            params?.mode, // mode
            undefined, // callback
        );

        return { messageId };
    };

    /**
     * Build target string with params
     */
    public buildTarget = (params: MessagePayload) => {
        const errScope = `buildTarget(${params?.type}/${params?.id}/${params?.cmd})`;
        const _S2 = (name: string, required = true) => {
            const s = $T.S2((params as any)?.[name]);
            if (!s && required) throw new Error(`.${name} (string) is required - ${errScope}`);
            return s;
        };
        const [service, type, _id, cmd] = [_S2('service'), _S2('type'), _S2('id'), _S2('cmd', false)];
        const path = `/${type}/${_id}` + (cmd ? `/${cmd}` : '');
        const target = `//${service}${path}`;
        return target;
    };
}

//*export default
export default new HelloService();
