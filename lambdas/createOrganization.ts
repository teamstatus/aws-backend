import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { BadRequestError, StatusCode } from '../core/ProblemDetail.js'
import type { UserAuthContext } from '../core/auth.js'
import { notifier } from '../core/notifier.js'
import { createOrganization } from '../core/persistence/createOrganization.js'

const { tableName } = fromEnv({
	tableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const { notify } = notifier()
const create = createOrganization(
	{
		db,
		table: tableName,
	},
	notify,
)

export const handler = async (
	event: APIGatewayProxyEventV2 & {
		requestContext: APIGatewayProxyEventV2['requestContext'] & {
			authorizer: {
				lambda: UserAuthContext
			}
		}
	},
): Promise<APIGatewayProxyResultV2> => {
	try {
		const { id, name } = JSON.parse(event.body ?? '')

		const r = await create(
			{
				id,
				name,
			},
			event.requestContext.authorizer.lambda,
		)

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
			body: JSON.stringify(r.organization),
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
