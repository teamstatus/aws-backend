import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import { createProject } from '../core/persistence/createProject.js'
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
const create = createProject(
	{
		db,
		TableName,
	},
	notify,
)

export const handler = userAuthRequestPipe(
	(event) => JSON.parse(event.body ?? ''),
	async ({ id, name }, authContext) =>
		create(
			{
				id,
				name,
			},
			authContext,
		),
	() => StatusCode.CREATED,
)
