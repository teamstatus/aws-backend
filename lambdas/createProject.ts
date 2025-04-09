import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.ts'
import { notifier } from '../core/notifier.ts'
import { createProject } from '../core/persistence/createProject.ts'
import { userAuthRequestPipe } from './requestPipe.ts'
import { SNSClient } from '@aws-sdk/client-sns'
import { snsNotifier } from './snsNotifier.ts'

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
