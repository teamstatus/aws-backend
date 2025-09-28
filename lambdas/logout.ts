import type { APIGatewayProxyResultV2 } from 'aws-lambda'
import { StatusCode } from '../core/StatusCode.ts'
import { result } from './response.ts'
import { expiredTokenCooked } from './tokenCookie.ts'

export const handler = async (): Promise<APIGatewayProxyResultV2> =>
	result(StatusCode.OK, undefined, [await expiredTokenCooked({})])
