import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@nordicsemiconductor/from-env'
import type { PolicyDocument } from 'aws-lambda'
import { verifyToken, type UserAuthContext } from '../../core/auth.js'
import { getPublicKey } from '../signingKeyPromise.js'

const { stackName } = fromEnv({
	stackName: 'STACK_NAME',
})(process.env)

const ssm = new SSMClient({})

const publicKeyPromise = getPublicKey({ ssm, stackName })

type AuthorizerResult = {
	principalId: string
	policyDocument: PolicyDocument
	context?: UserAuthContext
}

export const handler = async (event: {
	methodArn: string
	cookies: string[]
}): Promise<AuthorizerResult> => {
	console.log(JSON.stringify({ event }))

	const [, token] =
		event.cookies
			?.map((s) => s.split('='))
			.find(([name]) => name === 'token') ?? []

	console.log(JSON.stringify({ token }))

	const deny: AuthorizerResult = {
		principalId: 'me',
		policyDocument: {
			Version: '2012-10-17',
			Statement: [
				{
					Action: 'execute-api:Invoke',
					Effect: 'Deny',
					Resource: event.methodArn,
				},
			],
		},
	}

	if (token === undefined) {
		console.log(`No token found.`)
		return deny
	}

	const verified = verifyToken({
		verificationKey: await publicKeyPromise,
	})(token)

	if (!('sub' in verified)) {
		console.log(`Sub required.`)
		return deny
	}

	return <AuthorizerResult>{
		principalId: 'me',
		policyDocument: {
			Version: '2012-10-17',
			Statement: [
				{
					Action: 'execute-api:Invoke',
					Effect: 'Allow',
					Resource: event.methodArn,
				},
			],
		},
		context: verified,
	}
}
