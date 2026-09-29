import { toast } from 'sonner'
import { client, toResult } from '../../client'
import { queryKeys } from '../../query-keys'
import { withSession } from '../../with-token'
import type { paths } from '../../schema'
import { getUserIdFromAccessToken } from '@/lib/auth/decode-token'

type ChatsSuccess =
  paths['/chats']['get']['responses']['200']['content']['application/json']

type Chat = ChatsSuccess['chats'][number]

type ChatsError = {
  error: string
  message: string
  code: string
}

async function fetchChatsByUser(userId: string): Promise<Chat | null> {
  const result = await withSession(
    () => {
      return toResult(
        client.GET('/chats', {
          params: { query: { userId } },
        }),
      )
    },
    (): ChatsError => ({
      error: 'Unauthorized',
      message: 'You are not signed in',
      code: 'NOT_AUTHENTICATED',
    }),
  )()

  return result.match(
    (data) => data.chats[0] ?? null,
    (error) => {
      throw error
    },
  )
}

export function getChatsByUserQueryOptions(userId: string) {
  return {
    queryKey: queryKeys.chats.byUser(userId),
    queryFn: () => fetchChatsByUser(userId),
  }
}

function getCurrentUserChatsQueryOptions() {
  const userIdResult = getUserIdFromAccessToken()

  if (userIdResult.isErr()) {
    toast.error('Unable to get user information')
    throw new Error('Unable to get user information')
  }

  return getChatsByUserQueryOptions(userIdResult.value)
}
