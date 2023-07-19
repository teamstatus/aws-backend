import { Construct } from 'constructs'
import {
	aws_ses as SES,
	aws_ses_actions as SESActions,
	aws_lambda as Lambda,
	aws_logs as Logs,
	aws_s3 as S3,
	aws_iam as IAM,
} from 'aws-cdk-lib'
import type { BackendLambdas } from '../lambdas/packBackendLambdas'
import { LambdaSource } from './LambdaSource.js'

export class EmailReceiving extends Construct {
	constructor(
		parent: Construct,
		{
			lambdaSources,
			layer,
		}: {
			lambdaSources: BackendLambdas
			layer: Lambda.ILayerVersion
		},
	) {
		super(parent, 'emailReceiving')

		const bucket = new S3.Bucket(this, 'bucket')

		const lambda = new Lambda.Function(this, 'fn', {
			description: 'Forward incoming emails',
			handler: lambdaSources.emailForwarding.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			memorySize: 256,
			code: new LambdaSource(this, lambdaSources.emailForwarding).code,
			logRetention: Logs.RetentionDays.ONE_DAY,
			initialPolicy: [
				new IAM.PolicyStatement({
					actions: ['ses:SendEmail'],
					resources: ['*'],
				}),
			],
			layers: [layer],
			environment: {
				BUCKET_NAME: bucket.bucketName,
			},
		})
		bucket.grantReadWrite(lambda)

		const ruleSet = new SES.ReceiptRuleSet(this, 'ruleset')
		const rule = ruleSet.addRule('premium', {
			recipients: ['teamstatus.space'],
			enabled: true,
			scanEnabled: true,
			tlsPolicy: SES.TlsPolicy.REQUIRE,
		})
		rule.addAction(
			new SESActions.S3({
				bucket,
			}),
		)
		rule.addAction(
			new SESActions.Lambda({
				function: lambda,
			}),
		)
	}
}
