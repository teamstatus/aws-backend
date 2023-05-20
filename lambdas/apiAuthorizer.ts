import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@nordicsemiconductor/from-env'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import { verifyToken } from '../core/auth.js'
import { getPublicKey } from './signingKeyPromise.js'

const { stackName } = fromEnv({
	stackName: 'STACK_NAME',
})(process.env)

const ssm = new SSMClient({})

const publicKeyPromise = getPublicKey({ ssm, stackName })

const requireSub = process.env.REQUIRE_SUB !== undefined

export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<{
	isAuthorized: boolean
	context: Record<string, any>
}> => {
	console.log(JSON.stringify({ event }))

	const [, token] =
		event.cookies
			?.map((s) => s.split('='))
			.find(([name]) => name === 'token') ?? []

	console.log(JSON.stringify({ token }))

	if (token === undefined) {
		console.log(`No token found.`)
		return { isAuthorized: false, context: {} }
	}

	const verified = verifyToken({
		verificationKey: await publicKeyPromise,
	})(token)

	if (requireSub && !('sub' in verified)) {
		console.log(`Sub required.`)
		return { isAuthorized: false, context: {} }
	}

	return { isAuthorized: true, context: verified }
}
