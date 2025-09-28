import type { APIGatewayProxyResultV2 } from 'aws-lambda'
import type { ProblemDetail } from '../core/ProblemDetail.ts'
import type { StatusCode } from '../core/StatusCode.ts'

export const result = (
	statusCode: StatusCode,
	result?: unknown,
	cookies?: string[],
): APIGatewayProxyResultV2 => ({
	statusCode,
	headers:
		result !== undefined
			? {
					'Content-type': 'application/json; charset=utf-8',
					'Content-Language': 'en',
				}
			: undefined,
	body:
		result !== undefined && !emptyObject(result)
			? JSON.stringify(result)
			: undefined,
	cookies,
})

export const problem = (problem: ProblemDetail): APIGatewayProxyResultV2 => ({
	statusCode: problem.status,
	headers: {
		'Content-Type': 'application/problem+json',
		'Content-Language': 'en',
	},
	body: JSON.stringify(problem),
})

const emptyObject = (v: unknown): boolean =>
	v !== null && typeof v === 'object' && Object.keys(v).length === 0
