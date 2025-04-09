import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@nordicsemiconductor/from-env'
import type { PolicyDocument } from 'aws-lambda'
import { verifyToken, type UserAuthContext } from '../../core/auth.ts'
import { getPublicKey } from '../signingKeyPromise.ts'

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
	const [, token] =
		event.cookies
			?.map((s) => s.split('='))
			.find(([name]) => name === 'token') ?? []

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
		return deny
	}

	const verified = verifyToken({
		verificationKey: await publicKeyPromise,
	})(token)

	if (!('sub' in verified)) {
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
