#!/usr/bin/env bash
# Downloads the JSON Swagger document
# - based on https://github.com/dujung/serverless-aws-documentation
cd `dirname $0`
set -e
stage=prod
profile=lemon
region=ap-northeast-2
name=lemon-hello-api
apiId=`bash -c "aws apigateway get-rest-apis --output=json --region=$region --profile=$profile | /usr/bin/env node ./extract-rest-api-id.js $stage $name"`
fileType=json
outputFileName=../swagger/$name-$stage.$fileType
printf "Downloading Swagger definition to ./$outputFileName
  API ID: $apiId
    Name: $name
   Stage: $stage
  Accept: $fileType\n\n"

aws apigateway get-export \
  --rest-api-id=$apiId \
  --stage-name=$stage \
  --export-type=swagger \
  --accept=application/$fileType \
  --region=$region \
  --profile=$profile \
  $outputFileName

printf "
$(tput setaf 2)Done, your swagger document is: ./$outputFileName$(tput sgr0)
Go to http://editor.swagger.io/ and paste the contents of your swagger document to see it in Swagger UI"
