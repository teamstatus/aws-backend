import {
	GetParameterCommand,
	ParameterType,
	PutParameterCommand,
	SSMClient,
} from '@aws-sdk/client-ssm'

import { execSync } from 'node:child_process'

const ssm = new SSMClient({})

const prefix = `${process.env.STACK_PREFIX ?? 'teamstatus'}-backend`
const privateKeyParameterName = `/${prefix}/privateKey`
const publicKeyParameterName = `/${prefix}/publicKey`

console.log(
	`Checking whether private key is configured in ${privateKeyParameterName}...`,
)
try {
	await ssm.send(
		new GetParameterCommand({
			Name: privateKeyParameterName,
		}),
	)
	console.log('Key is configured')
} catch (error) {
	if ((error as Error).name !== 'ParameterNotFound') throw error

	console.log(`Key not yet configured`)

	const privateKey = execSync(
		'openssl ecparam -name prime256v1 -genkey',
	).toString()
	const publicKey = execSync('openssl ec -pubout', {
		input: privateKey,
	}).toString()

	await ssm.send(
		new PutParameterCommand({
			Name: privateKeyParameterName,
			Value: privateKey,
			Type: ParameterType.SECURE_STRING,
		}),
	)

	await ssm.send(
		new PutParameterCommand({
			Name: publicKeyParameterName,
			Value: publicKey,
			Type: ParameterType.STRING,
		}),
	)
}
