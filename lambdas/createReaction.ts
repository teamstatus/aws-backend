import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.ts'
import { notifier } from '../core/notifier.ts'
import { createReaction } from '../core/persistence/createReaction.ts'
import { userAuthRequestPipe } from './requestPipe.ts'
import { verifyRecentULID } from './verifyULID.ts'

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
