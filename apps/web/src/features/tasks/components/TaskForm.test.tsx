import { describe, expect, it, vi } from 'vitest'
import { renderApp } from '../../../test/render'
import { TaskForm } from './TaskForm'

vi.mock('../../../hooks/useHouseholdData', () => ({
  useMembers: () => ({ data: [{ userId: 'u1', displayName: 'Emmanouil' }] }),
}))
vi.mock('../../households/HouseholdProvider', () => ({
  useHousehold: () => ({ household: { id: 'h1', timeZone: 'Europe/Athens' } }),
}))
vi.mock('../hooks', () => ({
  useTaskLists: () => ({ data: [{ id: 'home', name: 'Home', isArchived: false }] }),
}))

describe('TaskForm', () => {
  it('exposes the fast household task fields and advanced configuration', () => {
    const { container } = renderApp(<TaskForm submitting={false} onSubmit={vi.fn()} />)
    expect(container.querySelector('[name="title"]')).toBeTruthy()
    expect(container.querySelector('[name="description"]')).toBeTruthy()
    expect(container.querySelector('[name="status"]')).toBeTruthy()
    expect(container.querySelector('[name="assigneeUserId"]')).toBeTruthy()
    expect(container.querySelector('[name="priority"]')).toBeTruthy()
    expect(container.querySelector('[aria-label="Due date"]')).toBeTruthy()
    expect(container.querySelector('[aria-label="Due time"]')).toBeTruthy()
    expect(container.querySelector('[type="checkbox"]')).toBeTruthy()
    expect(container.querySelector('[type="submit"]')).toBeTruthy()
  })
})
