import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import { createReaction } from '../core/persistence/createReaction.js'
import { userAuthRequestPipe } from './requestPipe.js'

const { tableName } = fromEnv({
	tableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const { notify } = notifier()
const create = createReaction(
	{
		db,
		table: tableName,
	},
	notify,
)

export const handler = userAuthRequestPipe(
	(event) => {
		const { id, reaction } = JSON.parse(event.body ?? '')
		return { id, reaction, statusId: event.pathParameters?.statusId as string }
	},
	async ({ id, reaction, statusId }, authContext) =>
		create(id, statusId, reaction, authContext),
	() => StatusCode.CREATED,
)
