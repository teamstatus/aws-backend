import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { StatusCode } from '../core/StatusCode.ts'
import { result } from './response.ts'
import { expiredTokenCooked } from './tokenCookie.ts'

export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> =>
	result(event)(StatusCode.OK, undefined, [await expiredTokenCooked({})])
