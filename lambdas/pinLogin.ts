import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@bifravst/from-env'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { notifier } from '../core/notifier.ts'
import { BadRequestError } from '../core/ProblemDetail.ts'
import { emailPINLogin } from '../core/persistence/emailPINLogin.ts'
import { StatusCode } from '../core/StatusCode.ts'
import { problem, result } from './response.ts'
import { getPrivateKey } from './signingKeyPromise.ts'
import { tokenCookie } from './tokenCookie.ts'

const { TableName, stackName } = fromEnv({
	TableName: 'TABLE_NAME',
	stackName: 'STACK_NAME',
})(process.env)

const ssm = new SSMClient({})
const db = new DynamoDBClient({})

const { notify } = notifier()
const login = emailPINLogin(
	{
		db,
		TableName,
	},
	notify,
)

const privateKeyPromise = getPrivateKey({ ssm, stackName })

export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	try {
		const { email, pin } = JSON.parse(event.body ?? '')

		const r = await login({ email, pin })

		if ('error' in r) {
			return problem(r.error)
		}

		return result(StatusCode.OK, undefined, [
			await tokenCookie({
				signingKey: await privateKeyPromise,
				authContext: r.authContext,
			}),
		])
	} catch (_error) {
		return problem(BadRequestError('Failed to parse JSON.'))
	}
}
