import { api } from './api'

export interface StrategySummary {
  _id: string
  name: string
  map: string
  side: 'atk' | 'def'
  createdAt: string
  updatedAt: string
}

export const strategyService = {
  async list() {
    const { data } = await api.get<StrategySummary[]>('/api/strategy')
    return data
  },

  async delete(id: string) {
    await api.delete(`/api/strategy/${id}`)
  },

  async createSession() {
    const { data } = await api.post<{ roomCode: string }>('/api/board-session')
    return data
  },

  async getSession(roomCode: string) {
    const { data } = await api.get<{ roomCode: string; participantCount: number }>(`/api/board-session/${roomCode}`)
    return data
  },
}
