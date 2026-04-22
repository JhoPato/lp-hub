import type { HubScheduleEvent } from '@/services/hubService'

export function buildEventDate(event: Pick<HubScheduleEvent, 'date' | 'startTime'>) {
  const date = new Date(event.date)
  if (event.startTime) {
    const [hours = 0, minutes = 0] = event.startTime.split(':').map(Number)
    date.setHours(hours, minutes, 0, 0)
  }
  return date
}

export function formatDateTime(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatFullDate(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatTime(value?: string) {
  if (!value) return '--'
  const [hours = 0, minutes = 0] = value.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function timeFromNow(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  const diff = date.getTime() - Date.now()
  const abs = Math.abs(diff)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (abs < hour) {
    const minutes = Math.max(1, Math.round(abs / minute))
    return diff >= 0 ? `in ${minutes}m` : `${minutes}m ago`
  }

  if (abs < day) {
    const hours = Math.max(1, Math.round(abs / hour))
    return diff >= 0 ? `in ${hours}h` : `${hours}h ago`
  }

  const days = Math.max(1, Math.round(abs / day))
  return diff >= 0 ? `in ${days}d` : `${days}d ago`
}

export function isDueToday(value?: string | null) {
  if (!value) return false
  const date = new Date(value)
  const now = new Date()
  return date.toDateString() === now.toDateString()
}

export function isOverdue(value?: string | null) {
  if (!value) return false
  const date = new Date(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
}
