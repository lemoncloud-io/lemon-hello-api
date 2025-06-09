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
import { $ES6, GETERR, asyncCredentials, expect2 } from 'lemon-core';

//* import main models and service.
import { Model, ModelType, TestModel } from './hello-model';
import { HelloService } from './hello-service';

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

        // 1) AWS 자격 증명 가져오기
        const creds = await asyncCredentials('lemon');

        // 2) createHttpWebProxy 인스턴스 생성
        const name = 'HelloAPI';
        const apiId = '7s91yrozci';
        const region = 'ap-northeast-2';
        const stage = 'dev';
        const endpoint = `https://${apiId}.execute-api.${region}.amazonaws.com/${stage}`;
        const $X = $ES6.$X;
        const proxy = $X.createHttpSearchProxy(endpoint, {
            name,
            credentials: creds as any,
            region,
        });

        //* STEP 1: DynamoDB에 "원본" 데이터 Save → 검증
        //    POST /hello/<id>/dynamo
        const id = '100001';
        const initialData = { name: 'original' };

        const resSave: any = await proxy.doProxy('POST', 'hello', `${id}/dynamo`, undefined, initialData);
        // 응답 예시: { res: { _id: '100001', name: 'original' } }
        expect2(resSave).toEqual({ res: { _id: id, ...initialData } });

        //* STEP 2: DynamoDB에서 방금 저장한 값 Read → 검증
        //    GET /hello/<id>/dynamo
        const resRead1: any = await proxy.doProxy('GET', 'hello', `${id}/dynamo`);
        expect2(resRead1).toEqual({ res: { _id: id, ...initialData } });

        //* STEP 3: SQS로 “dynamo 업데이트” 메시지 발행
        //    POST /hello/<id>/sqs
        //    body: { service, stage, type, mode, id, cmd, body: { name: 'from-sqs' } }
        const sqsPayload = {
            service: 'eureka-hello-api',
            stage: 'dev',
            type: 'hello',
            mode: 'POST',
            id,
            cmd: 'dynamo',
            body: { name: 'from-sqs' },
        };

        const resSqs: any = await proxy.doProxy('POST', 'hello', `${id}/sqs`, undefined, sqsPayload);
        // 반환 예시: { messageId: 'abcdef-...' }
        expect2(resSqs).toHaveProperty('messageId');

        //* STEP 4: SQS 구독자가 메시지를 받아서 Dynamo 업데이트 처리될 때까지 잠시 대기
        await new Promise(r => setTimeout(r, 5000));

        //* STEP 5: DynamoDB에서 “SQS를 통해 업데이트된 값” Read → 검증
        //    GET /hello/<id>/dynamo
        const resRead2: any = await proxy.doProxy('GET', 'hello', `${id}/dynamo`);
        expect2(resRead2).toEqual({ res: { _id: id, name: 'from-sqs' } });

        //* STEP 6: SNS로 “dynamo 업데이트” 메시지 발행
        //    POST /hello/<id>/sns
        //    body: { target, subject, payload: { service, stage, type, mode, id, cmd, body: { name: 'from-sns' } } }
        const snsPayload = {
            service: 'eureka-hello-api',
            stage: 'dev',
            type: 'hello',
            mode: 'POST',
            id,
            cmd: 'dynamo',
            body: { name: 'from-sns' },
        };

        const resSns: any = await proxy.doProxy('POST', 'hello', `${id}/sns`, undefined, snsPayload);
        // 반환 예시: { messageId: 'uvwxyz-...' }
        expect2(resSns).toHaveProperty('messageId');

        //* STEP 7: SNS 구독자가 메시지를 받아서 Dynamo 업데이트 처리될 때까지 잠시 대기
        await new Promise(r => setTimeout(r, 5000));

        //* STEP 8: DynamoDB에서 “SNS를 통해 업데이트된 값” 최종 Read → 검증
        //     GET /hello/<id>/dynamo
        const resRead3: any = await proxy.doProxy('GET', 'hello', `${id}/dynamo`);
        expect2(resRead3).toEqual({ res: { _id: id, name: 'from-sns' } });
    });
});
