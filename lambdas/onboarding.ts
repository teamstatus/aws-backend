import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SNSClient } from '@aws-sdk/client-sns'
import { fromEnv } from '@bifravst/from-env'
import type { SNSEvent } from 'aws-lambda'
import { notifier } from '../core/notifier.ts'
import { onboarding } from '../core/onboarding/onboarding.ts'
import { snsNotifier } from './snsNotifier.ts'

const { TableName, topicArn } = fromEnv({
	TableName: 'TABLE_NAME',
	topicArn: 'TOPIC_ARN',
})(process.env)

const db = new DynamoDBClient({})
const sns = new SNSClient({})

const { notify, on } = notifier()
snsNotifier({
	sns,
	topicArn,
})({ on })

onboarding({ db, TableName }, notify, on)

export const handler = async ({ Records }: SNSEvent): Promise<void> => {
	for (const { Sns } of Records) {
		const event = JSON.parse(Sns.Message)
		await notify(
			{
				...event,
				timestamp: new Date(event.timestamp),
			},
			true,
		)
	}
}
