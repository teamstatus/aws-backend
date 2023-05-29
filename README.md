# AWS backend for teamstatus

[![GitHub Actions](https://github.com/teamstatus/aws-backend/workflows/Test%20and%20Release/badge.svg)](https://github.com/teamstatus/aws-backend/actions/workflows/test-and-release.yaml)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier/)
[![ESLint: TypeScript](https://img.shields.io/badge/ESLint-TypeScript-blue.svg)](https://github.com/typescript-eslint/typescript-eslint)

AWS backend for teamstatus developed using [AWS CDK](https://aws.amazon.com/cdk)
in [TypeScript](https://www.typescriptlang.org/).

## Installation in your AWS account

### Setup

Provide your AWS credentials, for example using the `.envrc` (see
[the example](.envrc.example)).

Install the dependencies:

```bash
npm ci
```

### Tests

```bash
wget https://s3.eu-central-1.amazonaws.com/dynamodb-local-frankfurt/dynamodb_local_latest.zip
unzip dynamodb_local_latest.zip -d ./dynamodb_local_latest
java -Djava.library.path=./dynamodb_local_latest./DynamoDBLocal_lib -jar ./dynamodb_local_latest/DynamoDBLocal.jar -sharedDb -inMemory &
npm test
```

### Deploy

```bash
# Optionally, configure the stack name prefix to use a suitable name for your deployment
export STACK_NAME_PREFIX="my-teamstatus"
npx cdk deploy

# Configure the JWT keys
npx tsx ./cli/configureKeys.ts
```

## CD with GitHub Actions

Create a GitHub environment `production`.

<!-- FIXME: add CLI comment -->

Store the role name from the output as a GitHub Action secret:

```bash
CD_ROLE_ARN=`aws cloudformation describe-stacks --stack-name ${STACK_NAME_PREFIX:-teamstatus}-backend | jq -r '.Stacks[0].Outputs[] | select(.OutputKey == "cdRoleArn") | .OutputValue'`
gh variable set AWS_REGION --env production --body "${AWS_REGION}"
gh secret set AWS_ROLE --env production --body "${CD_ROLE_ARN}"
# If you've used a custom stack name prefix
gh variable set STACK_NAME_PREFIX --env production --body "${STACK_NAME_PREFIX}"
```

## CI with GitHub Actions

Configure the AWS credentials for an account used for CI, then run

```bash
npx cdk --app 'npx tsx cdk/ci/main.ts' deploy
```

This creates a role with Administrator privileges in that account, and allows
the GitHub repository of this repo to assume it.

Create a GitHub environment `ci`.

<!-- FIXME: add CLI comment -->

Store the role name from the output as a GitHub Action secret:

```bash
CI_ROLE_ARN=`aws cloudformation describe-stacks --stack-name ${STACK_NAME_PREFIX:-teamstatus}-backend-ci | jq -r '.Stacks[0].Outputs[] | select(.OutputKey == "roleArn") | .OutputValue'`
gh variable set AWS_REGION --env ci --body "${AWS_REGION}"
gh secret set AWS_ROLE --env ci --body "${CI_ROLE_ARN}"
```
