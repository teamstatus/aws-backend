import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@bifravst/from-env'
import { notifier } from '../core/notifier.ts'
import { deleteSync } from '../core/persistence/deleteSync.ts'
import { StatusCode } from '../core/StatusCode.ts'
import { userAuthRequestPipe } from './requestPipe.ts'
import { verifyOlderULID } from './verifyULID.ts'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const { notify } = notifier()
const del = deleteSync(
	{
		db,
		TableName,
	},
	notify,
)

export const handler = userAuthRequestPipe(
	(event) => ({
		id: verifyOlderULID(event.pathParameters?.syncId as string),
		version: Number.parseInt(event.headers['if-match'] ?? '0', 10),
	}),
	async ({ id, version }, authContext) => del(id, version, authContext),
	() => StatusCode.ACCEPTED,
)
