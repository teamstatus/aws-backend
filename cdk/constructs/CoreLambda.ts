import {
	Duration,
	aws_iam as IAM,
	aws_lambda as Lambda,
	aws_logs as Logs,
	type Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { PackedLambda } from '../lambdas/packLambdaFromPath.ts'
import { readKeyPolicy } from '../teamstatus-backend.ts'
import { LambdaSource } from './LambdaSource.ts'
import type { Persistence } from './Persistence.ts'
import type { WebsocketAPI } from './WebsocketAPI.ts'
import type { Events } from './Events.ts'

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
			ws,
			events,
			isTest,
		}: {
			stack: Stack
			description: string
			source: PackedLambda
			layer: Lambda.ILayerVersion
			persistence: Persistence
			environment?: Record<string, string>
			ws: WebsocketAPI
			events: Events
			isTest: boolean
		},
	) {
		super(parent, id)

		this.lambda = new Lambda.Function(this, 'FN', {
			description,
			handler: source.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_LATEST,
			timeout: Duration.seconds(10),
			memorySize: 1792,
			code: new LambdaSource(this, source).code,
			layers: [layer],
			logRetention: Logs.RetentionDays.ONE_WEEK,
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
				STACK_NAME: stack.stackName,
				WS_URL: ws.URL,
				TOPIC_ARN: events.topic.topicArn,
				IS_TEST: isTest ? '1' : '0',
			},
		})
		persistence.table.grantFullAccess(this.lambda)
		events.topic.grantPublish(this.lambda)
	}
}
