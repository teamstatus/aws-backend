import { StatusCode } from './StatusCode.js'

/**
 * Problem Details Object
 *
 * @see https://datatracker.ietf.org/doc/draft-ietf-httpapi-rfc7807bis/
 */
export type ProblemDetail = {
	type: URL
	status: StatusCode
	title: string
	detail?: string
}

export const BadRequestError = (title: string): ProblemDetail => ({
	type: new URL(`https://teamstatus.space/error/BadRequest`),
	status: StatusCode.BAD_REQUEST,
	title,
})

export const ConflictError = (title: string): ProblemDetail => ({
	type: new URL(`https://teamstatus.space/error/Conflict`),
	status: StatusCode.CONFLICT,
	title,
})

export const InternalError = (message?: string): ProblemDetail => ({
	type: new URL(`https://teamstatus.space/error/InternalError`),
	status: StatusCode.INTERNAL_SERVER_ERROR,
	title: message ?? 'An internal error occurred.',
})

export const NotFoundError = (title: string): ProblemDetail => ({
	type: new URL(`https://teamstatus.space/error/NotFound`),
	status: StatusCode.NOT_FOUND,
	title,
})

export const AccessDeniedError = (
	title: string,
	detail?: string,
): ProblemDetail => ({
	type: new URL(`https://teamstatus.space/error/AccessDeniedError`),
	status: StatusCode.FORBIDDEN,
	title,
	detail,
})
