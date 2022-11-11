# How to use a Storage Service

`lemon-hello-api`를 개발하는 과정에 있어 `storage service`를 사용하는 요령에 대해 정리한 문서입니다.

- [How to use a Storage Service](#how-to-use-a-storage-service)
  - [How Storage Services Work](#how-storage-services-work)
  - [How to use a DynamoDB](#how-to-use-a-dynamodb)
  - [Test code for Dynamo](#test-code-for-dynamo)
  - [How to Contribute](#how-to-contribute)

## How Storage Services Work

1. storage service를 이용하기 위한 첫 단계는 [MyCoreManager](https://github.com/lemoncloud-io/lemon-hello-api/blob/fdc328f5f0de8ee0ca63b89bd83ac81233702bf0/src/service/hello-service.ts#L837)입니다.

2. `hello-api`는 `MyCoreManager`를 통해 여러 ModelType을 지원하고, 해당 Model의 interface에 따라 fields를 결정하게 됩니다.

   ```tsx
   // hello-model.ts
   export const filterFields = (fields: string[], base: string[] = []) =>
     fields
       .filter((field) => field !== "_id" && /^[a-z_][a-zA-Z0-9_]+/.test(field))
       .reduce<string[]>(
         (L, k) => {
           if (k && !L.includes(k)) L.push(k);
           return L;
         },
         [...base]
       );

   //! extended fields set of sub-class.
   export const $FIELD = {
     test: filterFields(keys<TestModel>()),
     channel: filterFields(keys<ChannelModel>()),
     target: filterFields(keys<TargetModel>()),
   };
   ```

3. `MyCoreManger`를 통해 생성한 `ModelManager`는 [AbstractManager](https://github.com/lemoncloud-io/lemon-core/blob/927eb466e671bad0020a8f22f336730ce1bfbdf9/src/cores/storage/model-manager.ts#L23) 클래스의 [TypedStorageService](https://github.com/lemoncloud-io/lemon-core/blob/927eb466e671bad0020a8f22f336730ce1bfbdf9/src/cores/storage/proxy-storage-service.ts#L699-L866)에 접근할 수 있습니다.</br>
   또한 `TypedStorageService` 는 [ProxyStorageService](https://github.com/lemoncloud-io/lemon-core/blob/927eb466e671bad0020a8f22f336730ce1bfbdf9/src/cores/storage/proxy-storage-service.ts#L291-L692)를 통해, 사용자에게 실제 DB환경을 은닉화하며 사용 환경에 따라</br>
   Dynamo Service 또는 Dummy Service를 제공합니다.</br>

   ```tsx
       /**
     * create storage-service w/ fields list.
     * - idName should be `_id`
     *
     * @param table     table-name or dummy file name (ex: `dummy-data.yml`).
     * @param fields    required for dynamo table.
     * @param idName    internal partition-key name (default '_id')
     */
    public static makeStorageService<T>(table: string, fields?: string[], idName?: string): StorageService<T> {
        if (!table) throw new Error(`@table (table-name) is required!`);
        idName = idName === undefined ? '_id' : `${idName || ''}`;
        //! clear the duplicated string
        const clearDuplicated = (arr: string[]) =>
            arr.sort().reduce((L, val) => {
                if (val && L.indexOf(val) < 0) L.push(val);
                return L;
            }, []);

        //! make internal storage-service by table
        if (table.endsWith('.yml')) {
            return new DummyStorageService<T>(table, table.split('.')[0], idName);
        } else {
            if (!fields) throw new Error(`@fields (list of field) is required!`);
            fields = clearDuplicated(CORE_FIELDS.concat(fields));
            return new DynamoStorageService<T>(table, fields, idName);
        }
    }
   ```

---

## How to use a DynamoDB

- lemon-core에서는 유연하고, 편리하게 데이터베이스를 관리할 수 있도록 Model을 제공합니다.
- ModelType에 따라, 각 data(item)마다 고유한 파티션 키를 생성할 수 있고, 모델 별로 스키마를 관리할 수 있습니다.
- 이를 사용하기 위해서는, 새로운 모델에 대한 interface를 구성하고, Model Manager를 통해 관리해야 합니다.

예시를 통해 전체적인 응용 과정을 살펴봅니다.

1. Model에 대한 interface를 정의 합니다.실제 DB에 저장될 구조(attributes)를 설계하는 과정입니다.
   ```tsx
   // hello-model.ts
   export interface AnimalModel extends Model {
     /**
      * target url to fetch image
      */
     imageUrl?: string;
   }
   ```
2. `MyCoreManager`를 상속받아 `Model Manager`를 구현합니다.
   ```tsx
   // hello-service.ts
   /**
    * class: `MyAnimalManager`
    * - manager for animal-model.
    */
   export class MyAnimalManager extends MyCoreManager<
     AnimalModel,
     HelloService
   > {
     public constructor(parent: HelloService) {
       super("animal", parent, $FIELD.animal);
     }
   }
   ```
3. `HelloService`에 Manager 추가.

   ```tsx
   // hello-service.ts
   export class HelloService extends CoreService<Model, ModelType> {
     //				...
     public readonly $animal: MyAnimalManager;

     public constructor(
       tableName?: string,
       params?: { kms?: AWSKMSService; sns?: AWSSNSService; s3?: AWSS3Service }
     ) {
       //				...
       this.$animal = new MyAnimalManager(this);
     }
   }
   ```

4. storage service 이용

   ```tsx
   // example
   public saveImageUrl = async (body: ImageInfo): Promise<string> => {
       const { keyword, imageUrl } = body;
       const animalStorage = this.$animal.storage;

       return await animalStorage
           .readOrCreate(keyword, { imageUrl: imageUrl })
           .then(data => {
               return data._id;
           })
           .catch(e => {
               if (GETERR(e).startsWith('404 NOT FOUND')) throw new Error(`@id (model-id) is required`);
               throw e;
           });
   };
   ```

## Test code for Dynamo

- lemon-core는 Dynamo Test를 위한 `DummyStorageService`를 제공합니다.</br>
  이는 in-memory 기반으로 동작하며, dummy 데이터를 생성하여 실제 DynamoDB 환경을 대체합니다.
- storage를 이용한 Unit test를 설계할 경우, `precondition`과 `postcondition`을 고려하여 테스트를 수행할 수 있습니다.

## How to Contribute

- request via `PR`, or use `Issue`.
