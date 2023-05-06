import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import assert from 'node:assert/strict'
import { before, describe, test as it } from 'node:test'
import { check, objectMatching, stringMatching } from 'tsmatchers'
import { ulid } from 'ulid'
import { CoreEventType, Role, core, type CoreEvent } from './core.js'
import { createTable } from './createTable.js'

describe('core', async () => {
	const table = `teamstatus-${ulid()}`
	const db = new DynamoDBClient({
		endpoint: 'http://localhost:8000/',
		region: 'eu-west-1',
	})
	const coreInstance = core({ db, table })

	before(async () => {
		try {
			await createTable(db, table)
		} catch (err) {
			console.error(`Failed to create table: ${(err as Error).message}!`)
			throw err
		}
		console.log(`Table ${table} created.`)
	})

	describe('organizations', async () => {
		it('can create a new organization', async () => {
			const events: CoreEvent[] = []
			coreInstance.on(CoreEventType.ORGANIZATION_CREATED, (e) => events.push(e))
			const { organization } = await coreInstance
				.authenticate('@alex')
				.organizations.create('$acme')
			check(organization).is(
				objectMatching({
					id: '$acme',
				}),
			)
			check(events[0]).is(
				objectMatching({
					type: CoreEventType.ORGANIZATION_CREATED,
					id: '$acme',
					owner: '@alex',
				}),
			)
		})

		it('ensures that organizations are unique', async () => {
			const { error } = await coreInstance
				.authenticate('@alex')
				.organizations.create('$acme')

			assert.equal(error?.message, `Organization '$acme' already exists.`)
		})

		it('can list organizations for a user', async () => {
			const { organizations } = await coreInstance
				.authenticate('@alex')
				.organizations.list()
			check(organizations?.[0]).is(
				objectMatching({
					id: '$acme',
					role: Role.OWNER,
				}),
			)
		})
	})

	describe('projects', async () => {
		it('can create a new project', async () => {
			const events: CoreEvent[] = []
			coreInstance.on(CoreEventType.PROJECT_CREATED, (e) => events.push(e))
			coreInstance.on(CoreEventType.PROJECT_MEMBER_CREATED, (e) =>
				events.push(e),
			)

			const { project } = await coreInstance
				.authenticate('@alex')
				.organization('$acme')
				.projects.create('#teamstatus')

			check(project).is(
				objectMatching({
					id: '$acme#teamstatus',
				}),
			)
			check(events[0]).is(
				objectMatching({
					type: CoreEventType.PROJECT_CREATED,
					id: '$acme#teamstatus',
					owner: '@alex',
				}),
			)
			check(events[1]).is(
				objectMatching({
					type: CoreEventType.PROJECT_MEMBER_CREATED,
					project: '$acme#teamstatus',
					user: '@alex',
				}),
			)
		})

		it('ensures that projects are unique', async () => {
			const res = await coreInstance
				.authenticate('@alex')
				.organization('$acme')
				.projects.create('#teamstatus')

			assert.equal(
				res.error?.message,
				`Project '$acme#teamstatus' already exists.`,
			)
		})

		it('can list projects for a user', async () => {
			const { projects } = await coreInstance
				.authenticate('@alex')
				.organization('$acme')
				.projects.list()
			check(projects?.[0]).is(
				objectMatching({
					id: '$acme#teamstatus',
					role: Role.OWNER,
				}),
			)
		})

		describe('member', async () => {
			let invitationId: string
			it('allows project owners to invite other users to a project', async () => {
				const events: CoreEvent[] = []
				coreInstance.on(CoreEventType.PROJECT_MEMBER_INVITED, (e) =>
					events.push(e),
				)

				const { invitation } = await coreInstance
					.authenticate('@alex')
					.organization('$acme')
					.project('#teamstatus')
					.invite('@cameron')

				check(invitation).is(
					objectMatching({
						project: '$acme#teamstatus',
						invitee: '@cameron',
						inviter: '@alex',
						role: Role.MEMBER,
						id: stringMatching(/[0-7][0-9A-HJKMNP-TV-Z]{25}/gm) as any,
					}),
				)
				check(events[0]).is(
					objectMatching({
						type: CoreEventType.PROJECT_MEMBER_INVITED,
						project: '$acme#teamstatus',
						invitee: '@cameron',
						inviter: '@alex',
						role: Role.MEMBER,
						id: stringMatching(/[0-7][0-9A-HJKMNP-TV-Z]{25}/gm) as any,
					}),
				)

				invitationId = invitation?.id ?? ''
			})

			describe('invited member', async () => {
				const project = coreInstance
					.authenticate('@cameron')
					.organization('$acme')
					.project('#teamstatus')

				it('should not allow an uninvited user to post a status to a project', async () => {
					const { error } = await project.status.create('Should not work')
					assert.equal(
						error?.message,
						`Only members of '$acme#teamstatus' are allowed to create status.`,
					)
				})

				it('allows users to accept invitations', async () => {
					const { error } = await project.invitation(invitationId).accept()
					assert.equal(error, undefined)
				})

				it('should allow user after accepting their invitation to post a status to a project', async () => {
					const { error } = await project.status.create('Should not work')
					assert.equal(error, undefined)
				})
			})
		})

		describe('status', async () => {
			describe('create', async () => {
				it('can post a new status update', async () => {
					const events: CoreEvent[] = []
					coreInstance.on(CoreEventType.STATUS_CREATED, (e) => events.push(e))

					const { status } = await coreInstance
						.authenticate('@alex')
						.organization('$acme')
						.project('#teamstatus')
						.status.create(
							'Implemented ability to persist status updates for projects.',
						)

					check(status).is(
						objectMatching({
							project: '$acme#teamstatus',
							message:
								'Implemented ability to persist status updates for projects.',
							id: stringMatching(/[0-7][0-9A-HJKMNP-TV-Z]{25}/gm) as any,
						}),
					)
					check(events[0]).is(
						objectMatching({
							type: CoreEventType.STATUS_CREATED,
							project: '$acme#teamstatus',
							message:
								'Implemented ability to persist status updates for projects.',
							author: '@alex',
							id: stringMatching(/[0-7][0-9A-HJKMNP-TV-Z]{25}/gm) as any,
						}),
					)
				})

				it('allows posting status only for organization members', async () => {
					const project = coreInstance
						.authenticate('@blake')
						.organization('$acme')
						.project('#teamstatus')

					const { error } = await project.status.create(
						'I am not a member of the $acme organization, so I should not be allowed to create a status.',
					)
					assert.equal(
						error?.message,
						`Only members of '$acme#teamstatus' are allowed to create status.`,
					)
				})
			})

			describe('list', async () => {
				it('can list status for a project', async () => {
					const { status } = await coreInstance
						.authenticate('@alex')
						.organization('$acme')
						.project('#teamstatus')
						.status.list()
					check(status?.[0]).is(
						objectMatching({
							id: stringMatching(/[0-7][0-9A-HJKMNP-TV-Z]{25}/gm) as any,
							message:
								'Implemented ability to persist status updates for projects.',
							author: '@alex',
							project: '$acme#teamstatus',
							role: 'author',
						}),
					)
				})

				it('sorts status by creation time', async () => {
					const project = coreInstance
						.authenticate('@alex')
						.organization('$acme')
						.project('#teamstatus')

					await project.status.create('Status 1')
					await project.status.create('Status 2')
					await project.status.create('Status 3')

					const { status } = await project.status.list()

					assert.equal(status?.length, 5)

					// Newest status first
					assert.equal(status?.[0]?.message, 'Status 3')
				})

				it('allows only organization members to list status', async () => {
					const project = coreInstance
						.authenticate('@blake')
						.organization('$acme')
						.project('#teamstatus')

					const { error } = await project.status.list()
					assert.equal(
						error?.message,
						`Only members of '$acme' are allowed to list status.`,
					)
				})
			})
		})
	})
})
