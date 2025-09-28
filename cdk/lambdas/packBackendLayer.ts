import { packLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'

export const packBackendLayer = async () =>
	await packLayer({
		id: 'backendLayer',
		dependencies: [
			'@bifravst/from-env',
			'jsonwebtoken',
			'ulid',
			'mailparser',
			'@sinclair/typebox',
			'@middy/core',
			'@middy/input-output-logger',
		],
	})
