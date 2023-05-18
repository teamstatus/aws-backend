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

/**
 * @see https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
 */
export enum StatusCode {
	/**
	 * The server cannot or will not process the request due to an apparent client error
	 * (e.g., malformed request syntax, too large size, invalid request message framing, or deceptive request routing).
	 */
	BAD_REQUEST = 400,
	/**
	 * The requested resource could not be found but may be available in the future.
	 * Subsequent requests by the client are permissible.
	 */
	NOT_FOUND = 404,
	/**
	 * Indicates that the request could not be processed because of conflict in the request,
	 * such as an edit conflict between multiple simultaneous updates.
	 */
	CONFLICT = 409,
	/**
	 * A generic error message, given when an unexpected condition was encountered and no more specific message is suitable.
	 */
	INTERNAL_SERVER_ERROR = 500,
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

export const InternalError = (error: unknown): ProblemDetail => ({
	type: new URL(`https://teamstatus.space/error/InternalError`),
	status: StatusCode.INTERNAL_SERVER_ERROR,
	title: (error as Error).message ?? 'No message given.',
})

export const NotFoundError = (title: string): ProblemDetail => ({
	type: new URL(`https://teamstatus.space/error/NotFound`),
	status: StatusCode.NOT_FOUND,
	title,
})
