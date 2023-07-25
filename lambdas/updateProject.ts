import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import { updateProject } from '../core/persistence/updateProject.js'
import { userAuthRequestPipe } from './requestPipe.js'
import { SNSClient } from '@aws-sdk/client-sns'
import { snsNotifier } from './snsNotifier.js'

const { TableName, topicArn } = fromEnv({
	TableName: 'TABLE_NAME',
	topicArn: 'TOPIC_ARN',
})(process.env)

const db = new DynamoDBClient({})
const sns = new SNSClient({})

const { notify, on } = notifier()
snsNotifier({ sns, topicArn })({ on })
const update = updateProject(
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
		version: parseInt(event.headers['if-match'] ?? '0', 10),
	}),
	async ({ id, patch, version }, authContext) =>
		update(id, patch, version, authContext),
	() => StatusCode.ACCEPTED,
)
