import { check, objectMatching, undefinedValue } from 'tsmatchers'
import type { ProblemDetail } from '../ProblemDetail.js'

export const isNotAnError = <Result>(
	res: { error: ProblemDetail } | Result,
): Result => {
	check(res).is(
		objectMatching({
			error: undefinedValue,
		}),
	)
	return res as Result
}
