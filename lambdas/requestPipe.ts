import type { APIGatewayProxyResultV2 } from 'aws-lambda'
import { BadRequestError, type ProblemDetail } from '../core/ProblemDetail.js'
import { StatusCode } from '../core/StatusCode.js'
import type { EmailAuthContext, UserAuthContext } from '../core/auth.js'
import type { AuthorizedEvent } from './AuthorizedEvent.js'
import { problem, result } from './response.js'

export const userAuthRequestPipe =
	<ValidInput, Result extends Record<string, any>>(
		validateInput: (event: AuthorizedEvent<UserAuthContext>) => ValidInput,
		handle: (
			input: ValidInput,
			authContext: UserAuthContext,
		) => Promise<{ error: ProblemDetail } | Result>,
		toStatusCode?: (result?: Result) => StatusCode,
		cookie?: (
			input: ValidInput,
			authContext: EmailAuthContext,
			result?: Result,
		) => Promise<string>,
	) =>
	async (
		event: AuthorizedEvent<UserAuthContext>,
	): Promise<APIGatewayProxyResultV2> => {
		{
			let input: ValidInput
			try {
				input = validateInput(event)
			} catch (error) {
				console.error(error)
				return problem(BadRequestError('Input validation failed.'))
			}
			const maybeResult = await handle(
				input,
				event.requestContext.authorizer.lambda,
			)
			if ('error' in maybeResult) return problem(maybeResult.error)
			return result(
				toStatusCode?.(maybeResult) ?? StatusCode.OK,
				maybeResult,
				await cookie?.(
					input,
					event.requestContext.authorizer.lambda,
					maybeResult,
				),
			)
		}
	}

export const emailAuthRequestPipe =
	<ValidInput, Result extends Record<string, any>>(
		validateInput: (event: AuthorizedEvent<EmailAuthContext>) => ValidInput,
		handle: (
			input: ValidInput,
			authContext: EmailAuthContext,
		) => Promise<{ error: ProblemDetail } | Result>,
		toStatusCode?: (result?: Result) => StatusCode,
		cookie?: (
			input: ValidInput,
			authContext: EmailAuthContext,
			result?: Result,
		) => Promise<string>,
	) =>
	async (
		event: AuthorizedEvent<EmailAuthContext>,
	): Promise<APIGatewayProxyResultV2> => {
		{
			let input: ValidInput
			try {
				input = validateInput(event)
			} catch (error) {
				console.error(error)
				return problem(BadRequestError('Input validation failed.'))
			}
			const maybeResult = await handle(
				input,
				event.requestContext.authorizer.lambda,
			)
			if ('error' in maybeResult) return problem(maybeResult.error)
			return result(
				toStatusCode?.(maybeResult) ?? StatusCode.OK,
				maybeResult,
				await cookie?.(
					input,
					event.requestContext.authorizer.lambda,
					maybeResult,
				),
			)
		}
	}
