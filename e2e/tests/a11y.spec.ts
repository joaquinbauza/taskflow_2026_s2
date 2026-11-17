import { test, expect, type Page } from '@playwright/test'
import { env } from '../config/env'
import AxeBuilder from '@axe-core/playwright'

/**
 * Auditoría de accesibilidad WCAG 2.1 AA — Clase 12, Módulo 2
 *
 * Cómo se usa:
 *   1. Correr el informe:   npx playwright test a11y --project=chromium
 *   2. Leer la salida: cada violación muestra la regla de axe, el criterio de éxito
 *      (SC) de WCAG, el nivel y los elementos afectados.
 *   3. Corregir UNA violación en client/src/.
 *   4. Poner el id de esa regla en VERIFICAR.regla (más abajo) y volver a correr:
 *      el test de verificación pasa de rojo a verde cuando la corrección funciona.
 *
 * Requiere la app corriendo (la config de Playwright levanta API y web si no están)
 * Adaptado a TaskFlow: la base de E2E arranca vacía (sin seed), así que ana@test.com /
 * Password1 y su proyecto con una tarea se crean por API antes de auditar.
 */

// ── Configuración ───────────────────────────────────────────────────────────

const TAGS_WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/** Completar después de corregir una violación. Ej.: regla: 'label' */
const VERIFICAR: { regla: string | null; vistas: string[] } = {
  // ACC-01: inputs de etiqueta y comentario sin nombre accesible (corregido en TaskDetailPage.tsx)
  regla: 'label',
  vistas: ['Detalle de tarea'],
}

// ── Vistas a auditar ────────────────────────────────────────────────────────

// Adaptación: crea (si no existen) a ana@test.com y un proyecto con una tarea, por API.
async function asegurarDatosDeAna(page: Page): Promise<void> {
  const api = page.request
  const credenciales = { email: 'ana@test.com', password: 'Password1' }
  await api.post(`${env.API_URL}/auth/register`, { data: credenciales }) // 201, o 409 si ya existe
  const { token } = await (await api.post(`${env.API_URL}/auth/login`, { data: credenciales })).json()
  const headers = { Authorization: `Bearer ${token}` }
  const proyectos = await (await api.get(`${env.API_URL}/projects`, { headers })).json()
  if (proyectos.length === 0) {
    const proyecto = await (await api.post(`${env.API_URL}/projects`, { headers, data: { name: 'Rediseño del sitio' } })).json()
    await api.post(`${env.API_URL}/projects/${proyecto.id}/tasks`, { headers, data: { title: 'Implementar login' } })
  }
}

async function loginComoAna(page: Page): Promise<void> {
  await asegurarDatosDeAna(page)
  await page.goto('/login')
  await page.getByTestId('login-email-input').fill('ana@test.com')
  await page.getByTestId('login-password-input').fill('Password1')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL('/projects')
}

const VISTAS: { nombre: string; abrir: (page: Page) => Promise<void> }[] = [
  { nombre: 'Login', abrir: async (page) => { await page.goto('/login') } },
  // Adaptación: no hay ruta /register; el registro es el toggle de LoginPage.
  {
    nombre: 'Registro',
    abrir: async (page) => {
      await page.goto('/login')
      await page.getByTestId('login-mode-toggle').click()
      await expect(page.getByTestId('login-name-input')).toBeVisible()
    },
  },
  {
    nombre: 'Proyectos',
    abrir: async (page) => {
      await loginComoAna(page)
      await expect(page.getByTestId('project-card').first()).toBeVisible()
    },
  },
  {
    nombre: 'Detalle de proyecto',
    abrir: async (page) => {
      await loginComoAna(page)
      // Adaptación: el link clickeable de la tarjeta es project-card-name (el <li> no navega).
      await page.getByTestId('project-card-name').first().click()
      await expect(page.getByTestId('task-card').first()).toBeVisible()
    },
  },
  // Adaptación: en TaskFlow el detalle de cada tarea es una pantalla aparte (formulario de
  // edición, etiquetas y comentarios). Se audita porque es donde axe encuentra violaciones.
  {
    nombre: 'Detalle de tarea',
    abrir: async (page) => {
      await loginComoAna(page)
      await page.getByTestId('project-card-name').first().click()
      await page.getByTestId('task-card-title').first().click()
      await expect(page.getByTestId('comment-add-input')).toBeVisible()
    },
  },
]

// ── Utilidades ──────────────────────────────────────────────────────────────

/** 'wcag143' -> '1.4.3' ; 'wcag2410' -> '2.4.10' */
function tagASc(tag: string): string | null {
  const m = /^wcag(\d)(\d)(\d{1,2})$/.exec(tag)
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null
}

function nivel(tags: string[]): string {
  return tags.some((t) => t.endsWith('aa')) ? 'AA' : 'A'
}

async function auditar(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS_WCAG).analyze()
  return violations
}

// ── 1) Informe (no falla: sirve para leer y documentar los hallazgos) ──────

test.describe('Informe de accesibilidad WCAG 2.1 AA', () => {
  for (const vista of VISTAS) {
    test(`${vista.nombre}: informe de violaciones`, async ({ page }, testInfo) => {
      await vista.abrir(page)
      const violations = await auditar(page)

      console.log(`\n=== ${vista.nombre}: ${violations.length} regla(s) violada(s) ===`)
      for (const v of violations) {
        const sc = v.tags.map(tagASc).filter(Boolean).join(', ')
        console.log(`\n[${(v.impact ?? 'n/a').toUpperCase()}] ${v.id} — ${v.help}`)
        console.log(`   SC WCAG: ${sc || 'n/a'}  ·  Nivel ${nivel(v.tags)}`)
        console.log(`   Elementos afectados: ${v.nodes.length}`)
        v.nodes.slice(0, 3).forEach((n) => console.log(`   · ${n.target.join(' ')}`))
        console.log(`   Más info: ${v.helpUrl}`)
      }

      await testInfo.attach(`axe-${vista.nombre}.json`, {
        body: JSON.stringify(violations, null, 2),
        contentType: 'application/json',
      })
    })
  }
})

// ── 2) Verificación de la corrección (rojo → verde) ────────────────────────

test.describe('Verificación de la corrección', () => {
  test.skip(!VERIFICAR.regla, 'Definí VERIFICAR.regla con el id de la regla que corregiste')

  for (const vista of VISTAS.filter((v) => VERIFICAR.vistas.includes(v.nombre))) {
    test(`${vista.nombre}: ya no hay violaciones de "${VERIFICAR.regla}"`, async ({ page }) => {
      await vista.abrir(page)
      const ids = (await auditar(page)).map((v) => v.id)
      expect(ids).not.toContain(VERIFICAR.regla)
    })
  }
})
