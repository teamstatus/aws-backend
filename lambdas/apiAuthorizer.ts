import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@nordicsemiconductor/from-env'
import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import { verifyUserToken } from '../core/auth.js'
import { getPublicKey } from './signingKeyPromise.js'

const { stackName } = fromEnv({
	stackName: 'STACK_NAME',
})(process.env)

const ssm = new SSMClient({})

const publicKeyPromise = getPublicKey({ ssm, stackName })

export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<{
	isAuthorized: boolean
	context: Record<string, any>
}> => {
	console.log(JSON.stringify({ event }))

	console.log(
		verifyUserToken({
			verificationKey: await publicKeyPromise,
		})(event.requestContext.authentication as unknown as any),
	)

	return { isAuthorized: true, context: {} }
}
