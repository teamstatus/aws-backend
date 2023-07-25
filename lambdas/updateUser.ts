import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import { updateUser } from '../core/persistence/updateUser.js'
import { userAuthRequestPipe } from './requestPipe.js'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const { notify } = notifier()
const update = updateUser(
	{
		db,
		TableName,
	},
	notify,
)

export const handler = userAuthRequestPipe(
	(event) => ({
		patch: JSON.parse(event.body ?? ''),
		version: parseInt(event.headers['if-match'] ?? '0', 10),
	}),
	async ({ patch, version }, authContext) =>
		update(patch, version, authContext),
	() => StatusCode.ACCEPTED,
)
