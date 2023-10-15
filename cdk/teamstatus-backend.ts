import {
	App,
	CfnOutput,
	aws_iam as IAM,
	aws_lambda as Lambda,
	Stack,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { LambdaSource } from './constructs/LambdaSource.js'
import { Persistence } from './constructs/Persistence.js'
import { RESTAPI } from './constructs/RESTAPI.js'
import { WebsocketAPI } from './constructs/WebsocketAPI.js'
import {
	packBackendLambdas,
	type BackendLambdas,
} from './lambdas/packBackendLambdas.js'
import type { PackedLayer } from './lambdas/packLayer.js'
import { packLayer } from './lambdas/packLayer.js'
import { EmailReceiving } from './constructs/EmailReceiving.js'
import { Events } from './constructs/Events.js'
import { EventEmailNotifications } from './constructs/EventEmailNotifications.js'
import { Onboarding } from './constructs/Onboarding.js'

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
		context: Record<string, string>
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

		const isTest = this.node.tryGetContext('isTest') === '1'

		const persistence = new Persistence(this, { isTest })

		const backendLayer = new Lambda.LayerVersion(this, 'backendLayer', {
			code: new LambdaSource(this, {
				hash: layer.hash,
				zipFile: layer.layerZipFile,
				id: 'backendLayer',
			}).code,
			compatibleArchitectures: [Lambda.Architecture.ARM_64],
			compatibleRuntimes: [Lambda.Runtime.NODEJS_18_X],
		})

		const ws = new WebsocketAPI(this, {
			lambdaSources,
			layer: backendLayer,
		})

		const events = new Events(this)

		const api = new RESTAPI(this, {
			lambdaSources,
			persistence,
			layer: backendLayer,
			ws,
			events,
		})

		if (!isTest) {
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

		new CfnOutput(this, 'wsURL', {
			exportName: `${this.stackName}:wsURL`,
			description: 'The Websocket endpoint',
			value: ws.URL,
		})
	}
}

new TeamStatusBackendApp({
	context: {
		isTest:
			process.env.CI !== undefined || process.env.IS_TEST !== undefined
				? '1'
				: '0',
		stackNamePrefix: process.env.STACK_NAME_PREFIX ?? 'teamstatus',
	},
	lambdaSources: await packBackendLambdas(),
	layer: await packLayer({
		id: 'backendLayer',
		dependencies: [
			'@nordicsemiconductor/from-env',
			'jsonwebtoken',
			'ulid',
			'mailparser',
			'@sinclair/typebox',
			'ajv',
		],
	}),
})
