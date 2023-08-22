import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SNSClient } from '@aws-sdk/client-sns'
import { fromEnv } from '@nordicsemiconductor/from-env'
import type { SNSEvent } from 'aws-lambda'
import { notifier } from '../core/notifier.js'
import { onboarding } from '../core/onboarding/onboarding.js'
import { snsNotifier } from './snsNotifier.js'

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
	console.log(JSON.stringify({ Records }))

	for (const { Sns } of Records) {
		const event = JSON.parse(Sns.Message)
		await notify(event)
	}
}
