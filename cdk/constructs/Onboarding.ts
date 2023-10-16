import { Construct } from 'constructs'
import {
	aws_sns_subscriptions as Subscriptions,
	aws_lambda as Lambda,
	aws_logs as Logs,
	aws_iam as IAM,
} from 'aws-cdk-lib'
import type { BackendLambdas } from '../lambdas/packBackendLambdas'
import { LambdaSource } from './LambdaSource.js'
import type { Events } from './Events'
import type { Persistence } from './Persistence'

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

		const lambda = new Lambda.Function(this, 'fn', {
			description: 'Handle onboarding task',
			handler: lambdaSources.onboarding.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_LATEST,
			memorySize: 256,
			code: new LambdaSource(this, lambdaSources.onboarding).code,
			layers: [layer],
			logRetention: Logs.RetentionDays.ONE_DAY,
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
		})

		events.topic.addSubscription(new Subscriptions.LambdaSubscription(lambda))
		persistence.table.grantFullAccess(lambda)
		events.topic.grantPublish(lambda)
	}
}
