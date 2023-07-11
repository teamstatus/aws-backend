import { randomUUID } from 'node:crypto'

export const generateSharingToken = (): string =>
	`${randomUUID()}${randomUUID()}`.replaceAll('-', '')
