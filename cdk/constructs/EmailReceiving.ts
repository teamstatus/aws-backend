import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import {
	aws_iam as IAM,
	type aws_lambda as Lambda,
	RemovalPolicy,
	aws_s3 as S3,
	aws_ses as SES,
	aws_ses_actions as sesActions,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import type { BackendLambdas } from '../lambdas/packBackendLambdas.ts'

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

		const bucket = new S3.Bucket(this, 'bucket', {
			removalPolicy: RemovalPolicy.RETAIN,
		})

		const lambda = new PackedLambdaFn(
			this,
			'fn',
			lambdaSources.emailForwarding,
			{
				description: 'Forward incoming emails',
				memorySize: 256,
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
			},
		).fn
		bucket.grantReadWrite(lambda)

		const ruleSet = new SES.ReceiptRuleSet(this, 'ruleset')
		const rule = ruleSet.addRule('premium', {
			recipients: ['teamstatus.space'],
			enabled: true,
			scanEnabled: true,
			tlsPolicy: SES.TlsPolicy.REQUIRE,
		})
		rule.addAction(
			new sesActions.S3({
				bucket,
			}),
		)
		rule.addAction(
			new sesActions.Lambda({
				function: lambda,
			}),
		)
	}
}
