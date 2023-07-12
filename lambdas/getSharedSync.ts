import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { anonRequestPipe } from './requestPipe.js'
import { getSharedSync } from '../core/persistence/getSharedSync.js'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const get = getSharedSync({
	db,
	TableName,
})

export const handler = anonRequestPipe(
	(event) => ({
		id: event.pathParameters?.syncId as string,
		sharingToken: event.pathParameters?.sharingToken as string,
	}),
	async ({ id, sharingToken }) => get({ syncId: id, sharingToken }),
	() => StatusCode.OK,
)
