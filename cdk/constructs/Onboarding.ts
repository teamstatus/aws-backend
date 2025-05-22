import { Construct } from 'constructs'
import {
	aws_sns_subscriptions as Subscriptions,
	type aws_lambda as Lambda,
	aws_iam as IAM,
} from 'aws-cdk-lib'
import type { BackendLambdas } from '../lambdas/packBackendLambdas.ts'
import type { Events } from './Events.ts'
import type { Persistence } from './Persistence.ts'
import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'

export class Onboarding extends Construct {
	constructor(
		parent: Construct,
		{
			lambdaSources,
			events,
			persistence,
			layer,
		}: {
			lambdaSources: BackendLambdas

			layer: Lambda.ILayerVersion
			events: Events
			persistence: Persistence
		},
	) {
		super(parent, 'onboarding')

		const lambda = new PackedLambdaFn(this, 'fn', lambdaSources.onboarding, {
			description: 'Handle onboarding task',
			memorySize: 256,
			layers: [layer],
			initialPolicy: [
				new IAM.PolicyStatement({
					actions: ['ses:SendEmail'],
					resources: ['*'],
				}),
			],
			environment: {
				TABLE_NAME: persistence.table.tableName,
				TOPIC_ARN: events.topic.topicArn,
			},
		}).fn

		events.topic.addSubscription(new Subscriptions.LambdaSubscription(lambda))
		persistence.table.grantFullAccess(lambda)
		events.topic.grantPublish(lambda)
	}
}
