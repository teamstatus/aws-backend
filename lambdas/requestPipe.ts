import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { BadRequestError, type ProblemDetail } from '../core/ProblemDetail.ts'
import { StatusCode } from '../core/StatusCode.ts'
import type { EmailAuthContext, UserAuthContext } from '../core/auth.ts'
import type { AuthorizedEvent } from './AuthorizedEvent.ts'
import { problem, result } from './response.ts'

export const anonRequestPipe =
	<ValidInput, Result extends Record<string, any>>(
		validateInput: (event: APIGatewayProxyEventV2) => ValidInput,
		handle: (input: ValidInput) => Promise<{ error: ProblemDetail } | Result>,
		toStatusCode?: (result?: Result) => StatusCode,
	) =>
	async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
		{
			let input: ValidInput
			try {
				input = validateInput(event)
			} catch (_error) {
				return problem(event)(BadRequestError('Input validation failed.'))
			}
			const maybeResult = await handle(input)
			if ('error' in maybeResult) {
				return problem(event)(maybeResult.error)
			}
			return result(event)(
				toStatusCode?.(maybeResult) ?? StatusCode.OK,
				maybeResult,
			)
		}
	}

export const userAuthRequestPipe =
	<ValidInput, Result extends Record<string, any>>(
		validateInput: (event: AuthorizedEvent<UserAuthContext>) => ValidInput,
		handle: (
			input: ValidInput,
			authContext: UserAuthContext,
		) => Promise<{ error: ProblemDetail } | Result>,
		toStatusCode?: (result?: Result) => StatusCode,
		cookies?: (
			input: ValidInput,
			authContext: EmailAuthContext,
			result?: Result,
		) => Promise<string[]>,
	) =>
	async (
		event: AuthorizedEvent<UserAuthContext>,
	): Promise<APIGatewayProxyResultV2> => {
		{
			let input: ValidInput
			try {
				input = validateInput(event)
			} catch (_error) {
				return problem(event)(BadRequestError('Input validation failed.'))
			}
			const maybeResult = await handle(
				input,
				event.requestContext.authorizer.lambda,
			)
			if ('error' in maybeResult) {
				return problem(event)(maybeResult.error)
			}
			return result(event)(
				toStatusCode?.(maybeResult) ?? StatusCode.OK,
				maybeResult,
				await cookies?.(
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
		cookies?: (
			input: ValidInput,
			authContext: EmailAuthContext,
			result?: Result,
		) => Promise<string[]>,
	) =>
	async (
		event: AuthorizedEvent<EmailAuthContext>,
	): Promise<APIGatewayProxyResultV2> => {
		{
			let input: ValidInput
			try {
				input = validateInput(event)
			} catch (_error) {
				return problem(event)(BadRequestError('Input validation failed.'))
			}
			const maybeResult = await handle(
				input,
				event.requestContext.authorizer.lambda,
			)
			if ('error' in maybeResult) {
				return problem(event)(maybeResult.error)
			}
			return result(event)(
				toStatusCode?.(maybeResult) ?? StatusCode.OK,
				maybeResult,
				await cookies?.(
					input,
					event.requestContext.authorizer.lambda,
					maybeResult,
				),
			)
		}
	}
