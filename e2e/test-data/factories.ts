/** Factories con nombres únicos: cada test crea sus propios datos (ADR-001 §3, aislamiento). */
let secuencia = 0;

export function unico(prefijo: string): string {
  secuencia += 1;
  return `${prefijo}-${Date.now()}-${process.pid}-${secuencia}`;
}

export const factories = {
  email: (rol = 'user') => `${unico(`e2e-${rol}`)}@taskflow.test`,
  nombreProyecto: () => `Proyecto ${unico('e2e')}`,
  tituloTarea: () => `Tarea ${unico('e2e')}`,
};
