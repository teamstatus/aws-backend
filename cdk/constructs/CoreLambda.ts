import {
	Duration,
	aws_iam as IAM,
	aws_lambda as Lambda,
	aws_logs as Logs,
	Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { PackedLambda } from '../lambdas/packLambdaFromPath.js'
import { readKeyPolicy } from '../teamstatus-backend.js'
import { LambdaSource } from './LambdaSource.js'
import { Persistence } from './Persistence.js'
import type { WebsocketAPI } from './WebsocketAPI.js'
import type { Events } from './Events.js'

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
			runtime: Lambda.Runtime.NODEJS_18_X,
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
