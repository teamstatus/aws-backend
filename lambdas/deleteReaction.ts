import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@bifravst/from-env'
import { notifier } from '../core/notifier.ts'
import { deleteReaction } from '../core/persistence/deleteReaction.ts'
import { StatusCode } from '../core/StatusCode.ts'
import { userAuthRequestPipe } from './requestPipe.ts'
import { verifyOlderULID } from './verifyULID.ts'

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
