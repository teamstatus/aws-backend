import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import { shareSync } from '../core/persistence/shareSync.js'
import { userAuthRequestPipe } from './requestPipe.js'
import { generateSharingToken } from '../core/generateSharingToken.js'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const { notify } = notifier()
const share = shareSync(
	{
		db,
		TableName,
	},
	notify,
)

export const handler = userAuthRequestPipe(
	(event) => ({
		id: event.pathParameters?.statusId as string,
		sharingToken: event.body ?? generateSharingToken(),
		version: parseInt(event.headers['if-match'] ?? '0', 10),
	}),
	async ({ id, sharingToken, version }, authContext) => {
		await share(id, sharingToken, version, authContext)
		return { sharingToken }
	},
	() => StatusCode.ACCEPTED,
)
