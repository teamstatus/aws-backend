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
import { Persistence } from './Persistence.js'

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
		}: {
			stack: Stack
			description: string
			source: PackedLambda
			layer: Lambda.ILayerVersion
			persistence: Persistence
			environment?: Record<string, string>
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
			code: Lambda.Code.fromAsset(source.zipFile),
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
			},
		})
		persistence.table.grantFullAccess(this.lambda)
	}
}
