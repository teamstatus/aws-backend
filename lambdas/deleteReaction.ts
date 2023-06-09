import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import { deleteReaction } from '../core/persistence/deleteReaction.js'
import { userAuthRequestPipe } from './requestPipe.js'
import { verifyOlderULID } from './verifyULID.js'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const { notify } = notifier()
const del = deleteReaction(
	{
		db,
		TableName,
	},
	notify,
)

export const handler = userAuthRequestPipe(
	(event) => ({
		id: verifyOlderULID(event.pathParameters?.reactionId as string),
	}),
	async ({ id }, authContext) => del(id, authContext),
	() => StatusCode.ACCEPTED,
)
