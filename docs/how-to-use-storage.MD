# How to use a Storage Service

`lemon-hello-api`를 개발하는 과정에 있어 `storage service`를 사용하는 요령에 대해 정리한 문서입니다.

- [How to use a Storage Service](#how-to-use-a-storage-service)
  - [How Storage Services Work](#how-storage-services-work)
  - [How to use a DynamoDB](#how-to-use-a-dynamodb)
  - [Test code for Dynamo](#test-code-for-dynamo)
  - [How to Contribute](#how-to-contribute)

## How Storage Services Work

![StorageFlow.png](/assets/storage-flow.png)

1. API Controller에서는 `hello-service`의 Model Manager를 통해 storage를 사용할 수 있습니다.</br>
   `MyCoreManager`는 CoreManager를 통해 모든 Model을 통합적으로 관리합니다.

2. `Model`은 schema에 해당하는 개념입니다. </br>
   Model Interface를 설계하여 실제 Dynamo Table에 저장될 field의 attributes를 지정할 수 있습니다.
3. `TypedStorageService`는 Model Type을 구분하여 StorageService를 이용할 수 있도록 도움을 줍니다.
4. `ProxyStorageService`는 Proxy와 같이 중간 매개체 역할을 수행합니다.</br>
   상위 storage service를 더 많은 기능으로 래핑하며, 실행 환경에 따라 `storage`를 생성합니다.</br>
   위 다이어그램의 경우 `TypedStorageService`의 기능을 확장한 것을 확인할 수 있습니다.
5. Test 환경의 경우 `DummyStorageService`를 제공합니다.</br>
   이는, in-memory 방식으로 동작하며, 실제 Dynamo 환경을 대체합니다.
6. 실제 환경의 경우 `DynamoStorageService`를 통해 실제 DynamoDB에 연결합니다.

---

## How to use a DynamoDB

-   lemon-core에서는 유연하고, 편리하게 데이터베이스를 관리할 수 있도록 Model을 제공합니다.
-   ModelType에 따라, 각 data(item)마다 고유한 파티션 키를 생성할 수 있고, 모델 별로 스키마를 관리할 수 있습니다.
-   이를 사용하기 위해서는, 새로운 모델에 대한 interface를 구성하고, Model Manager를 통해 관리해야 합니다.

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
    export class MyAnimalManager extends MyCoreManager<AnimalModel, HelloService> {
        public constructor(parent: HelloService) {
            super('animal', parent, $FIELD.animal);
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
            params?: { kms?: AWSKMSService; sns?: AWSSNSService; s3?: AWSS3Service },
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

-   lemon-core는 Dynamo Test를 위한 `DummyStorageService`를 제공합니다.</br>
    이는 in-memory 기반으로 동작하며, dummy 데이터를 생성하여 실제 DynamoDB 환경을 대체합니다.
-   storage를 이용한 Unit test를 설계할 경우, `precondition`과 `postcondition`을 고려하여 테스트를 수행할 수 있습니다.

## How to Contribute

-   request via `PR`, or use `Issue`.
