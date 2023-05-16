import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import jwt from 'jsonwebtoken'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { before, describe, test as it } from 'node:test'
import { check, definedValue, objectMatching, stringMatching } from 'tsmatchers'
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
import type { PersistedUser } from './persistence/createUser.js'
import type { EmailLoginRequest } from './persistence/emailLoginRequest.js'
import type { PersistedInvitation } from './persistence/inviteToProject.js'

const isCI = process.env.CI !== undefined
const testDb = () => {
	if (isCI) {
		return {
			table: process.env.TABLE_NAME ?? '',
			db: new DynamoDBClient({}),
		}
	}
	return {
		table: `teamstatus-${ulid()}`,
		db: new DynamoDBClient({
			endpoint: 'http://localhost:8000/',
			region: 'eu-west-1',
		}),
	}
}

describe('core', async () => {
	const { table, db } = testDb()
	const privateKey = execSync(
		'openssl ecparam -name prime256v1 -genkey',
	).toString()
	const publicKey = execSync('openssl ec -pubout', {
		input: privateKey,
	}).toString()

	const coreInstance = core(
		{
			db,
			table,
		},
		{
			privateKey,
			publicKey,
		},
	)

	before(async () => {
		if (isCI) {
			console.log(`Using existing table ${table}.`)
			return
		}
		try {
			await createTable(db, table)
		} catch (err) {
			console.error(`Failed to create table: ${(err as Error).message}!`)
			throw err
		}
		console.log(`Table ${table} created.`)
	})

	describe('user management', async () => {
		describe('allows users to log-in with their email', async () => {
			let pin: string
			it('generates a login request', async () => {
				const events: CoreEvent[] = []
				coreInstance.on(CoreEventType.EMAIL_LOGIN_REQUESTED, (e) =>
					events.push(e),
				)
				const { loginRequest, pin: p } = (await coreInstance.emailLoginRequest({
					email: 'alex@example.com',
				})) as { loginRequest: EmailLoginRequest; pin: string }
				check(loginRequest).is(
					objectMatching({
						email: 'alex@example.com',
					}),
				)
				check(events[0]).is(
					objectMatching({
						type: CoreEventType.EMAIL_LOGIN_REQUESTED,
						email: 'alex@example.com',
					}),
				)
				check(p).is(stringMatching(/^[0-9]{8}$/))
				pin = p
			})

			let token: string

			it('logs a user in using a PIN', async () => {
				const events: CoreEvent[] = []
				coreInstance.on(CoreEventType.EMAIL_LOGIN_PIN_SUCCESS, (e) =>
					events.push(e),
				)
				const { token: t } = (await coreInstance.emailPINLogin({
					email: 'alex@example.com',
					pin,
				})) as { token: string }

				token = t

				check(token).is(definedValue)

				const parsedToken = jwt.verify(token, publicKey)
				check(parsedToken).is(
					objectMatching({
						iat: Math.floor(Date.now() / 1000),
						exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
						// It should not have a username associated
						sub: undefined,
					}),
				)
				check(events[0]).is(
					objectMatching({
						type: CoreEventType.EMAIL_LOGIN_PIN_SUCCESS,
						email: 'alex@example.com',
					}),
				)

				const payload = jwt.decode(token)
				check(payload).is(
					objectMatching({
						email: 'alex@example.com',
					}),
				)
			})

			it('prevents re-using PINs', async () => {
				const { error } = (await coreInstance.emailPINLogin({
					email: 'alex@example.com',
					pin,
				})) as { error: Error }

				check(error).is(definedValue)
			})

			it('allows users to claim a user ID', async () => {
				const events: CoreEvent[] = []
				coreInstance.on(CoreEventType.USER_CREATED, (e) => events.push(e))
				const { user } = (await coreInstance.createUser({
					id: '@alex',
					name: 'Alex Doe',
					email: 'alex@example.com',
				})) as { user: PersistedUser }
				check(user).is(
					objectMatching({
						id: '@alex',
						name: 'Alex Doe',
						email: 'alex@example.com',
					}),
				)
				check(events[0]).is(
					objectMatching({
						type: CoreEventType.USER_CREATED,
						id: '@alex',
						name: 'Alex Doe',
						email: 'alex@example.com',
					}),
				)
			})

			it(`adds the user's ID to the token after they have claimed a user ID`, async () => {
				const { pin } = (await coreInstance.emailLoginRequest({
					email: 'alex@example.com',
				})) as { loginRequest: EmailLoginRequest; pin: string }
				const { token } = (await coreInstance.emailPINLogin({
					email: 'alex@example.com',
					pin,
				})) as { token: string }
				check(token).is(definedValue)
				const parsedToken = jwt.verify(token, publicKey)
				check(parsedToken).is(
					objectMatching({
						sub: '@alex',
					}),
				)
			})
		})
	})

	describe('organizations', async () => {
		it('can create a new organization', async () => {
			const events: CoreEvent[] = []
			coreInstance.on(CoreEventType.ORGANIZATION_CREATED, (e) => events.push(e))
			const { organization } = (await coreInstance.createOrganization(
				{ id: '$acme', name: 'ACME Inc.' },
				{
					sub: '@alex',
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
					sub: '@alex',
				},
			)) as { error: Error }

			assert.equal(error?.message, `Organization '$acme' already exists.`)
		})

		it('can list organizations for a user', async () => {
			const { organizations } = (await coreInstance.listOrganizations({
				sub: '@alex',
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
					sub: '@alex',
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
					sub: '@alex',
				},
			)) as { error: Error }

			assert.equal(
				res.error?.message,
				`Project '$acme#teamstatus' already exists.`,
			)
		})

		it('can list projects for a user', async () => {
			const { projects } = (await coreInstance.listProjects('$acme', {
				sub: '@alex',
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
					{ sub: '@alex' },
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
						{ sub: '@cameron' },
					)) as { error: Error }
					assert.equal(
						error?.message,
						`Only members of '$acme#teamstatus' are allowed to create status.`,
					)
				})

				it('allows users to accept invitations', async () => {
					const { error } = (await coreInstance.acceptProjectInvitation(
						invitationId,
						{ sub: '@cameron' },
					)) as { error: Error }
					assert.equal(error, undefined)
				})

				it('should allow user after accepting their invitation to post a status to a project', async () => {
					const { error } = (await coreInstance.createStatus(
						'$acme#teamstatus',
						'Should work now!',
						{ sub: '@cameron' },
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
						{ sub: '@alex' },
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
						{ sub: '@blake' },
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
						{ sub: '@alex' },
					)) as { status: PersistedStatus }
					statusId = status.id

					// Updated
					const { status: updated } = (await coreInstance.updateStatus(
						statusId,
						'Status with a typo',
						1,
						{
							sub: '@alex',
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
						{ sub: '@alex' },
					)) as {
						status: PersistedStatus[]
					}
					assert.equal(statusList?.[0]?.message, 'Status with a typo')
				})

				it('allows status to be deleted by the author', async () => {
					const { error } = (await coreInstance.deleteStatus(statusId, {
						sub: '@alex',
					})) as { error: Error }

					assert.equal(error, undefined)
				})
			})

			describe('list', async () => {
				it('can list status for a project', async () => {
					const { status } = (await coreInstance.listStatus(
						'$acme#teamstatus',
						{ sub: '@alex' },
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
						sub: '@alex',
					})
					await coreInstance.createStatus('$acme#teamstatus', 'Status 2', {
						sub: '@alex',
					})
					await coreInstance.createStatus('$acme#teamstatus', 'Status 3', {
						sub: '@alex',
					})

					const { status } = (await coreInstance.listStatus(
						'$acme#teamstatus',
						{ sub: '@alex' },
					)) as {
						status: PersistedStatus[]
					}

					assert.equal(status?.length, 5)

					// Newest status first
					assert.equal(status?.[0]?.message, 'Status 3')
				})

				it('allows only organization members to list status', async () => {
					const { error } = (await coreInstance.listStatus('$acme#teamstatus', {
						sub: '@blake',
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
							sub: '@alex',
						},
					)

					const { status } = (await coreInstance.createStatus(
						`$acme${projectId}`,
						`I've released a new version!`,
						{ sub: '@alex' },
					)) as { status: PersistedStatus }

					statusId = status.id

					const { reaction } = (await coreInstance.createReaction(
						statusId,
						newVersionRelease,
						{ sub: '@alex' },
					)) as { reaction: PersistedReaction }

					check(reaction).is(
						objectMatching({
							status: statusId,
							id: stringMatching(/[0-7][0-9A-HJKMNP-TV-Z]{25}/gm) as any,
							...newVersionRelease,
						}),
					)
					check(events[0]).is(
						objectMatching({
							type: CoreEventType.REACTION_CREATED,
							status: statusId,
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
							sub: '@alex',
						},
					)) as { invitation: PersistedInvitation }
					await coreInstance.acceptProjectInvitation(invitation.id, {
						sub: '@blake',
					})

					const { error } = (await coreInstance.createReaction(
						statusId,
						thumbsUp,
						{
							sub: '@blake',
						},
					)) as { error: Error }

					assert.equal(error, undefined)
				})

				it('returns reactions with the status', async () => {
					const { status } = (await coreInstance.listStatus(
						`$acme${projectId}`,
						{ sub: '@alex' },
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
