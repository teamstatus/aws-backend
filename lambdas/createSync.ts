import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SNSClient } from '@aws-sdk/client-sns'
import { fromEnv } from '@bifravst/from-env'
import { notifier } from '../core/notifier.ts'
import { createSync } from '../core/persistence/createSync.ts'
import { StatusCode } from '../core/StatusCode.ts'
import { userAuthRequestPipe } from './requestPipe.ts'
import { snsNotifier } from './snsNotifier.ts'
import { verifyRecentULID } from './verifyULID.ts'

const { TableName, topicArn } = fromEnv({
	TableName: 'TABLE_NAME',
	topicArn: 'TOPIC_ARN',
})(process.env)

const db = new DynamoDBClient({})
const sns = new SNSClient({})

const { notify, on } = notifier()
snsNotifier({ sns, topicArn })({ on })
const create = createSync(
	{
		db,
		TableName,
	},
	notify,
)

export const handler = userAuthRequestPipe(
	(event) => {
		const { id, title, projectIds, inclusiveStartDate, inclusiveEndDate } =
			JSON.parse(event.body ?? '')
		return {
			id: verifyRecentULID(id),
			title,
			projectIds,
			inclusiveStartDate,
			inclusiveEndDate,
		}
	},
	async (
		{ id, title, projectIds, inclusiveStartDate, inclusiveEndDate },
		authContext,
	) =>
		create(
			{
				id,
				projectIds,
				title,
				inclusiveStartDate:
					inclusiveStartDate !== undefined
						? new Date(inclusiveStartDate)
						: undefined,
				inclusiveEndDate:
					inclusiveEndDate !== undefined
						? new Date(inclusiveEndDate)
						: undefined,
			},
			authContext,
		),
	() => StatusCode.CREATED,
)
