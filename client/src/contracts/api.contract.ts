/**
 * Contrato frontend → API (consumer-driven).
 *
 * Este archivo es del frontend: describe, para cada endpoint que la UI llama,
 * el status que espera y los campos de la respuesta que efectivamente lee.
 * La API se verifica contra este contrato en server/tests/contract/.
 *
 * Reglas:
 *  - Solo se declara lo que el frontend usa. Campos extra en la respuesta no
 *    rompen el contrato (el consumidor los ignora).
 *  - Las formas de las entidades están atadas a los tipos de src/types.ts con
 *    `satisfies Shape<...>`: si alguien agrega o quita un campo en los tipos y
 *    no actualiza el contrato, `tsc` falla.
 *  - Si el frontend necesita algo nuevo de la API, se agrega acá primero.
 */
import {
  PRIORITIES,
  STATUSES,
  type Comment,
  type HistoryEntry,
  type Member,
  type Project,
  type Tag,
  type Task,
  type TaskAssignee,
  type TaskListResponse,
  type User,
} from '../types';

// ---------------------------------------------------------------------------
// Mini DSL de formas
// ---------------------------------------------------------------------------

interface Base {
  nullable?: boolean;
  optional?: boolean;
}

export type Field =
  | (Base & { kind: 'string'; pattern?: RegExp; oneOf?: readonly string[] })
  | (Base & { kind: 'number'; integer?: boolean })
  | (Base & { kind: 'boolean' })
  | (Base & { kind: 'object'; shape: Record<string, Field> })
  | (Base & { kind: 'array'; items: Field });

/** Todas las claves del tipo del frontend tienen que estar descritas. */
export type Shape<T> = { [K in keyof Required<T>]: Field };

const str = (opts: { pattern?: RegExp; oneOf?: readonly string[] } = {}): Field => ({
  kind: 'string',
  ...opts,
});
const int = (): Field => ({ kind: 'number', integer: true });
const bool = (): Field => ({ kind: 'boolean' });
const obj = (shape: Record<string, Field>): Field => ({ kind: 'object', shape });
const arr = (items: Field): Field => ({ kind: 'array', items });
const nullable = (f: Field): Field => ({ ...f, nullable: true });
const optional = (f: Field): Field => ({ ...f, optional: true });

const id = (prefix: 'user' | 'proj' | 'task' | 'comment' | 'tag') =>
  str({ pattern: new RegExp(`^${prefix}-\\d+$`) });
/** Timestamps del sistema: ISO 8601 UTC. */
const isoUtc = () => str({ pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/ });
/** Fecha de vencimiento: día calendario sin hora. */
const calendarDay = () => str({ pattern: /^\d{4}-\d{2}-\d{2}$/ });

// ---------------------------------------------------------------------------
// Entidades (atadas a src/types.ts)
// ---------------------------------------------------------------------------

export const UserShape = {
  id: id('user'),
  email: str(),
  name: nullable(str()),
  createdAt: optional(isoUtc()),
} satisfies Shape<User>;

export const ProjectShape = {
  id: id('proj'),
  name: str(),
  description: nullable(str()),
  ownerId: id('user'),
  archived: bool(),
  createdAt: isoUtc(),
} satisfies Shape<Project>;

const AssigneeShape = {
  id: id('user'),
  email: str(),
} satisfies Shape<TaskAssignee>;

const TagShape = {
  id: id('tag'),
  name: str(),
} satisfies Shape<Tag>;

export const TaskShape = {
  id: id('task'),
  projectId: id('proj'),
  title: str(),
  description: nullable(str()),
  status: str({ oneOf: STATUSES }),
  priority: str({ oneOf: PRIORITIES }),
  assigneeId: nullable(id('user')),
  dueDate: nullable(calendarDay()),
  createdAt: isoUtc(),
  updatedAt: isoUtc(),
  assignee: optional(nullable(obj(AssigneeShape))),
  commentCount: optional(int()),
  tags: optional(arr(obj(TagShape))),
} satisfies Shape<Task>;

/** En el tablero, cada tarjeta muestra el email del asignado y la cantidad de comentarios. */
export const TaskListItemShape = {
  ...TaskShape,
  assignee: nullable(obj(AssigneeShape)),
  commentCount: int(),
} satisfies Shape<Task>;

/** En el detalle se muestran las etiquetas. */
export const TaskDetailShape = {
  ...TaskShape,
  tags: arr(obj(TagShape)),
} satisfies Shape<Task>;

export const TaskListShape = {
  items: arr(obj(TaskListItemShape)),
  total: int(),
  limit: int(),
  offset: int(),
} satisfies Shape<TaskListResponse>;

export const CommentShape = {
  id: id('comment'),
  taskId: id('task'),
  authorId: id('user'),
  body: str(),
  createdAt: isoUtc(),
} satisfies Shape<Comment>;

export const HistoryEntryShape = {
  id: int(),
  taskId: id('task'),
  changedBy: id('user'),
  fromStatus: nullable(str({ oneOf: STATUSES })),
  toStatus: str({ oneOf: STATUSES }),
  changedAt: isoUtc(),
} satisfies Shape<HistoryEntry>;

/** Respuesta de POST /projects/:id/members (MembersPage → AddMemberResponse). */
export const AddMemberShape = {
  projectId: id('proj'),
  userId: id('user'),
  email: str(),
  role: str({ oneOf: ['OWNER', 'ADMIN', 'MEMBER'] }),
} satisfies Shape<Member & { projectId: string }>;

/** lib/api.ts lee error.code, error.message y error.details. */
export const ErrorShape = {
  error: obj({
    code: str({
      oneOf: [
        'VALIDATION_ERROR',
        'UNAUTHORIZED',
        'FORBIDDEN',
        'NOT_FOUND',
        'CONFLICT',
        'INVALID_TRANSITION',
        'INTERNAL',
      ],
    }),
    message: str(),
    details: arr(str()),
  }),
};

const AuthResponseShape = {
  user: obj(UserShape),
  token: str({ pattern: /^[\w-]+\.[\w-]+\.[\w-]+$/ }),
};

// ---------------------------------------------------------------------------
// Interacciones que usa la UI
// ---------------------------------------------------------------------------

export interface Interaction {
  /** Dónde lo usa el frontend. */
  usedBy: string;
  status: number;
  /**
   * Forma del cuerpo que lee el frontend.
   * `null`: el frontend no lee cuerpo (204 o respuesta descartada).
   */
  body: Field | null;
}

export const contract = {
  'POST /auth/register': {
    usedBy: 'lib/auth.tsx · register',
    status: 201,
    body: obj(AuthResponseShape),
  },
  'POST /auth/login': {
    usedBy: 'lib/auth.tsx · login',
    status: 200,
    body: obj(AuthResponseShape),
  },
  'GET /projects': {
    usedBy: 'ProjectsPage, lib/project.ts',
    status: 200,
    body: arr(obj(ProjectShape)),
  },
  'POST /projects': {
    usedBy: 'ProjectsPage · crear proyecto',
    status: 201,
    body: null,
  },
  'POST /projects/:projectId/members': {
    usedBy: 'MembersPage · agregar miembro',
    status: 201,
    body: obj(AddMemberShape),
  },
  'DELETE /projects/:projectId/members/:userId': {
    usedBy: 'MembersPage · quitar miembro',
    status: 204,
    body: null,
  },
  'GET /projects/:projectId/tasks': {
    usedBy: 'BoardPage, lib/members.ts',
    status: 200,
    body: obj(TaskListShape),
  },
  'POST /projects/:projectId/tasks': {
    usedBy: 'BoardPage · crear tarea',
    status: 201,
    body: null,
  },
  'GET /tasks/:taskId': {
    usedBy: 'TaskDetailPage',
    status: 200,
    body: obj(TaskDetailShape),
  },
  'PATCH /tasks/:taskId': {
    usedBy: 'TaskDetailPage · guardar / cambiar estado, BoardPage · mover',
    status: 200,
    body: obj(TaskShape),
  },
  'DELETE /tasks/:taskId': {
    usedBy: 'TaskDetailPage · borrar tarea',
    status: 204,
    body: null,
  },
  'GET /tasks/:taskId/history': {
    usedBy: 'TaskDetailPage · historial',
    status: 200,
    body: arr(obj(HistoryEntryShape)),
  },
  'POST /tasks/:taskId/tags': {
    usedBy: 'TaskDetailPage · agregar etiqueta',
    status: 201,
    body: null,
  },
  'DELETE /tasks/:taskId/tags/:tagId': {
    usedBy: 'TaskDetailPage · quitar etiqueta',
    status: 204,
    body: null,
  },
  'GET /tasks/:taskId/comments': {
    usedBy: 'TaskDetailPage · comentarios',
    status: 200,
    body: arr(obj(CommentShape)),
  },
  'POST /tasks/:taskId/comments': {
    usedBy: 'TaskDetailPage · comentar',
    status: 201,
    body: null,
  },
  'DELETE /comments/:commentId': {
    usedBy: 'TaskDetailPage · borrar comentario',
    status: 204,
    body: null,
  },
} satisfies Record<string, Interaction>;

export type InteractionKey = keyof typeof contract;

/** Cualquier respuesta 4xx/5xx debe tener esta forma (lib/api.ts → ApiError). */
export const errorContract: Field = obj(ErrorShape);

// ---------------------------------------------------------------------------
// Verificador
// ---------------------------------------------------------------------------

/** Devuelve la lista de violaciones del contrato (vacía si cumple). */
export function violations(field: Field, value: unknown, path = '$'): string[] {
  if (value === undefined) {
    return field.optional ? [] : [`${path}: falta el campo`];
  }
  if (value === null) {
    return field.nullable ? [] : [`${path}: es null y no puede serlo`];
  }

  switch (field.kind) {
    case 'string': {
      if (typeof value !== 'string') return [`${path}: se esperaba string, llegó ${typeof value}`];
      if (field.pattern && !field.pattern.test(value)) {
        return [`${path}: "${value}" no cumple ${field.pattern}`];
      }
      if (field.oneOf && !field.oneOf.includes(value)) {
        return [`${path}: "${value}" no es uno de ${field.oneOf.join(', ')}`];
      }
      return [];
    }
    case 'number':
      if (typeof value !== 'number') return [`${path}: se esperaba number, llegó ${typeof value}`];
      if (field.integer && !Number.isInteger(value)) return [`${path}: se esperaba un entero`];
      return [];
    case 'boolean':
      return typeof value === 'boolean' ? [] : [`${path}: se esperaba boolean, llegó ${typeof value}`];
    case 'array':
      if (!Array.isArray(value)) return [`${path}: se esperaba un array`];
      return value.flatMap((item, i) => violations(field.items, item, `${path}[${i}]`));
    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) return [`${path}: se esperaba un objeto`];
      const record = value as Record<string, unknown>;
      return Object.entries(field.shape).flatMap(([key, f]) =>
        violations(f, record[key], `${path}.${key}`),
      );
    }
  }
}
