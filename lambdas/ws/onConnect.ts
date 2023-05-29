import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

export const handler = async (event: {
	connectionId: string
	domain: string
	stage: string
	params: URLSearchParams
}): Promise<{ statusCode: number }> => {
	console.log(JSON.stringify({ event }))

	await db.send(
		new PutItemCommand({
			TableName,
			Item: {
				connectionId: {
					S: event.connectionId,
				},
				ttl: {
					N: `${Math.round(Date.now() / 1000) + 60 * 60}`,
				},
			},
		}),
	)

	return { statusCode: 200 }
}
