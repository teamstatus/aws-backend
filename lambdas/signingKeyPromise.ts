import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'

export const getPrivateKey = async ({
	ssm,
	stackName,
}: {
	ssm: SSMClient
	stackName: string
}): Promise<string> => {
	const { Parameter } = await ssm.send(
		new GetParameterCommand({
			Name: `/${stackName}/privateKey`,
			WithDecryption: true,
		}),
	)
	const privateKey = Parameter?.Value
	if (privateKey === undefined)
		throw new Error(`${stackName} is not configured!`)

	return privateKey
}

export const getPublicKey = async ({
	ssm,
	stackName,
}: {
	ssm: SSMClient
	stackName: string
}): Promise<string> => {
	const { Parameter } = await ssm.send(
		new GetParameterCommand({
			Name: `/${stackName}/publicKey`,
			WithDecryption: true,
		}),
	)
	const publicKey = Parameter?.Value
	if (publicKey === undefined)
		throw new Error(`${stackName} is not configured!`)

	return publicKey
}
