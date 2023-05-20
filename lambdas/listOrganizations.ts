import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import type { UserAuthContext } from '../core/auth.js'
import { listOrganizations } from '../core/persistence/listOrganizations.js'

const { tableName } = fromEnv({
	tableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const list = listOrganizations({
	db,
	table: tableName,
})

export const handler = async (
	event: APIGatewayProxyEventV2 & {
		requestContext: APIGatewayProxyEventV2['requestContext'] & {
			authorizer: {
				lambda: UserAuthContext
			}
		}
	},
): Promise<APIGatewayProxyResultV2> => {
	const r = await list(event.requestContext.authorizer.lambda)

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
		statusCode: 200,
		headers: {
			'Content-type': 'application/json; charset=utf-8',
		},
		body: JSON.stringify(r.organizations),
	}
}
