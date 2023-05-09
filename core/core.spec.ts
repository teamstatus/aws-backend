import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import assert from 'node:assert/strict'
import { before, describe, test as it } from 'node:test'
import { check, objectMatching, stringMatching } from 'tsmatchers'
import { ulid } from 'ulid'
import { CoreEventType, Role, core, type CoreEvent } from './core.js'
import type { PersistedOrganization } from './persistence/createOrganization.js'
import type { PersistedProject } from './persistence/createProject.js'
import {
	newVersionRelease,
	thumbsUp,
	type PersistedReaction,
} from './persistence/createReaction.js'
import type { PersistedStatus } from './persistence/createStatus.js'
import { createTable } from './persistence/createTable.js'
import type { PersistedInvitation } from './persistence/inviteToProject.js'

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
			const { organization } = (await coreInstance.createOrganization(
				{ id: '$acme', name: 'ACME Inc.' },
				{
					userId: '@alex',
				},
			)) as { organization: PersistedOrganization }
			check(organization).is(
				objectMatching({
					id: '$acme',
					name: 'ACME Inc.',
				}),
			)
			check(events[0]).is(
				objectMatching({
					type: CoreEventType.ORGANIZATION_CREATED,
					id: '$acme',
					name: 'ACME Inc.',
					owner: '@alex',
				}),
			)
		})

		it('ensures that organizations are unique', async () => {
			const { error } = (await coreInstance.createOrganization(
				{ id: '$acme' },
				{
					userId: '@alex',
				},
			)) as { error: Error }

			assert.equal(error?.message, `Organization '$acme' already exists.`)
		})

		it('can list organizations for a user', async () => {
			const { organizations } = (await coreInstance.listOrganizations({
				userId: '@alex',
			})) as { organizations: PersistedOrganization[] }
			check(organizations?.[0]).is(
				objectMatching({
					id: '$acme',
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

			const { project } = (await coreInstance.createProject(
				{ id: '$acme#teamstatus', name: 'Teamstatus', color: '#ff0000' },
				{
					userId: '@alex',
				},
			)) as { project: PersistedProject }

			check(project).is(
				objectMatching({
					id: '$acme#teamstatus',
					name: 'Teamstatus',
					color: '#ff0000',
				}),
			)
			check(events[0]).is(
				objectMatching({
					type: CoreEventType.PROJECT_CREATED,
					id: '$acme#teamstatus',
					name: 'Teamstatus',
					color: '#ff0000',
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
			const res = (await coreInstance.createProject(
				{ id: '$acme#teamstatus' },
				{
					userId: '@alex',
				},
			)) as { error: Error }

			assert.equal(
				res.error?.message,
				`Project '$acme#teamstatus' already exists.`,
			)
		})

		it('can list projects for a user', async () => {
			const { projects } = (await coreInstance.listProjects('$acme', {
				userId: '@alex',
			})) as { projects: PersistedProject[] }
			check(projects?.[0]).is(
				objectMatching({
					id: '$acme#teamstatus',
					name: 'Teamstatus',
					color: '#ff0000',
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

				const { invitation } = (await coreInstance.inviteToProject(
					'@cameron',
					'$acme#teamstatus',
					{ userId: '@alex' },
				)) as { invitation: PersistedInvitation }

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
				it('should not allow an uninvited user to post a status to a project', async () => {
					const { error } = (await coreInstance.createStatus(
						'$acme#teamstatus',
						'Should not work',
						{ userId: '@cameron' },
					)) as { error: Error }
					assert.equal(
						error?.message,
						`Only members of '$acme#teamstatus' are allowed to create status.`,
					)
				})

				it('allows users to accept invitations', async () => {
					const { error } = (await coreInstance.acceptProjectInvitation(
						invitationId,
						{ userId: '@cameron' },
					)) as { error: Error }
					assert.equal(error, undefined)
				})

				it('should allow user after accepting their invitation to post a status to a project', async () => {
					const { error } = (await coreInstance.createStatus(
						'$acme#teamstatus',
						'Should work now!',
						{ userId: '@cameron' },
					)) as { error: Error }
					assert.equal(error, undefined)
				})
			})
		})

		describe('status', async () => {
			describe('create', async () => {
				it('can post a new status update', async () => {
					const events: CoreEvent[] = []
					coreInstance.on(CoreEventType.STATUS_CREATED, (e) => events.push(e))

					const { status } = (await coreInstance.createStatus(
						'$acme#teamstatus',
						'Implemented ability to persist status updates for projects.',
						{ userId: '@alex' },
					)) as { status: PersistedStatus }

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
					const { error } = (await coreInstance.createStatus(
						'$acme#teamstatus',
						'I am not a member of the $acme organization, so I should not be allowed to create a status.',
						{ userId: '@blake' },
					)) as { error: Error }
					assert.equal(
						error?.message,
						`Only members of '$acme#teamstatus' are allowed to create status.`,
					)
				})
			})

			describe('edit', async () => {
				let statusId: string
				it('allows status to be edited by the author', async () => {
					// Create the status
					const { status } = (await coreInstance.createStatus(
						'$acme#teamstatus',
						'Status with an typo',
						{ userId: '@alex' },
					)) as { status: PersistedStatus }
					statusId = status.id

					// Updated
					const { status: updated } = (await coreInstance.updateStatus(
						statusId,
						'Status with a typo',
						1,
						{
							userId: '@alex',
						},
					)) as { status: PersistedStatus }
					check(updated).is(
						objectMatching({
							version: 2,
						}),
					)

					// Fetch
					const { status: statusList } = (await coreInstance.listStatus(
						'$acme#teamstatus',
						{ userId: '@alex' },
					)) as {
						status: PersistedStatus[]
					}
					assert.equal(statusList?.[0]?.message, 'Status with a typo')
				})

				it('allows status to be deleted by the author', async () => {
					const { error } = (await coreInstance.deleteStatus(statusId, {
						userId: '@alex',
					})) as { error: Error }

					assert.equal(error, undefined)
				})
			})

			describe('list', async () => {
				it('can list status for a project', async () => {
					const { status } = (await coreInstance.listStatus(
						'$acme#teamstatus',
						{ userId: '@alex' },
					)) as { status: PersistedStatus[] }
					check(status?.[0]).is(
						objectMatching({
							id: stringMatching(/[0-7][0-9A-HJKMNP-TV-Z]{25}/gm) as any,
							message:
								'Implemented ability to persist status updates for projects.',
							author: '@alex',
							project: '$acme#teamstatus',
						}),
					)
				})

				it('sorts status by creation time', async () => {
					await coreInstance.createStatus('$acme#teamstatus', 'Status 1', {
						userId: '@alex',
					})
					await coreInstance.createStatus('$acme#teamstatus', 'Status 2', {
						userId: '@alex',
					})
					await coreInstance.createStatus('$acme#teamstatus', 'Status 3', {
						userId: '@alex',
					})

					const { status } = (await coreInstance.listStatus(
						'$acme#teamstatus',
						{ userId: '@alex' },
					)) as {
						status: PersistedStatus[]
					}

					assert.equal(status?.length, 5)

					// Newest status first
					assert.equal(status?.[0]?.message, 'Status 3')
				})

				it('allows only organization members to list status', async () => {
					const { error } = (await coreInstance.listStatus('$acme#teamstatus', {
						userId: '@blake',
					})) as { error: Error }
					assert.equal(
						error?.message,
						`Only members of '$acme' are allowed to list status.`,
					)
				})
			})

			describe('reactions', async () => {
				const projectId = `#test-${ulid()}`
				let statusId: string
				it('allows authors to attach a reaction', async () => {
					const events: CoreEvent[] = []
					coreInstance.on(CoreEventType.REACTION_CREATED, (e) => events.push(e))

					await coreInstance.createProject(
						{ id: `$acme${projectId}` },
						{
							userId: '@alex',
						},
					)

					const { status } = (await coreInstance.createStatus(
						`$acme${projectId}`,
						`I've released a new version!`,
						{ userId: '@alex' },
					)) as { status: PersistedStatus }

					statusId = status.id as string

					const { reaction } = (await coreInstance.createReaction(
						status?.id as string,
						newVersionRelease,
						{ userId: '@alex' },
					)) as { reaction: PersistedReaction }

					check(reaction).is(
						objectMatching({
							status: status?.id,
							id: stringMatching(/[0-7][0-9A-HJKMNP-TV-Z]{25}/gm) as any,
							...newVersionRelease,
						}),
					)
					check(events[0]).is(
						objectMatching({
							type: CoreEventType.REACTION_CREATED,
							status: status?.id as string,
							author: '@alex',
							id: stringMatching(/[0-7][0-9A-HJKMNP-TV-Z]{25}/gm) as any,
							...newVersionRelease,
						}),
					)
				})

				it('allows project members to attach a reaction', async () => {
					const { invitation } = (await coreInstance.inviteToProject(
						'@blake',
						`$acme${projectId}`,
						{
							userId: '@alex',
						},
					)) as { invitation: PersistedInvitation }
					await coreInstance.acceptProjectInvitation(invitation.id, {
						userId: '@blake',
					})

					const { error } = (await coreInstance.createReaction(
						statusId,
						thumbsUp,
						{
							userId: '@blake',
						},
					)) as { error: Error }

					assert.equal(error, undefined)
				})

				it('returns reactions with the status', async () => {
					const { status } = (await coreInstance.listStatus(
						`$acme${projectId}`,
						{ userId: '@alex' },
					)) as { status: PersistedStatus[] }

					check(status[0]?.reactions[0]).is(
						objectMatching({
							author: '@alex',
							id: stringMatching(/[0-7][0-9A-HJKMNP-TV-Z]{25}/gm) as any,
							...newVersionRelease,
						}),
					)

					check(status[0]?.reactions[1]).is(
						objectMatching({
							author: '@blake',
							id: stringMatching(/[0-7][0-9A-HJKMNP-TV-Z]{25}/gm) as any,
							...thumbsUp,
						}),
					)
				})
			})
		})
	})
})
