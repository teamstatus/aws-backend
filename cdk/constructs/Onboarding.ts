import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import {
	aws_iam as IAM,
	type aws_lambda as Lambda,
	aws_sns_subscriptions as Subscriptions,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../lambdas/packBackendLambdas.ts'
import type { Events } from './Events.ts'
import type { Persistence } from './Persistence.ts'

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
