import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import {
	aws_iam as IAM,
	aws_sns_subscriptions as Subscriptions,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../lambdas/packBackendLambdas.ts'
import type { Events } from './Events.tsx'

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
