import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@nordicsemiconductor/from-env'
import type { APIGatewayProxyResultV2 } from 'aws-lambda'
import { StatusCode } from '../core/StatusCode.js'
import type { UserAuthContext } from '../core/auth.js'
import { createToken } from '../core/persistence/createToken.js'
import type { AuthorizedEvent } from './AuthorizedEvent.js'
import { userAuthRequestPipe } from './requestPipe.js'
import { problem, result } from './response.js'
import { getPrivateKey } from './signingKeyPromise.js'

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
		return problem(event)(r.error)
	}

	return result(event)(StatusCode.CREATED, undefined, r.token)
}
