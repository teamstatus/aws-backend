import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import { inviteToProject } from '../core/persistence/inviteToProject.js'
import { userAuthRequestPipe } from './requestPipe.js'

const { tableName } = fromEnv({
	tableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const { notify } = notifier()
const invite = inviteToProject(
	{
		db,
		table: tableName,
	},
	notify,
)

export const handler = userAuthRequestPipe(
	(event) => {
		return {
			invitedUserId: JSON.parse(event.body ?? '').invitedUserId,
			projectId: event.pathParameters?.projectId as string,
		}
	},
	async ({ invitedUserId, projectId }, authContext) =>
		invite(invitedUserId, projectId, authContext),
	() => StatusCode.CREATED,
)
