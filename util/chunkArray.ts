export const chunkArray = <T>(
	array: Array<T>,
	size: number,
): Array<Array<T>> => {
	const chunks: Array<Array<T>> = []
	for (let i = 0; i < array.length; i += size) {
		const subset = array.slice(i, i + size)
		chunks.push(subset)
	}
	return chunks
}
