import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@nordicsemiconductor/from-env'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { BadRequestError } from '../core/ProblemDetail.js'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import { emailPINLogin } from '../core/persistence/emailPINLogin.js'
import { problem, result } from './response.js'
import { getPrivateKey } from './signingKeyPromise.js'
import { tokenCookie } from './tokenCookie.js'

const { tableName, stackName } = fromEnv({
	tableName: 'TABLE_NAME',
	stackName: 'STACK_NAME',
})(process.env)

const ssm = new SSMClient({})
const db = new DynamoDBClient({})

const { notify } = notifier()
const login = emailPINLogin(
	{
		db,
		table: tableName,
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

		return result(
			StatusCode.OK,
			undefined,
			await tokenCookie({
				signingKey: await privateKeyPromise,
				authContext: r.authContext,
			}),
		)
	} catch (error) {
		return problem(BadRequestError('Failed to parse JSON.'))
	}
}
