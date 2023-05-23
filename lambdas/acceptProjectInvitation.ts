import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import { acceptProjectInvitation } from '../core/persistence/acceptProjectInvitation.js'
import { userAuthRequestPipe } from './requestPipe.js'

const { tableName } = fromEnv({
	tableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const { notify } = notifier()
const accept = acceptProjectInvitation(
	{
		db,
		table: tableName,
	},
	notify,
)

export const handler = userAuthRequestPipe(
	(event) => {
		return { projectId: event.pathParameters?.projectId as string }
	},
	async ({ projectId }, authContext) => accept(projectId, authContext),
	() => StatusCode.ACCEPTED,
)
