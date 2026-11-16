/**
 * El verificador del contrato tiene que poder fallar: si no detecta una
 * respuesta rota, los tests de contrato darían verde siempre.
 */
import { ProjectShape, TaskListShape, violations } from '../../../client/src/contracts/api.contract';

const project = {
  id: 'proj-1',
  name: 'Demo',
  description: null,
  ownerId: 'user-1',
  archived: false,
  createdAt: '2026-09-15T14:32:00.000Z',
};

const obj = (shape: typeof ProjectShape) => ({ kind: 'object' as const, shape });

describe('violations()', () => {
  it('acepta una respuesta válida e ignora campos extra', () => {
    expect(violations(obj(ProjectShape), { ...project, updatedAt: 'x' })).toEqual([]);
  });

  it('detecta un campo faltante', () => {
    const { ownerId: _omit, ...rest } = project;
    expect(violations(obj(ProjectShape), rest)).toEqual(['$.ownerId: falta el campo']);
  });

  it('detecta un id sin prefijo', () => {
    expect(violations(obj(ProjectShape), { ...project, id: 1 })).toEqual([
      '$.id: se esperaba string, llegó number',
    ]);
    expect(violations(obj(ProjectShape), { ...project, ownerId: '1' })[0]).toMatch(/^\$\.ownerId:/);
  });

  it('detecta null donde no se admite y fechas fuera de ISO UTC', () => {
    expect(violations(obj(ProjectShape), { ...project, name: null })).toEqual([
      '$.name: es null y no puede serlo',
    ]);
    expect(
      violations(obj(ProjectShape), { ...project, createdAt: '2026-09-15 14:32:00' })[0],
    ).toMatch(/^\$\.createdAt:/);
  });

  it('valida en profundidad (items del listado de tareas)', () => {
    const list = {
      items: [{ id: 'task-1', status: 'BLOCKED' }],
      total: 1,
      limit: 20,
      offset: 0,
    };
    const found = violations({ kind: 'object', shape: TaskListShape }, list);
    expect(found).toContain('$.items[0].status: "BLOCKED" no es uno de TODO, IN_PROGRESS, DONE');
    expect(found).toContain('$.items[0].projectId: falta el campo');
  });
});
