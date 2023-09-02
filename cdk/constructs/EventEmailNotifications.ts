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

export class EventEmailNotifications extends Construct {
	constructor(
		parent: Construct,
		{
			lambdaSources,
			events,
		}: {
			lambdaSources: BackendLambdas
			events: Events
		},
	) {
		super(parent, 'eventEmailNotifications')

		const lambda = new Lambda.Function(this, 'fn', {
			description: 'Notify admins about important events',
			handler: lambdaSources.eventEmailNotifications.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			memorySize: 256,
			code: new LambdaSource(this, lambdaSources.eventEmailNotifications).code,
			logRetention: Logs.RetentionDays.ONE_DAY,
			initialPolicy: [
				new IAM.PolicyStatement({
					actions: ['ses:SendEmail'],
					resources: ['*'],
				}),
			],
			environment: {},
		})

		events.topic.addSubscription(new Subscriptions.LambdaSubscription(lambda))
	}
}
