import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@bifravst/from-env'
import { notifier } from '../core/notifier.ts'
import { updateUser } from '../core/persistence/updateUser.ts'
import { StatusCode } from '../core/StatusCode.ts'
import { userAuthRequestPipe } from './requestPipe.ts'

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
		version: Number.parseInt(event.headers['if-match'] ?? '0', 10),
	}),
	async ({ patch, version }, authContext) =>
		update(patch, version, authContext),
	() => StatusCode.ACCEPTED,
)
