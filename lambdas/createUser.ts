import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { BadRequestError, StatusCode } from '../core/ProblemDetail.js'
import type { EmailAuthContext } from '../core/auth.js'
import { notifier } from '../core/notifier.js'
import { createUser } from '../core/persistence/createUser.js'

const { tableName } = fromEnv({
	tableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const { notify } = notifier()
const create = createUser(
	{
		db,
		table: tableName,
	},
	notify,
)

export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	try {
		const { id, name } = JSON.parse(event.body ?? '')

		const r = await create({
			id,
			name,
			authContext: event.requestContext
				.authentication as unknown as EmailAuthContext,
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
			body: JSON.stringify(r.user),
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
