import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import { createReaction } from '../core/persistence/createReaction.js'
import { userAuthRequestPipe } from './requestPipe.js'
import { verifyRecentULID } from './verifyULID.js'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const { notify } = notifier()
const create = createReaction(
	{
		db,
		TableName,
	},
	notify,
)

export const handler = userAuthRequestPipe(
	(event) => {
		const { id, description, emoji, role } = JSON.parse(event.body ?? '')
		return {
			id: verifyRecentULID(id),
			description,
			emoji,
			role,
			statusId: event.pathParameters?.statusId as string,
		}
	},
	async ({ id, description, emoji, role, statusId }, authContext) =>
		create({ id, status: statusId, description, emoji, role }, authContext),
	() => StatusCode.CREATED,
)
