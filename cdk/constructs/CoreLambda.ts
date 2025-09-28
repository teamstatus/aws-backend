import type { PackedLambda } from '@bifravst/aws-cdk-lambda-helpers'
import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import {
	Duration,
	aws_iam as IAM,
	type aws_lambda as Lambda,
	type Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { readKeyPolicy } from '../teamstatus-backend.ts'
import type { Events } from './Events.ts'
import type { Persistence } from './Persistence.ts'

export class CoreLambda extends Construct {
	public readonly lambda: Lambda.Function
	constructor(
		parent: Construct,
		id: string,
		{
			stack,
			description,
			source,
			layer,
			persistence,
			events,
		}: {
			stack: Stack
			description: string
			source: PackedLambda
			layer: Lambda.ILayerVersion
			persistence: Persistence
			environment?: Record<string, string>
			events: Events
		},
	) {
		super(parent, id)

		this.lambda = new PackedLambdaFn(this, 'FN', source, {
			description,
			timeout: Duration.seconds(10),
			layers: [layer],
			initialPolicy: [
				readKeyPolicy(stack, 'privateKey'),
				readKeyPolicy(stack, 'publicKey'),
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
		persistence.table.grantFullAccess(this.lambda)
		events.topic.grantPublish(this.lambda)
	}
}
