import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@bifravst/from-env'
import { getSync } from '../core/persistence/getSync.ts'
import { StatusCode } from '../core/StatusCode.ts'
import { userAuthRequestPipe } from './requestPipe.ts'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const get = getSync({
	db,
	TableName,
})

export const handler = userAuthRequestPipe(
	(event) => ({
		id: event.pathParameters?.syncId as string,
	}),
	async ({ id }, authContext) => get(id, authContext),
	() => StatusCode.OK,
)
