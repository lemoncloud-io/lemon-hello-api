/**
 * `hello-service.spec.ts`
 * - common service for `hello-service`
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2024-11-27 initial version with `lemon-core#3.2.10`
 *
 * @copyright (C) lemoncloud.io 2024 - All Rights Reserved. (https://eureka.codes)
 */
import { loadProfile } from 'lemon-core/dist/environ';
import { GETERR, NextMode, STAGE, asyncCredentials, createSigV4Proxy, expect2 } from 'lemon-core';

//* import main models and service.
import { Model, ModelType, TestModel } from './hello-model';
import { HelloService } from './hello-service';
import { MessagePayload } from './types';

interface CrendentialForAWS {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
}

interface sigV4ClientConfig {
    accessKey: string;
    secretKey: string;
    region: string;
    serviceName: string;
    host: string;
}

//*create service instance.
export const instance = (table = 'dummy', current?: number) => {
    current = current ?? new Date().getTime();
    const service = new HelloService(table === 'dummy' ? 'dummy-table.yml' : table);
    service.setCurrent(current);
    return { service, current };
};

//*main test body.
describe('hello-service /w dummy', () => {
    const PROFILE = loadProfile(process); // override process.env.
    PROFILE && console.info(`! PROFILE =`, PROFILE);

    it('should pass hello()', async () => {
        const { service } = instance('dummy');
        expect2(() => service.hello()).toEqual('hello-service');
    });

    it('should pass buildTarget test', async () => {
        const { service } = instance('dummy');
        const $test = service.$test;
        const _buildTarget = (service: string, stage: STAGE, type: string, mode: NextMode, id: string, cmd: string) => {
            return $test.buildTarget({ service, stage, type, mode, id, cmd });
        };
        //* Test case 1: Valid params with all fields (including cmd)
        expect2(() => _buildTarget('eureka-hello-api', 'dev', 'hello', 'POST', '12345', 'dynamo')).toEqual(
            '//eureka-hello-api/hello/12345/dynamo',
        );

        //* Test case 2: Valid params without cmd (cmd is optional)
        expect2(() => _buildTarget('eureka-hello-api', 'dev', 'hello', 'POST', '12345', '')).toEqual(
            '//eureka-hello-api/hello/12345',
        );

        //* Test case 3: Missing service (required field)
        expect2(() => _buildTarget('', 'dev', 'hello', 'POST', '12345', 'dynamo')).toEqual(
            '.service (string) is required - buildTarget(hello/12345/dynamo)',
        );

        //* Test case 4: Missing type (required field)
        expect2(() => _buildTarget('eureka-hello-api', 'dev', '', 'POST', '12345', 'dynamo')).toEqual(
            '.type (string) is required - buildTarget(/12345/dynamo)',
        );

        //* Test case 5: Missing id (required field)
        expect2(() => _buildTarget('eureka-hello-api', 'dev', 'hello', 'POST', '', 'dynamo')).toEqual(
            '.id (string) is required - buildTarget(hello//dynamo)',
        );

        //* Test case 6: null/undefined params edge case
        expect2(() => $test.buildTarget(null)).toEqual(
            '.service (string) is required - buildTarget(undefined/undefined/undefined)',
        );
    });
});

describe('model-manager in service', () => {
    //*test service w/ dummy data
    it('should pass test-manager w/ storage', async () => {
        const { service, current } = instance('dummy');
        const _ts = (type: ModelType): Model => ({
            ns: 'TT',
            type,
            createdAt: current,
            updatedAt: current,
            deletedAt: 0,
        });

        //*test service marking
        expect2(service.hello()).toEqual('hello-service');
        const FIELDS = (
            'id,stereo,name,count,' +
            'ns,type,sid,uid,gid,lock,next,meta,' +
            'createdAt,updatedAt,deletedAt,' +
            'error'
        )
            .split(',')
            .map(s => s.trim());
        expect2(() => service.$test.hello()).toEqual(
            `typed-storage-service:test/proxy-storage-service:dummy-storage-service:dummy-table/_id`,
        );
        expect2(() => service.$test.FIELDS).toEqual([...FIELDS]);

        //*test MyCoreManager of handling name.
        if (1) {
            const $test = service.$test;

            expect2(() => $test.validateName(null)).toEqual(false);
            expect2(() => $test.validateName('')).toEqual(false);
            expect2(() => $test.validateName('a')).toEqual(true);
            expect2(() => $test.validateName(' ')).toEqual(false);
            expect2(() => $test.validateName(2 as any)).toEqual(true);
            expect2(() => $test.validateName('abc')).toEqual(true);

            //*check w/ lookup
            expect2(await $test.$unique.updateLookup({ id: 'XYZ' }, 'X').catch(GETERR)).toEqual({
                ..._ts('test'),
                _id: 'TT:test:XYZ',
                id: 'XYZ',
                name: 'X',
            });

            expect2(() => $test.asIdByName('a')).toEqual('#name/a');
            expect2(() => $test.asIdByName(null)).toEqual('#name/');

            //*readByName
            expect2(await $test.findByName(undefined).catch(GETERR)).toEqual('@name (string) is required!');
            expect2(await $test.findByName(null).catch(GETERR)).toEqual('@name (string) is required!');
            expect2(await $test.findByName('').catch(GETERR)).toEqual('@name (string) is required!');
            expect2(await $test.findByName('a').catch(GETERR)).toEqual('404 NOT FOUND - test:name/a');
            expect2(await $test.findByName('abc').catch(GETERR)).toEqual('404 NOT FOUND - test:name/abc');
            expect2(await $test.findByName('   ').catch(GETERR)).toEqual('@name (   ) is not valid!');
            expect2(await $test.findByName(123 as any).catch(GETERR)).toEqual('@name (string) is required!');
            expect2(await $test.findByName({} as any).catch(GETERR)).toEqual('@name (string) is required!');

            //*updateName(model) with name 'abc'
            const model: TestModel = { id: 't01', name: 'test' };
            expect2(await $test.storage.read(model.id).catch(GETERR)).toEqual('404 NOT FOUND - _id:TT:test:t01');
            expect2(await $test.storage.read($test.asIdByName('abc')).catch(GETERR)).toEqual(
                '404 NOT FOUND - _id:TT:test:#name/abc',
            );
            expect2(await $test.findByName('abc').catch(GETERR)).toEqual('404 NOT FOUND - test:name/abc');
        }
    });

    it('should pass v4 test w/ createHttpSearchProxy()', async () => {
        jest.setTimeout(30000);
        const PROFILE = loadProfile(process); // override process.env.
        PROFILE && console.info(`! PROFILE =`, PROFILE);

        // 1) AWS 자격 증명 가져오기
        const creds = await asyncCredentials('lemon');

        // 2) createHttpWebProxy 인스턴스 생성
        const name = 'HelloAPITest';
        const apiId = '7s91yrozci';
        const region = 'ap-northeast-2';
        const stage = 'dev';
        const host = `${apiId}.execute-api.${region}.amazonaws.com`;
        const endpoint = `https://${host}/${stage}`;

        const loadSigConfig = async (profile: string): Promise<sigV4ClientConfig | undefined> => {
            const credentials: CrendentialForAWS | null = (await asyncCredentials(profile).catch(
                () => null,
            )) as CrendentialForAWS | null;
            if (!credentials?.accessKeyId || !credentials?.secretAccessKey) return undefined;
            const ACCESSKEY = credentials?.accessKeyId;
            const SECRETKEY = credentials?.secretAccessKey;
            return {
                accessKey: ACCESSKEY,
                secretKey: SECRETKEY,
                region,
                serviceName: 'execute-api',
                host,
            };
        };
        const sigConfig = await loadSigConfig(PROFILE);
        const proxy = createSigV4Proxy(name, endpoint, sigConfig);

        //* STEP 1: DynamoDB에 "원본" 데이터 Save → 검증
        //    POST /hello/<id>/dynamo
        const id = '100001';
        const initialData = { name: 'original' };
        const expected = {
            _id: 'TT:test:100001',
            id: '100001',
            name: 'original',
            ns: 'TT',
            type: 'test',
        };


        const resSave: any = await proxy.doProxy('POST', 'hello', `${id}/dynamo`, undefined, initialData);
        // 응답 예시: { res: { _id: '100001', name: 'original' } }
        expect2(resSave.res, '!createdAt,!deletedAt,!updatedAt').toEqual(expected);

        //* STEP 2: DynamoDB에서 방금 저장한 값 Read → 검증
        //    GET /hello/<id>/dynamo
        const resRead1: any = await proxy.doProxy('GET', 'hello', `${id}/dynamo`);
        expect2(resRead1.res, '!createdAt,!deletedAt,!updatedAt').toEqual(expected);

        //* STEP 3: SQS로 "dynamo 업데이트" 메시지 발행
        //    POST /hello/<id>/sqs
        //    body: { service, stage, type, mode, id, cmd, body: { name: 'from-sqs' } }
        const payload = {
            service: 'eureka-hello-api',
            stage: 'dev',
            type: 'hello',
            mode: 'POST',
            id,
            cmd: 'dynamo',
            body: { name: 'from-sqs' },
        };

        const resSqs: any = await proxy.doProxy('POST', 'hello', `${id}/sqs`, undefined, payload);
        // 반환 예시: { messageId: 'abcdef-...' }

        //* STEP 4: SQS 구독자가 메시지를 받아서 Dynamo 업데이트 처리될 때까지 잠시 대기
        await new Promise(r => setTimeout(r, 5000));

        //* STEP 5: DynamoDB에서 "SQS를 통해 업데이트된 값" Read → 검증
        //    GET /hello/<id>/dynamo
        const resRead2: any = await proxy.doProxy('GET', 'hello', `${id}/dynamo`);
        expect2(resRead2.res, '!createdAt,!deletedAt,!updatedAt').toEqual({ ...expected, name: 'from-sqs' });

        //* STEP 6: SNS로 "dynamo 업데이트" 메시지 발행
        //    POST /hello/<id>/sns
        //    body: { target, subject, payload: { service, stage, type, mode, id, cmd, body: { name: 'from-sns' } } }

        const resSns: any = await proxy.doProxy('POST', 'hello', `${id}/sns`, undefined, {
            ...payload,
            body: { name: 'from-sns' },
        });
        // 반환 예시: { messageId: 'uvwxyz-...' }

        //* STEP 7: SNS 구독자가 메시지를 받아서 Dynamo 업데이트 처리될 때까지 잠시 대기
        await new Promise(r => setTimeout(r, 5000));

        //* STEP 8: DynamoDB에서 "SNS를 통해 업데이트된 값" 최종 Read → 검증
        //     GET /hello/<id>/dynamo
        const resRead3: any = await proxy.doProxy('GET', 'hello', `${id}/dynamo`);
        expect2(resRead3.res, '!createdAt,!deletedAt,!updatedAt').toEqual({ ...expected, name: 'from-sns' });
    });
});
