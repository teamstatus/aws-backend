import { LambdaSource } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import type { PackedLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import { isTest } from '@bifravst/aws-cdk-lambda-helpers/util'
import {
	App,
	CfnOutput,
	aws_iam as IAM,
	aws_lambda as Lambda,
	Stack,
} from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import { EmailReceiving } from './constructs/EmailReceiving.ts'
import { EventEmailNotifications } from './constructs/EventEmailNotifications.ts'
import { Events } from './constructs/Events.ts'
import { Onboarding } from './constructs/Onboarding.ts'
import { Persistence } from './constructs/Persistence.ts'
import { RESTAPI } from './constructs/RESTAPI.ts'
import {
	type BackendLambdas,
	packBackendLambdas,
} from './lambdas/packBackendLambdas.ts'
import { packBackendLayer } from './lambdas/packBackendLayer.ts'

export const readKeyPolicy = (
	stack: Stack,
	type: 'privateKey' | 'publicKey',
): IAM.PolicyStatement =>
	new IAM.PolicyStatement({
		actions: ['ssm:GetParameter'],
		resources: [
			`arn:aws:ssm:${stack.region}:${stack.account}:parameter/${stack.stackName}/${type}`,
		],
	})

class TeamStatusBackendApp extends App {
	constructor({
		context,
		lambdaSources,
		layer,
	}: {
		context: {
			[key: string]: unknown
		}
		lambdaSources: BackendLambdas
		layer: PackedLayer
	}) {
		super({ context })

		const stackPrefix = this.node.tryGetContext('stackNamePrefix') ?? '-backend'
		new TeamStatusBackendStack(this, `${stackPrefix}-backend`, {
			lambdaSources,
			layer,
		})
	}
}

class TeamStatusBackendStack extends Stack {
	constructor(
		parent: Construct,
		name: string,
		{
			lambdaSources,
			layer,
		}: {
			lambdaSources: BackendLambdas
			layer: PackedLayer
		},
	) {
		super(parent, name)

		const persistence = new Persistence(this)

		const backendLayer = new Lambda.LayerVersion(this, 'backendLayer', {
			code: new LambdaSource(this, {
				hash: layer.hash,
				zipFilePath: layer.layerZipFilePath,
				id: 'backendLayer',
			}).code,
			compatibleArchitectures: [Lambda.Architecture.ARM_64],
			compatibleRuntimes: [Lambda.Runtime.NODEJS_22_X],
		})

		const events = new Events(this)

		const api = new RESTAPI(this, {
			lambdaSources,
			persistence,
			layer: backendLayer,
			events,
		})

		if (!isTest(this)) {
			new EmailReceiving(this, {
				lambdaSources,
				layer: backendLayer,
			})

			new EventEmailNotifications(this, {
				events,
				lambdaSources,
			})
		}

		new Onboarding(this, {
			lambdaSources,
			events,
			persistence,
			layer: backendLayer,
		})

		new CfnOutput(this, 'tableName', {
			exportName: `${this.stackName}:tableName`,
			description: 'The name of the table',
			value: persistence.table.tableName,
		})

		new CfnOutput(this, 'apiURL', {
			exportName: `${this.stackName}:apiURL`,
			description: 'The API endpoint',
			value: api.URL,
		})
	}
}

new TeamStatusBackendApp({
	context: {
		isTest: process.env.CI !== undefined || process.env.IS_TEST !== undefined,
		stackNamePrefix: process.env.STACK_NAME_PREFIX ?? 'teamstatus',
	},
	lambdaSources: await packBackendLambdas(),
	layer: await packBackendLayer(),
})
