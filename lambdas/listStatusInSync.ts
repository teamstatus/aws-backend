import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { listStatusInSync } from '../core/persistence/listStatusInSync.js'
import { userAuthRequestPipe } from './requestPipe.js'
import { verifyOlderULID } from './verifyULID.js'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const list = listStatusInSync({
	db,
	TableName,
})

export const handler = userAuthRequestPipe(
	(event) => ({
		syncId: verifyOlderULID(event.pathParameters?.syncId as string),
	}),
	async ({ syncId }, authContext) => list(syncId, authContext),
)
