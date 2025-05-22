import { Construct } from 'constructs'
import {
	aws_sns_subscriptions as Subscriptions,
	aws_iam as IAM,
} from 'aws-cdk-lib'
import type { BackendLambdas } from '../lambdas/packBackendLambdas.ts'
import type { Events } from './Events.tsx'
import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'

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

		const lambda = new PackedLambdaFn(
			this,
			'fn',
			lambdaSources.eventEmailNotifications,
			{
				description: 'Notify admins about important events',
				memorySize: 256,
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['ses:SendEmail'],
						resources: ['*'],
					}),
				],
				environment: {},
			},
		).fn

		events.topic.addSubscription(new Subscriptions.LambdaSubscription(lambda))
	}
}
