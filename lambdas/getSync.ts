import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { getSync } from '../core/persistence/getSync.js'
import { userAuthRequestPipe } from './requestPipe.js'

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
	async ({ id }, authContext) => get({ syncId: id }, authContext),
	() => StatusCode.OK,
)
