import type { APIGatewayProxyResultV2 } from 'aws-lambda'
import type { ProblemDetail } from '../core/ProblemDetail.js'
import { StatusCode } from '../core/StatusCode.js'

export const result = (
	statusCode: StatusCode,
	result?: unknown,
	cookie?: string,
): APIGatewayProxyResultV2 => {
	console.log(JSON.stringify({ statusCode, result }))
	return {
		statusCode,
		headers:
			result !== undefined
				? {
						'Content-type': 'application/json; charset=utf-8',
						'Content-Language': 'en',
				  }
				: {},
		body: result !== undefined ? JSON.stringify(result) : undefined,
		cookies: cookie !== undefined ? [cookie] : undefined,
	}
}

export const problem = (problem: ProblemDetail): APIGatewayProxyResultV2 => {
	console.error(JSON.stringify(problem))
	return {
		statusCode: problem.status,
		headers: {
			'Content-Type': 'application/problem+json',
			'Content-Language': 'en',
		},
		body: JSON.stringify(problem),
	}
}
