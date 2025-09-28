import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@bifravst/from-env'
import { notifier } from '../core/notifier.ts'
import { updateStatus } from '../core/persistence/updateStatus.ts'
import { StatusCode } from '../core/StatusCode.ts'
import { userAuthRequestPipe } from './requestPipe.ts'
import { verifyOlderULID } from './verifyULID.ts'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const { notify } = notifier()
const update = updateStatus(
	{
		db,
		TableName,
	},
	notify,
)

export const handler = userAuthRequestPipe(
	(event) => ({
		id: verifyOlderULID(event.pathParameters?.statusId as string),
		message: JSON.parse(event.body ?? '').message,
		version: Number.parseInt(event.headers['if-match'] ?? '0', 10),
	}),
	async ({ id, message, version }, authContext) =>
		update(id, message, version, authContext),
	() => StatusCode.ACCEPTED,
)
