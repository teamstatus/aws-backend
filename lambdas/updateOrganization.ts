import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SNSClient } from '@aws-sdk/client-sns'
import { fromEnv } from '@bifravst/from-env'
import { notifier } from '../core/notifier.ts'
import { updateOrganization } from '../core/persistence/updateOrganization.ts'
import { StatusCode } from '../core/StatusCode.ts'
import { userAuthRequestPipe } from './requestPipe.ts'
import { snsNotifier } from './snsNotifier.ts'

const { TableName, topicArn } = fromEnv({
	TableName: 'TABLE_NAME',
	topicArn: 'TOPIC_ARN',
})(process.env)

const db = new DynamoDBClient({})
const sns = new SNSClient({})

const { notify, on } = notifier()
snsNotifier({ sns, topicArn })({ on })
const update = updateOrganization(
	{
		db,
		TableName,
	},
	notify,
)

export const handler = userAuthRequestPipe(
	(event) => ({
		id: event.pathParameters?.id as string,
		patch: JSON.parse(event.body ?? ''),
		version: Number.parseInt(event.headers['if-match'] ?? '0', 10),
	}),
	async ({ id, patch, version }, authContext) =>
		update(id, patch, version, authContext),
	() => StatusCode.ACCEPTED,
)
