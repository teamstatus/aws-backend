import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@bifravst/from-env'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import { verifyToken } from '../core/auth.ts'
import { getPublicKey } from './signingKeyPromise.ts'

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
	context: Record<string, unknown>
}> => {
	const [, token] =
		event.cookies
			?.map((s) => s.split('='))
			.find(([name]) => name === 'token') ?? []

	if (token === undefined) {
		return { isAuthorized: false, context: {} }
	}

	const verified = verifyToken({
		verificationKey: await publicKeyPromise,
	})(token)

	if (requireSub && !('sub' in verified)) {
		return { isAuthorized: false, context: {} }
	}

	return { isAuthorized: true, context: verified }
}
