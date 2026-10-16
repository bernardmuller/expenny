import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, ExternalLink, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { AppHeader } from '@/components/app-header'
import { Layout } from '@/components/layouts/Layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ThemeToggle } from '@/components/ui/theme-toggle'

import { cn } from '@/lib/utils/cn'

import { requireAuth } from '@/lib/auth/route-guard'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'
import { queryKeys } from '@/lib/http/query-keys'
import {
	getChatsByUserQueryOptions,
} from '@/lib/http/queries/chats/getChatsByUser'
import {
	getVerificationByValueQueryOptions,
} from '@/lib/http/queries/verifications/getVerificationByValue'
import { useCreateVerification } from '@/lib/http/hooks/use-create-verification'

export const Route = createFileRoute('/archive/profile/penny-bot')({
	beforeLoad: () => requireAuth(),
	loader: async ({ context }) => {
		const userIdResult = getUserIdFromAccessToken()
		if (userIdResult.isErr()) return
		const userId = userIdResult.value
		await Promise.all([
			context.queryClient.ensureQueryData(getChatsByUserQueryOptions(userId)),
			context.queryClient.ensureQueryData(
				getVerificationByValueQueryOptions(userId),
			),
		])
	},
	component: PennyBotPage,
})

const BOT_URL = import.meta.env.VITE_PENNY_BOT_URL as string | undefined

function PennyBotPage() {
	const router = useRouter()
	const queryClient = useQueryClient()
	const createVerification = useCreateVerification()

	const userIdResult = getUserIdFromAccessToken()
	if (userIdResult.isErr()) {
		throw new Error('Unable to get user information')
	}
	const userId = userIdResult.value

	const { data: chat } = useSuspenseQuery(getChatsByUserQueryOptions(userId))
	const { data: verification } = useSuspenseQuery(
		getVerificationByValueQueryOptions(userId),
	)

	const handleEnable = (checked: boolean) => {
		if (!checked) return
		createVerification.mutate()
	}

	const handleRefresh = () => {
		queryClient.invalidateQueries({ queryKey: queryKeys.chats.byUser(userId) })
		queryClient.invalidateQueries({
			queryKey: queryKeys.verifications.byValue(userId),
		})
	}

	return (
		<>
			<AppHeader.Root>
				<AppHeader.Left>
					<AppHeader.Back onBack={() => router.history.back()} />
				</AppHeader.Left>
				<AppHeader.Center>
					<AppHeader.Title>Penny Bot</AppHeader.Title>
				</AppHeader.Center>
				<AppHeader.Right>
					<ThemeToggle />
				</AppHeader.Right>
			</AppHeader.Root>

			<Layout>
				<Card className="w-full">
					<CardHeader className="items-center">
						<div className="relative mx-auto h-32 w-32">
							<img
								src='/penny_bot.png'
								alt='Penny Bot'
								className="h-32 w-32 rounded-full object-contain"
							/>
							<StatusBadge
								status={
									chat ? 'online' : verification ? 'pending' : 'offline'
								}
								className="absolute -right-1 bottom-1"
							/>
						</div>
						<CardTitle className="pt-2 text-center">Penny</CardTitle>
						<p className="text-center text-sm text-gray-300 font-mono">@expenny_bot</p>
					</CardHeader>
					<CardContent className="space-y-4">
						{chat ? (
							<LinkedState chatId={chat.chatId ?? ''} />
						) : verification ? (
							<PendingState
								identifier={verification.identifier}
								botUrl={BOT_URL}
								onRefresh={handleRefresh}
							/>
						) : (
							<DisconnectedState
								onEnable={handleEnable}
								isPending={createVerification.isPending}
							/>
						)}
					</CardContent>
				</Card>
			</Layout>
		</>
	)
}

type Status = 'online' | 'pending' | 'offline'

function StatusBadge({
	status,
	className,
}: {
	status: Status
	className?: string
}) {
	const label =
		status === 'online'
			? 'Online'
			: status === 'pending'
				? 'Pending'
				: 'Offline'

	const dotColor =
		status === 'online'
			? 'bg-emerald-500'
			: status === 'pending'
				? 'bg-amber-500'
				: 'bg-muted-foreground'

	return (
		<Badge
			variant="outline"
			className={cn('gap-1.5 border-border shadow-sm', className)}
			aria-label={`Status: ${label}`}
		>
			<span className={cn('h-2 w-2 rounded-full', dotColor)} />
			{label}
		</Badge>
	)
}

function LinkedState({ chatId }: { chatId: string }) {
	return (
		<div className="space-y-3">
			<div className="space-y-1.5">
				<label
					htmlFor="penny-bot-chat-id"
					className="text-muted-foreground text-sm"
				>
					Chat ID
				</label>
				<Input
					id="penny-bot-chat-id"
					value={chatId}
					readOnly
					disabled
					className="font-mono"
				/>
			</div>
		</div>
	)
}

function PendingState({
	identifier,
	botUrl,
	onRefresh,
}: {
	identifier: string
	botUrl: string | undefined
	onRefresh: () => void
}) {
	const command = `/start ${identifier}`
	const [copied, setCopied] = useState(false)

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(command)
			setCopied(true)
			toast.success('Copied to clipboard')
			setTimeout(() => setCopied(false), 1500)
		} catch {
			toast.error('Could not copy — copy manually')
		}
	}

	return (
		<div className="space-y-4">
			<ol className="space-y-4 text-sm">
				<li className="space-y-2">
					<p className="text-foreground font-medium">
						1. Open Penny Bot on Telegram
					</p>
					<Button asChild variant="outline" className="w-full" disabled={!botUrl}>
						<a href={botUrl} target="_blank" rel="noreferrer">
							<ExternalLink className="mr-2 h-4 w-4" />
							Open Penny Bot
						</a>
					</Button>
				</li>
				<li className="space-y-2">
					<p className="text-foreground font-medium">2. Send this message:</p>
					<div className="flex items-stretch gap-2">
						<code
							className="bg-muted text-foreground flex-1 rounded-md px-3 py-2
                font-mono text-xs break-all"
						>
							{command}
						</code>
						<Button
							type='button'
							variant='outline'
							size='icon'
							onClick={handleCopy}
							aria-label="Copy command"
						>
							<Copy className="h-4 w-4" />
						</Button>
					</div>
					{copied && (
						<p className="text-muted-foreground text-xs">Copied!</p>
					)}
				</li>
				<li className="space-y-2">
					<p className="text-foreground font-medium">
						3. After sending, refresh below
					</p>
					<Button
						type='button'
						variant='outline'
						className='w-full'
						onClick={onRefresh}
					>
						<RefreshCw className="mr-2 h-4 w-4" />
						I&apos;ve sent the message — refresh
					</Button>
				</li>
			</ol>
		</div>
	)
}

function DisconnectedState({
	onEnable,
	isPending,
}: {
	onEnable: (checked: boolean) => void
	isPending: boolean
}) {
	return (
		<div className="space-y-4">
			<p className="text-muted-foreground text-sm">
				Connect your Telegram account to use Penny Bot.
			</p>
			<div className="flex items-center justify-between">
				<div>
					<p className="text-foreground font-medium">Enable Penny Bot</p>
					<p className="text-muted-foreground text-sm">
						Generates a one-time link code
					</p>
				</div>
				<Button
					disabled={isPending}
					onClick={() => onEnable(true)}
				>
					Enable
				</Button>
			</div>
		</div>
	)
}
