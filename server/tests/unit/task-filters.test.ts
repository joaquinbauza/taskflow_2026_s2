import { knownBug } from '../knownBug';
import { buildFilters } from '../../src/modules/tasks/tasks.repository';

/** US-07 — Los filtros son combinables entre sí y se aplican todos a la vez. */
describe('buildFilters (US-07)', () => {
  it('sin filtros, solo restringe por proyecto', () => {
    expect(buildFilters(1, {})).toEqual({ projectId: 1 });
  });

  it.each([
    [{ status: 'TODO' }, { projectId: 1, status: 'TODO' }],
    [{ priority: 'HIGH' }, { projectId: 1, priority: 'HIGH' }],
    [{ assigneeId: 3 }, { projectId: 1, assigneeId: 3 }],
  ])('aplica un filtro individual %p', (filters, expected) => {
    expect(buildFilters(1, filters)).toEqual(expected);
  });

  // BUG-05: cada filtro reemplaza el objeto where en lugar de sumarse.
  knownBug('[BUG-05] combina status y priority', () => {
    expect(buildFilters(1, { status: 'TODO', priority: 'HIGH' })).toEqual({
      projectId: 1,
      status: 'TODO',
      priority: 'HIGH',
    });
  });

  knownBug('[BUG-05] combina los tres filtros', () => {
    expect(buildFilters(1, { status: 'DONE', priority: 'LOW', assigneeId: 2 })).toEqual({
      projectId: 1,
      status: 'DONE',
      priority: 'LOW',
      assigneeId: 2,
    });
  });
});
