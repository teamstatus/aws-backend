import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.ts'
import { notifier } from '../core/notifier.ts'
import { acceptProjectInvitation } from '../core/persistence/acceptProjectInvitation.ts'
import { userAuthRequestPipe } from './requestPipe.ts'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const { notify } = notifier()
const accept = acceptProjectInvitation(
	{
		db,
		TableName,
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
