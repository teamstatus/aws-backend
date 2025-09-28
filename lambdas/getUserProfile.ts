import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@bifravst/from-env'
import { getUserProfile } from '../core/persistence/getUserProfile.ts'
import { userAuthRequestPipe } from './requestPipe.ts'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const get = getUserProfile({
	db,
	TableName,
})

export const handler = userAuthRequestPipe(
	(event) => ({
		id: event.pathParameters?.id as string,
	}),
	async ({ id }) => get(id),
)
