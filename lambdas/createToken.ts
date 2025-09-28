import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@bifravst/from-env'
import type { APIGatewayProxyResultV2 } from 'aws-lambda'
import type { UserAuthContext } from '../core/auth.ts'
import { createToken } from '../core/persistence/createToken.ts'
import { StatusCode } from '../core/StatusCode.ts'
import type { AuthorizedEvent } from './AuthorizedEvent.ts'
import { userAuthRequestPipe } from './requestPipe.ts'
import { problem, result } from './response.ts'
import { getPrivateKey } from './signingKeyPromise.ts'

const { TableName, stackName } = fromEnv({
	TableName: 'TABLE_NAME',
	stackName: 'STACK_NAME',
})(process.env)

const db = new DynamoDBClient({})
const ssm = new SSMClient({})

const create = createToken({
	db,
	TableName,
})

const privateKeyPromise = getPrivateKey({ ssm, stackName })

export const handler2 = userAuthRequestPipe(
	() => ({}),
	async (_, authContext) => create(await privateKeyPromise, authContext),
	() => StatusCode.CREATED,
)

export const handler = async (
	event: AuthorizedEvent<UserAuthContext>,
): Promise<APIGatewayProxyResultV2> => {
	const r = await create(
		await privateKeyPromise,
		event.requestContext.authorizer.lambda,
	)

	if ('error' in r) {
		return problem(r.error)
	}

	return result(StatusCode.CREATED, undefined, [r.token])
}
