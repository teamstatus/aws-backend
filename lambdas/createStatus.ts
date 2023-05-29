import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import { createStatus } from '../core/persistence/createStatus.js'
import { userAuthRequestPipe } from './requestPipe.js'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const { notify } = notifier()
const create = createStatus(
	{
		db,
		TableName,
	},
	notify,
)

export const handler = userAuthRequestPipe(
	(event) => {
		const { id, message } = JSON.parse(event.body ?? '')
		return { id, message, projectId: event.pathParameters?.projectId as string }
	},
	async ({ id, message, projectId }, authContext) =>
		create(id, projectId, message, authContext),
	() => StatusCode.CREATED,
)
