/**
 * Test de un bug conocido (ver docs/bugs.md).
 *
 * El test describe el comportamiento CORRECTO según la especificación.
 * Por defecto corre como `it.failing`: queda en verde mientras el bug siga
 * presente y pasa a rojo cuando alguien lo arregla (ahí hay que cambiar
 * `knownBug` por `it`).
 *
 * Para ver las fallas reales con su diff:  SHOW_BUGS=1 npm test
 */
export const knownBug: typeof it.failing = process.env.SHOW_BUGS
  ? (it as unknown as typeof it.failing)
  : it.failing;
