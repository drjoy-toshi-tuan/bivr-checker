// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  lang: 'ja',
  mode: null,
  zipFile: null,         // single-zip modes
  demoZipFile: null,     // compare
  masterZipFile: null,   // compare
  parsed: { zip: null, demo: null, master: null }, // parseZipSet results
  lastRun: null,         // { mode, env, demoEnv, masterEnv, bivrName, compareName, apiIssues, phoneIssues, jumpIssues, diffIssues }
}

// Which checks belong to which mode
const MODE_CHECKS = {
  deploy: ['api', 'phone', 'jump'],
  flow: ['phone', 'jump'],
  property: ['api'],
  compare: ['diff'],
}

// ── Lang ──────────────────────────────────────────────────────────────────────
function applyLang(lang) {
  state.lang = lang
  window._lang = lang
  document.documentElement.lang = lang
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'))
  })
  document.querySelector('#langBtn span').textContent = t('lang_toggle')
  refreshDetectedBadges()
  if (state.lastRun) rerenderReport()
}

// ── Upload zones ──────────────────────────────────────────────────────────────
function setupUploadZone(zoneId, inputId, stateKey, onFile) {
  const zone = document.getElementById(zoneId)
  const input = document.getElementById(inputId)

  zone.addEventListener('click', e => {
    if (e.target.closest('.file-clear')) return
    input.click()
  })
  input.addEventListener('change', () => {
    if (input.files[0]) handleFile(input.files[0], stateKey, zone, onFile)
  })
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover') })
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'))
  zone.addEventListener('drop', e => {
    e.preventDefault()
    zone.classList.remove('dragover')
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file, stateKey, zone, onFile)
  })
}

function handleFile(file, stateKey, zone, onFile) {
  state[stateKey] = file
  zone.classList.add('has-file')
  const nameEl = zone.querySelector('.upload-filename')
  if (nameEl) nameEl.textContent = file.name
  const clearBtn = zone.querySelector('.file-clear')
  if (clearBtn) clearBtn.style.display = 'inline-flex'
  if (onFile) onFile(file, zone)
}

function clearFile(stateKey, zoneId, inputId, parsedKey, detectedId) {
  state[stateKey] = null
  if (parsedKey) state.parsed[parsedKey] = null
  const zone = document.getElementById(zoneId)
  zone.classList.remove('has-file')
  const nameEl = zone.querySelector('.upload-filename')
  if (nameEl) nameEl.textContent = ''
  const clearBtn = zone.querySelector('.file-clear')
  if (clearBtn) clearBtn.style.display = 'none'
  document.getElementById(inputId).value = ''
  if (detectedId) {
    const d = document.getElementById(detectedId)
    d.hidden = true
    d.innerHTML = ''
  }
}

// Parse a zip on upload to detect environment + flows, then show a badge
async function onZipUpload(file, parsedKey, detectedId) {
  const badge = document.getElementById(detectedId)
  badge.hidden = false
  badge.innerHTML = `<span class="detected-loading"><i class="fa-solid fa-spinner fa-spin"></i></span>`
  try {
    const result = await parseZipSet(file)
    state.parsed[parsedKey] = result
    renderDetected(badge, result)
  } catch (err) {
    state.parsed[parsedKey] = null
    badge.innerHTML = `<span class="detected-err"><i class="fa-solid fa-circle-exclamation"></i> ${err.message}</span>`
  }
}

function renderDetected(badge, result) {
  if (!result) { badge.hidden = true; return }
  badge.dataset.env = result.detail.env || ''
  const envText = result.detail.env ? envLabel(result.detail.env) : t('env_unknown')
  const envCls = result.detail.env === 'master' ? 'env-master' : result.detail.env === 'demo' ? 'env-demo' : 'env-unknown'
  const flows = result.detail.flows
  const main = flows.filter(f => f.kind === 'main').length
  const sub = flows.filter(f => f.kind === 'sub').length
  badge.innerHTML = `
    <span class="detected-pill ${envCls}"><i class="fa-solid fa-server"></i> ${t('detected_env')}: <b>${envText}</b></span>
    <span class="detected-pill"><i class="fa-solid fa-diagram-project"></i> ${t('detected_flows')}: <b>${flows.length}</b>
      <span class="detected-sub">(${t('detected_main')} ${main} / ${t('detected_sub')} ${sub})</span></span>
    <span class="detected-pill"><i class="fa-solid fa-sliders"></i> ${t('detected_props')}: <b>${result.propsFiles.length}</b></span>
  `
}

function refreshDetectedBadges() {
  renderDetectedIfAny('zipDetected', 'zip')
  renderDetectedIfAny('demoDetected', 'demo')
  renderDetectedIfAny('masterDetected', 'master')
}
function renderDetectedIfAny(badgeId, parsedKey) {
  const result = state.parsed[parsedKey]
  if (!result) return
  const badge = document.getElementById(badgeId)
  badge.hidden = false
  renderDetected(badge, result)
}

// ── Mode UI ─────────────────────────────────────────────────────────────────--
function applyMode(mode) {
  if (!mode) return
  state.mode = mode

  // Reveal detail area (checks + upload + run)
  document.getElementById('modeDetail').hidden = false

  // Upload layout: one zip, or two zips for compare
  const isCompare = mode === 'compare'
  document.getElementById('singleUpload').hidden = isCompare
  document.getElementById('compareUpload').hidden = !isCompare

  // Check options relevant to this mode (default all on)
  const allowed = MODE_CHECKS[mode]
  document.querySelectorAll('#checksGrid .check-label').forEach(label => {
    const key = label.dataset.check
    const visible = allowed.includes(key)
    label.hidden = !visible
    const cb = label.querySelector('.check-input')
    cb.disabled = !visible
    if (visible) cb.checked = true
  })

  // Scroll the newly revealed section into view
  document.getElementById('modeDetail').scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

// ── Checks state ──────────────────────────────────────────────────────────────
function getSelectedChecks() {
  return [...document.querySelectorAll('#checksGrid .check-input:checked:not(:disabled)')].map(cb => cb.value)
}

// ── Error message ─────────────────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('errorMsg')
  el.textContent = msg
  el.style.display = 'block'
  setTimeout(() => { el.style.display = 'none' }, 5000)
}

// ── Run checks ────────────────────────────────────────────────────────────────
async function runChecks() {
  const selected = getSelectedChecks()
  if (!selected.length) return showError(t('err_no_checks'))

  const btn = document.getElementById('runBtn')
  const runIcon = document.getElementById('runIcon')
  const setBusy = busy => {
    btn.disabled = busy
    btn.querySelector('[data-i18n]').textContent = t(busy ? 'running_btn' : 'run_btn')
    runIcon.className = busy ? 'fa-solid fa-spinner fa-spin btn-ico' : 'fa-solid fa-play btn-ico'
  }

  try {
    if (state.mode === 'compare') {
      if (!state.demoZipFile || !state.masterZipFile) return showError(t('err_no_compare_zips'))
      setBusy(true)
      const demo = state.parsed.demo || await parseZipSet(state.demoZipFile)
      const master = state.parsed.master || await parseZipSet(state.masterZipFile)
      state.parsed.demo = demo; state.parsed.master = master
      const diffIssues = diffFlows(master.flows, demo.flows)
      state.lastRun = {
        mode: 'compare',
        env: demo.detail.env,
        demoEnv: demo.detail.env,
        masterEnv: master.detail.env,
        bivrName: demo.bivrName,
        compareName: master.bivrName,
        diffIssues,
      }
    } else {
      if (!state.zipFile) return showError(t('err_no_zip'))
      setBusy(true)
      const set = state.parsed.zip || await parseZipSet(state.zipFile)
      state.parsed.zip = set
      const env = set.detail.env
      const wantApi = selected.includes('api')

      if (wantApi && !set.propsFiles.length) return showError(t('err_need_props'))
      if (wantApi && !env) return showError(t('err_no_env'))

      let apiIssues = null, phoneIssues = null, jumpIssues = null
      if (wantApi) {
        apiIssues = []
        for (const pf of set.propsFiles) {
          const props = parseIvrProperties(pf.text)
          apiIssues.push(...checkApiUrls(props, env))
        }
      }
      if (selected.includes('phone')) phoneIssues = checkPhoneNumbers(set.flows)
      if (selected.includes('jump')) jumpIssues = checkJumpToFlow(set.flows)

      state.lastRun = {
        mode: state.mode,
        env,
        bivrName: set.bivrName,
        apiIssues, phoneIssues, jumpIssues,
      }
    }

    rerenderReport()
    const step3 = document.getElementById('step3')
    step3.hidden = false
    step3.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (err) {
    showError('Error: ' + err.message)
    console.error(err)
  } finally {
    setBusy(false)
  }
}

// ── Render report (from lastRun) ───────────────────────────────────────────────
function rerenderReport() {
  const r = state.lastRun
  if (!r) return
  const report = generateReport(r)
  state.lastReport = report

  const all = [...(r.apiIssues || []), ...(r.phoneIssues || []), ...(r.jumpIssues || []), ...(r.diffIssues || [])]
  const errors = all.filter(i => i.severity === 'ERROR').length
  const warnings = all.filter(i => i.severity === 'WARNING').length
  const pass = errors === 0

  const summary = document.getElementById('resultSummary')
  const vIcon = pass ? 'fa-circle-check' : 'fa-circle-xmark'
  const vText = pass ? t('result_pass_text') : t('result_fail_text')
  summary.innerHTML = `
    <div class="verdict ${pass ? 'pass' : 'fail'}">
      <i class="fa-solid ${vIcon}"></i>
      <span>${vText}</span>
    </div>
    <div class="stats">
      <span class="stat stat-error"><i class="fa-solid fa-circle-exclamation"></i> ${errors} ${t('errors_label')}</span>
      <span class="stat stat-warning"><i class="fa-solid fa-triangle-exclamation"></i> ${warnings} ${t('warnings_label')}</span>
    </div>
  `

  // VS Code-like rendered markdown preview
  const preview = document.getElementById('resultPreview')
  if (window.marked) {
    marked.setOptions({ gfm: true, breaks: false })
    preview.innerHTML = marked.parse(report)
  } else {
    preview.textContent = report
  }
}

// ── Download report ───────────────────────────────────────────────────────────
function downloadReport() {
  if (!state.lastReport) return
  const blob = new Blob([state.lastReport], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  a.href = url
  a.download = `bivr-report-${ts}.md`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  window._lang = 'ja'

  document.getElementById('langBtn').addEventListener('click', () => {
    applyLang(state.lang === 'ja' ? 'vi' : 'ja')
  })

  // Upload zones
  setupUploadZone('zipZone', 'zipInput', 'zipFile', f => onZipUpload(f, 'zip', 'zipDetected'))
  setupUploadZone('demoZone', 'demoInput', 'demoZipFile', f => onZipUpload(f, 'demo', 'demoDetected'))
  setupUploadZone('masterZone', 'masterInput', 'masterZipFile', f => onZipUpload(f, 'master', 'masterDetected'))

  // Clear buttons
  const clearMap = {
    zipFile: ['zip', 'zipDetected'],
    demoZipFile: ['demo', 'demoDetected'],
    masterZipFile: ['master', 'masterDetected'],
  }
  document.querySelectorAll('.file-clear').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const { zone, input, key } = btn.dataset
      const [parsedKey, detectedId] = clearMap[key] || []
      clearFile(key, zone, input, parsedKey, detectedId)
    })
  })

  // Mode cards
  document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', () => applyMode(radio.value))
  })

  // Check-all toggle
  document.getElementById('checkAllBtn').addEventListener('click', () => {
    const cbs = [...document.querySelectorAll('#checksGrid .check-input:not(:disabled)')]
      .filter(cb => !cb.closest('.check-label').hidden)
    const allChecked = cbs.every(cb => cb.checked)
    cbs.forEach(cb => { cb.checked = !allChecked })
    const b = document.getElementById('checkAllBtn')
    b.setAttribute('data-i18n', allChecked ? 'check_all' : 'check_none')
    b.textContent = t(allChecked ? 'check_all' : 'check_none')
  })

  document.getElementById('runBtn').addEventListener('click', runChecks)
  document.getElementById('downloadBtn').addEventListener('click', downloadReport)

  applyLang('ja')
})
