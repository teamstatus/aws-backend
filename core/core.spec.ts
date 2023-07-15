import assert from 'node:assert/strict'
import { before, describe, test as it } from 'node:test'
import {
	aString,
	arrayContaining,
	check,
	definedValue,
	objectMatching,
	stringMatching,
	undefinedValue,
} from 'tsmatchers'
import { ulid } from 'ulid'
import { type CoreEvent } from './CoreEvent.js'
import { CoreEventType } from './CoreEventType.js'
import type { ProblemDetail } from './ProblemDetail.js'
import { Role } from './Role.js'
import { type EmailAuthContext, type UserAuthContext } from './auth.js'
import { notifier } from './notifier.js'
import type { DbContext } from './persistence/DbContext.js'
import { acceptProjectInvitation } from './persistence/acceptProjectInvitation.js'
import {
	createOrganization,
	type Organization,
} from './persistence/createOrganization.js'
import { createProject, type Project } from './persistence/createProject.js'
import { createReaction, type Reaction } from './persistence/createReaction.js'
import { createStatus, type Status } from './persistence/createStatus.js'
import { createUser } from './persistence/createUser.js'
import { deleteReaction } from './persistence/deleteReaction.js'
import { deleteStatus } from './persistence/deleteStatus.js'
import {
	emailLoginRequest,
	type EmailLoginRequest,
} from './persistence/emailLoginRequest.js'
import { emailPINLogin } from './persistence/emailPINLogin.js'
import type {
	Invitation,
	MemberInvitedEvent,
} from './persistence/inviteToProject.js'
import { inviteToProject } from './persistence/inviteToProject.js'
import { listOrganizationProjects } from './persistence/listOrganizationProjects.js'
import { listOrganizations } from './persistence/listOrganizations.js'
import { listProjects } from './persistence/listProjects.js'
import { listStatus } from './persistence/listStatus.js'
import { updateStatus } from './persistence/updateStatus.js'
import { aUlid } from './test/aUlid.js'
import { createTestDb } from './test/createTestDb.js'
import { isNotAnError } from './test/isNotAnError.js'
import { testDb } from './test/testDb.js'
import { listInvitations } from './persistence/listInvitations.js'

describe('core', async () => {
	const { TableName, db } = testDb()

	const dbContext: DbContext = {
		db,
		TableName,
	}

	const { on, notify } = notifier()

	before(createTestDb(dbContext))

	const alex: UserAuthContext = {
		email: 'alex@example.com',
		sub: '@alex',
	}

	const cameron: UserAuthContext = {
		email: 'cameron@example.com',
		sub: '@cameron',
	}

	describe('user management', async () => {
		describe('allows users to log-in with their email', async () => {
			let pin: string
			it('generates a login request', async () => {
				const events: CoreEvent[] = []
				on(CoreEventType.EMAIL_LOGIN_REQUESTED, (e) => events.push(e))
				const { loginRequest, pin: p } = (await emailLoginRequest(
					dbContext,
					notify,
				)(alex)) as { loginRequest: EmailLoginRequest; pin: string }
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

			it('prevents spamming log-in requests', async () => {
				const { error } = (await emailLoginRequest(
					dbContext,
					notify,
				)({
					email: 'alex@example.com',
				})) as { error: ProblemDetail }

				check(error).is(definedValue)
			})

			it('logs a user in using a PIN', async () => {
				const events: CoreEvent[] = []
				on(CoreEventType.EMAIL_LOGIN_PIN_SUCCESS, (e) => events.push(e))
				const { authContext } = (await emailPINLogin(
					dbContext,
					notify,
				)({
					email: 'alex@example.com',
					pin,
				})) as { authContext: EmailAuthContext }

				check(events[0]).is(
					objectMatching({
						type: CoreEventType.EMAIL_LOGIN_PIN_SUCCESS,
						email: 'alex@example.com',
					}),
				)

				check(authContext).is(
					objectMatching({
						email: 'alex@example.com',
						sub: undefinedValue,
					}),
				)
			})

			it('prevents re-using PINs', async () => {
				const { error } = (await emailPINLogin(
					dbContext,
					notify,
				)({
					email: 'alex@example.com',
					pin,
				})) as { error: ProblemDetail }

				check(error).is(definedValue)
			})

			it('allows users to claim a user ID', async () => {
				const events: CoreEvent[] = []
				on(CoreEventType.USER_CREATED, (e) => events.push(e))
				isNotAnError(
					await createUser(
						dbContext,
						notify,
					)({
						id: '@alex',
						name: 'Alex Doe',
						authContext: { email: 'alex@example.com' },
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
				const { pin } = (await emailLoginRequest(
					dbContext,
					notify,
				)({
					email: 'alex@example.com',
				})) as { loginRequest: EmailLoginRequest; pin: string }
				const { authContext } = (await emailPINLogin(
					dbContext,
					notify,
				)({
					email: 'alex@example.com',
					pin,
				})) as { authContext: UserAuthContext }
				check(authContext).is(objectMatching(alex))
			})
		})
	})

	describe('organizations', async () => {
		it('can create a new organization', async () => {
			const events: CoreEvent[] = []
			on(CoreEventType.ORGANIZATION_CREATED, (e) => events.push(e))
			isNotAnError(
				await createOrganization(dbContext, notify)(
					{ id: '$acme', name: 'ACME Inc.' },
					alex,
				),
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
			const { error } = (await createOrganization(dbContext, notify)(
				{ id: '$acme', name: 'ACME Inc.' },
				alex,
			)) as { error: ProblemDetail }

			assert.equal(error?.title, `Organization '$acme' already exists.`)
		})

		it('can list organizations for a user', async () => {
			const { organizations } = (await listOrganizations(dbContext)(alex)) as {
				organizations: Organization[]
			}
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
			on(CoreEventType.PROJECT_CREATED, (e) => events.push(e))
			on(CoreEventType.PROJECT_MEMBER_CREATED, (e) => events.push(e))
			isNotAnError(
				await createProject(dbContext, notify)(
					{ id: '$acme#teamstatus', name: 'Teamstatus' },
					alex,
				),
			)
			check(events[0]).is(
				objectMatching({
					type: CoreEventType.PROJECT_CREATED,
					id: '$acme#teamstatus',
					name: 'Teamstatus',
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
			const res = (await createProject(dbContext, notify)(
				{ id: '$acme#teamstatus', name: 'Teamstatus' },
				alex,
			)) as { error: ProblemDetail }
			assert.equal(
				res.error?.title,
				`Project '$acme#teamstatus' already exists.`,
			)
		})

		it('can list projects for an organization', async () => {
			const { projects } = (await listOrganizationProjects(dbContext)(
				'$acme',
				alex,
			)) as { projects: Project[] }
			check(projects?.[0]).is(
				objectMatching({
					id: '$acme#teamstatus',
					name: 'Teamstatus',
				}),
			)
		})

		describe('member', async () => {
			it('allows project owners to invite other users to a project', async () => {
				// Users have to exist to be invited
				await createUser(
					dbContext,
					notify,
				)({
					id: '@cameron',
					name: 'Cameron',
					authContext: cameron,
				})

				const events: MemberInvitedEvent[] = []
				on(CoreEventType.PROJECT_MEMBER_INVITED, (e) =>
					events.push(e as MemberInvitedEvent),
				)

				isNotAnError(
					await inviteToProject(dbContext, notify)(
						'@cameron',
						'$acme#teamstatus',
						alex,
					),
				)
				check(events[0]).is(
					objectMatching({
						type: CoreEventType.PROJECT_MEMBER_INVITED,
						project: '$acme#teamstatus',
						invitee: '@cameron',
						inviter: '@alex',
						role: Role.MEMBER,
					}),
				)
			})

			it('should not allow to invite non-existing users', async () => {
				const { error } = (await inviteToProject(dbContext, notify)(
					'@nobody',
					'$acme#teamstatus',
					alex,
				)) as { error: ProblemDetail }
				assert.equal(error?.title, `User @nobody does not exist.`)
			})

			describe('invited member', async () => {
				it('should not allow an uninvited user to post a status to a project', async () => {
					const { error } = (await createStatus(dbContext, notify)(
						ulid(),
						'$acme#teamstatus',
						'Should not work',
						cameron,
					)) as { error: ProblemDetail }
					assert.equal(
						error?.title,
						`Only members of '$acme#teamstatus' are allowed to create status.`,
					)
				})

				it('should list open invites for a user', async () => {
					const { invitations } = (await listInvitations(dbContext)(
						cameron,
					)) as { invitations: Invitation[] }
					assert.deepEqual(invitations, [
						{
							id: '$acme#teamstatus@cameron',
							role: Role.MEMBER,
						},
					])
				})

				it('allows users to accept invitations', async () => {
					const { error } = (await acceptProjectInvitation(dbContext, notify)(
						'$acme#teamstatus',
						cameron,
					)) as { error: ProblemDetail }
					assert.equal(error, undefined)
				})

				it('should allow user after accepting their invitation to post a status to a project', async () => {
					const { error } = (await createStatus(dbContext, notify)(
						ulid(),
						'$acme#teamstatus',
						'Should work now!',
						cameron,
					)) as { error: ProblemDetail }
					assert.equal(error, undefined)
				})
			})
		})

		describe('status', async () => {
			describe('create', async () => {
				it('can post a new status update', async () => {
					const events: CoreEvent[] = []
					on(CoreEventType.STATUS_CREATED, (e) => events.push(e))

					const id = ulid()
					isNotAnError(
						await createStatus(dbContext, notify)(
							id,
							'$acme#teamstatus',
							'Implemented ability to persist status updates for projects.',
							alex,
						),
					)
					check(events[0]).is(
						objectMatching({
							type: CoreEventType.STATUS_CREATED,
							project: '$acme#teamstatus',
							message:
								'Implemented ability to persist status updates for projects.',
							author: '@alex',
							id,
						}),
					)
				})

				it('allows posting status only for organization members', async () => {
					const { error } = (await createStatus(dbContext, notify)(
						ulid(),
						'$acme#teamstatus',
						'I am not a member of the $acme organization, so I should not be allowed to create a status.',
						{ email: 'blake@example.com', sub: '@blake' },
					)) as { error: ProblemDetail }
					assert.equal(
						error?.title,
						`Only members of '$acme#teamstatus' are allowed to create status.`,
					)
				})
			})

			describe('edit', async () => {
				const statusId = ulid()
				it('allows status to be edited by the author', async () => {
					// Create the status
					isNotAnError(
						await createStatus(dbContext, notify)(
							statusId,
							'$acme#teamstatus',
							'Status with an typo',
							alex,
						),
					)

					// Updated
					isNotAnError(
						await updateStatus(dbContext, notify)(
							statusId,
							'Status with a typo',
							1,
							alex,
						),
					)
					// Fetch
					const { status: statusList } = (await listStatus(dbContext)(
						{ projectId: '$acme#teamstatus' },
						alex,
					)) as {
						status: Status[]
					}
					check(statusList).is(
						arrayContaining(
							objectMatching({
								message: 'Status with a typo',
								version: 2,
							}),
						),
					)
				})

				it('allows status to be deleted by the author', async () => {
					const { error } = (await deleteStatus(dbContext, notify)(
						statusId,
						alex,
					)) as { error: ProblemDetail }

					assert.equal(error, undefined)
				})
			})

			describe('list', async () => {
				it('can list status for a project', async () => {
					const { status } = (await listStatus(dbContext)(
						{ projectId: '$acme#teamstatus' },
						alex,
					)) as { status: Status[] }
					check(status?.[0]).is(
						objectMatching({
							id: aString,
							message:
								'Implemented ability to persist status updates for projects.',
							author: '@alex',
							project: '$acme#teamstatus',
						}),
					)
				})

				it('sorts status by creation time', async () => {
					await createStatus(dbContext, notify)(
						ulid(),
						'$acme#teamstatus',
						'Status 1',
						alex,
					)
					await createStatus(dbContext, notify)(
						ulid(),
						'$acme#teamstatus',
						'Status 2',
						alex,
					)
					await createStatus(dbContext, notify)(
						ulid(),
						'$acme#teamstatus',
						'Status 3',
						alex,
					)

					const { status } = (await listStatus(dbContext)(
						{ projectId: '$acme#teamstatus' },
						alex,
					)) as {
						status: Status[]
					}

					assert.equal(status?.length, 5)

					// Newest status first
					assert.equal(status?.[0]?.message, 'Status 3')
				})

				it('allows only organization members to list status', async () => {
					const { error } = (await listStatus(dbContext)(
						{ projectId: '$acme#teamstatus' },
						{
							email: 'blake@example.com',
							sub: '@blake',
						},
					)) as { error: ProblemDetail }
					assert.equal(
						error?.title,
						`Only members of '$acme#teamstatus' are allowed to list status.`,
					)
				})
			})

			describe('reactions', async () => {
				// Reactions can have special roles
				enum ReactionRole {
					// A significant thing happened, makes the status stand out from others in the list of status
					SIGNIFICANT = 'SIGNIFICANT',
					// The status needs to be discussed during the next sync meeting, this will collect this status in a separate list of open questions during the next sync meeting
					QUESTION = 'QUESTION',
				}

				const newVersionRelease: Reaction = {
					description: 'A new version was released',
					emoji: '🚀',
					role: ReactionRole.SIGNIFICANT,
				}

				const thumbsUp = {
					emoji: '👍',
				}

				const projectId = `#test-${ulid()}`
				const statusId = ulid()
				const reactionId = ulid()

				it('allows authors to attach a reaction', async () => {
					const events: CoreEvent[] = []
					on(CoreEventType.REACTION_CREATED, (e) => events.push(e))

					await createProject(dbContext, notify)(
						{ id: `$acme${projectId}`, name: `Project ${projectId}` },
						alex,
					)

					isNotAnError(
						await createStatus(dbContext, notify)(
							statusId,
							`$acme${projectId}`,
							`I've released a new version!`,
							alex,
						),
					)

					isNotAnError(
						await createReaction(dbContext, notify)(
							{
								id: reactionId,
								status: statusId,
								...newVersionRelease,
							},
							alex,
						),
					)

					check(events[0]).is(
						objectMatching({
							type: CoreEventType.REACTION_CREATED,
							status: statusId,
							author: '@alex',
							id: reactionId,
							...newVersionRelease,
						}),
					)
				})

				it('allows project members to attach a reaction', async () => {
					// Users have to exist to be invited
					await createUser(
						dbContext,
						notify,
					)({
						id: '@blake',
						name: 'Blake',
						authContext: { email: 'blake@example.com' },
					})

					isNotAnError(
						await inviteToProject(dbContext, notify)(
							'@blake',
							`$acme${projectId}`,
							alex,
						),
					)

					await acceptProjectInvitation(dbContext, notify)(
						`$acme${projectId}`,
						{
							email: 'blake@example.com',
							sub: '@blake',
						},
					)

					const { error } = (await createReaction(dbContext, notify)(
						{
							id: ulid(),
							status: statusId,
							...thumbsUp,
						},
						{ email: 'blake@example.com', sub: '@blake' },
					)) as { error: ProblemDetail }

					assert.equal(error, undefined)
				})

				it('returns reactions with the status', async () => {
					const { status } = (await listStatus(dbContext)(
						{ projectId: `$acme${projectId}` },
						alex,
					)) as { status: Status[] }

					check(status[0]?.reactions[0]).is(
						objectMatching({
							author: '@alex',
							id: aUlid(),
							...newVersionRelease,
						}),
					)

					check(status[0]?.reactions[1]).is(
						objectMatching({
							author: '@blake',
							id: aUlid(),
							...thumbsUp,
						}),
					)
				})

				it('allows reactions to be deleted by the author', async () => {
					const { error } = (await deleteReaction(dbContext, notify)(
						reactionId,
						alex,
					)) as { error: ProblemDetail }

					assert.equal(error, undefined)

					const { status } = (await listStatus(dbContext)(
						{ projectId: `$acme${projectId}` },
						alex,
					)) as { status: Status[] }

					assert.equal(
						status.find(({ id }) => id === statusId)?.reactions.length,
						1,
					)
				})
			})
		})

		describe('projects', async () => {
			it('can list projects for a user', async () => {
				const { projects } = (await listProjects(dbContext)(alex)) as {
					projects: Project[]
				}
				check(projects).is(
					arrayContaining(
						objectMatching({
							id: '$acme#teamstatus',
							name: 'Teamstatus',
						}),
					),
				)
			})

			it('allows project members to list status', async () => {
				const { status } = (await listStatus(dbContext)(
					{ projectId: '$acme#teamstatus' },
					cameron,
				)) as { status: Status[] }
				assert.equal(status.length, 5)
			})
		})
	})
})
