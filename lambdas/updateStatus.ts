import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import { updateStatus } from '../core/persistence/updateStatus.js'
import { userAuthRequestPipe } from './requestPipe.js'
import { verifyOlderULID } from './verifyULID.js'

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
		version: parseInt(event.headers['if-match'] ?? '0', 10),
	}),
	async ({ id, message, version }, authContext) =>
		update(id, message, version, authContext),
	() => StatusCode.ACCEPTED,
)
