import { fromEnv } from '@nordicsemiconductor/from-env'
import { userAuthRequestPipe } from './requestPipe.js'
import { getUserProfile } from '../core/persistence/getUserProfile.js'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'

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
