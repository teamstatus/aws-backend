import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@nordicsemiconductor/from-env'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { BadRequestError, StatusCode } from '../core/ProblemDetail.js'
import type { EmailAuthContext, UserAuthContext } from '../core/auth.js'
import { notifier } from '../core/notifier.js'
import { createUser } from '../core/persistence/createUser.js'
import { getPrivateKey } from './signingKeyPromise.js'
import { tokenCookie } from './tokenCookie.js'

const { tableName, stackName } = fromEnv({
	tableName: 'TABLE_NAME',
	stackName: 'STACK_NAME',
})(process.env)

const db = new DynamoDBClient({})
const ssm = new SSMClient({})

const { notify } = notifier()
const create = createUser(
	{
		db,
		table: tableName,
	},
	notify,
)

const privateKeyPromise = getPrivateKey({ ssm, stackName })

export const handler = async (
	event: APIGatewayProxyEventV2 & {
		requestContext: APIGatewayProxyEventV2['requestContext'] & {
			authorizer: {
				lambda: EmailAuthContext | UserAuthContext
			}
		}
	},
): Promise<APIGatewayProxyResultV2> => {
	try {
		const { id, name } = JSON.parse(event.body ?? '')

		const r = await create({
			id,
			name,
			authContext: event.requestContext.authorizer.lambda,
		})

		if ('error' in r) {
			console.error(JSON.stringify(r.error))
			return {
				statusCode: r.error.status,
				headers: {
					'Content-Type': 'application/problem+json',
					'Content-Language': 'en',
				},
				body: JSON.stringify(r.error),
			}
		}

		return {
			statusCode: 201,
			headers: {
				'Content-type': 'application/json; charset=utf-8',
			},
			body: JSON.stringify(r.user),
			cookies: [
				await tokenCookie({
					signingKey: await privateKeyPromise,
					authContext: {
						email: r.user.email,
						sub: r.user.id,
					},
				}),
			],
		}
	} catch (error) {
		console.error(error)
		return {
			statusCode: StatusCode.BAD_REQUEST,
			headers: {
				'Content-Type': 'application/problem+json',
				'Content-Language': 'en',
			},
			body: JSON.stringify(BadRequestError('Failed to parse JSON.')),
		}
	}
}
