import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import type { ProblemDetail } from '../core/ProblemDetail.ts'
import type { StatusCode } from '../core/StatusCode.ts'
import { corsHeaders } from './corsHeaders.ts'

export const result =
	(event: APIGatewayProxyEventV2) =>
	(
		statusCode: StatusCode,
		result?: unknown,
		cookies?: string[],
	): APIGatewayProxyResultV2 => {
		const cors = corsHeaders(event)
		return {
			statusCode,
			headers:
				result !== undefined
					? {
							'Content-type': 'application/json; charset=utf-8',
							'Content-Language': 'en',
							...cors,
						}
					: cors,
			body:
				result !== undefined && !emptyObject(result)
					? JSON.stringify(result)
					: undefined,
			cookies,
		}
	}

export const problem =
	(event: APIGatewayProxyEventV2) =>
	(problem: ProblemDetail): APIGatewayProxyResultV2 => {
		const cors = corsHeaders(event)
		return {
			statusCode: problem.status,
			headers: {
				'Content-Type': 'application/problem+json',
				'Content-Language': 'en',
				...cors,
			},
			body: JSON.stringify(problem),
		}
	}

const emptyObject = (v: unknown): boolean =>
	v !== null && typeof v === 'object' && Object.keys(v).length === 0
