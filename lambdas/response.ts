import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import type { ProblemDetail } from '../core/ProblemDetail.js'
import { StatusCode } from '../core/StatusCode.js'
import { corsHeaders } from './corsHeaders.js'

export const result =
	(event: APIGatewayProxyEventV2) =>
	(
		statusCode: StatusCode,
		result?: unknown,
		cookie?: string,
	): APIGatewayProxyResultV2 => {
		console.log(JSON.stringify({ statusCode, result }))
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
			cookies: cookie !== undefined ? [cookie] : undefined,
		}
	}

export const problem =
	(event: APIGatewayProxyEventV2) =>
	(problem: ProblemDetail): APIGatewayProxyResultV2 => {
		console.error(JSON.stringify(problem))
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
