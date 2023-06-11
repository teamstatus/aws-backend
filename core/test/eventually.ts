import { scheduler } from 'node:timers/promises'

/**
 * Retries function multiple times.
 */
export const eventually = async (
	fn: () => Promise<void>,
	maxTries = 3,
	numTry = 1,
): Promise<void> => {
	try {
		await fn()
	} catch (err) {
		if (numTry >= maxTries) {
			throw err
		}
		await scheduler.wait(1000 * numTry)
		await eventually(fn, maxTries, numTry + 1)
	}
}
