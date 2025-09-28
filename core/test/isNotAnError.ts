import type { ProblemDetail } from '../ProblemDetail.ts'

export const isNotAnError = <Result>(
	res: { error: ProblemDetail } | Result,
): Result => {
	if (typeof res === 'object' && res !== null && 'error' in res)
		throw new TypeError('Expected result to not be an error')
	return res as Result
}
