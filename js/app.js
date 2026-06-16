// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  lang: 'ja',
  bivrFile: null,
  propsFile: null,
  compareFile: null,
  lastReport: null,
  lastBivrName: '',
}

// ── Lang ──────────────────────────────────────────────────────────────────────
function applyLang(lang) {
  state.lang = lang
  window._lang = lang
  document.documentElement.lang = lang
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n')
    el.textContent = t(key)
  })
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'))
  })
  document.querySelector('#langBtn span').textContent = t('lang_toggle')
  updateCheckLabels()
}

// ── Upload zones ──────────────────────────────────────────────────────────────
function setupUploadZone(zoneId, inputId, stateKey, onFile) {
  const zone = document.getElementById(zoneId)
  const input = document.getElementById(inputId)

  zone.addEventListener('click', e => {
    if (e.target.classList.contains('file-clear')) return
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
  if (onFile) onFile(file)
}

function clearFile(stateKey, zoneId, inputId) {
  state[stateKey] = null
  const zone = document.getElementById(zoneId)
  zone.classList.remove('has-file')
  const nameEl = zone.querySelector('.upload-filename')
  if (nameEl) nameEl.textContent = ''
  const clearBtn = zone.querySelector('.file-clear')
  if (clearBtn) clearBtn.style.display = 'none'
  document.getElementById(inputId).value = ''
}

// ── Checks state ──────────────────────────────────────────────────────────────
function getSelectedChecks() {
  return [...document.querySelectorAll('.check-input:checked:not(:disabled)')].map(cb => cb.value)
}

function updateCheckLabels() {
  document.querySelectorAll('.check-label-text').forEach(el => {
    const key = el.getAttribute('data-i18n')
    if (key) el.textContent = t(key)
  })
}

function updateDiffCheckState() {
  const diffCb = document.getElementById('checkDiff')
  const diffLabel = document.getElementById('diffCheckLabel')
  if (state.compareFile) {
    diffCb.disabled = false
    diffLabel.classList.remove('disabled')
  } else {
    diffCb.disabled = true
    diffCb.checked = false
    diffLabel.classList.add('disabled')
  }
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
  const env = document.querySelector('input[name="env"]:checked').value

  // Validate
  if (!state.bivrFile) return showError(t('err_no_bivr'))
  if (!selected.length) return showError(t('err_no_checks'))
  if (selected.includes('api') && !state.propsFile) return showError(t('err_need_props'))
  if (selected.includes('diff') && !state.compareFile) return showError(t('err_need_compare'))

  const btn = document.getElementById('runBtn')
  const runIcon = document.getElementById('runIcon')
  btn.disabled = true
  btn.querySelector('[data-i18n]').textContent = t('running_btn')
  runIcon.className = 'fa-solid fa-spinner fa-spin btn-ico'

  try {
    const flows = await parseBivr(state.bivrFile)

    let apiIssues = null, phoneIssues = null, jumpIssues = null, diffIssues = null

    if (selected.includes('api')) {
      const text = await state.propsFile.text()
      const props = parseIvrProperties(text)
      apiIssues = checkApiUrls(props, env)
    }
    if (selected.includes('phone')) phoneIssues = checkPhoneNumbers(flows)
    if (selected.includes('jump')) jumpIssues = checkJumpToFlow(flows)
    if (selected.includes('diff') && state.compareFile) {
      const baseFlows = await parseBivr(state.compareFile)
      diffIssues = diffFlows(baseFlows, flows)
    }

    const report = generateReport(
      state.bivrFile.name,
      state.compareFile ? state.compareFile.name : null,
      env,
      apiIssues, phoneIssues, jumpIssues, diffIssues
    )
    state.lastReport = report
    state.lastBivrName = state.bivrFile.name

    showResults(apiIssues, phoneIssues, jumpIssues, diffIssues, report)
  } catch (err) {
    showError('Error: ' + err.message)
    console.error(err)
  } finally {
    btn.disabled = false
    btn.querySelector('[data-i18n]').textContent = t('run_btn')
    runIcon.className = 'fa-solid fa-play btn-ico'
  }
}

// ── Display results ───────────────────────────────────────────────────────────
function showResults(apiIssues, phoneIssues, jumpIssues, diffIssues, report) {
  const all = [...(apiIssues || []), ...(phoneIssues || []), ...(jumpIssues || []), ...(diffIssues || [])]
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

  document.getElementById('resultPreview').textContent = report

  const step3 = document.getElementById('step3')
  step3.hidden = false
  step3.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  // Language toggle
  document.getElementById('langBtn').addEventListener('click', () => {
    applyLang(state.lang === 'ja' ? 'vi' : 'ja')
  })

  // Upload zones
  setupUploadZone('bivrZone', 'bivrInput', 'bivrFile', null)
  setupUploadZone('propsZone', 'propsInput', 'propsFile', null)
  setupUploadZone('compareZone', 'compareInput', 'compareFile', () => updateDiffCheckState())

  // Clear buttons
  document.querySelectorAll('.file-clear').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const { zone, input, key } = btn.dataset
      clearFile(key, zone, input)
      if (key === 'compareFile') updateDiffCheckState()
    })
  })

  // Check all toggle
  document.getElementById('checkAllBtn').addEventListener('click', () => {
    const cbs = [...document.querySelectorAll('.check-input:not(:disabled)')]
    const allChecked = cbs.every(cb => cb.checked)
    cbs.forEach(cb => { cb.checked = !allChecked })
    document.getElementById('checkAllBtn').setAttribute('data-i18n', allChecked ? 'check_all' : 'check_none')
    document.getElementById('checkAllBtn').textContent = t(allChecked ? 'check_all' : 'check_none')
  })

  // Run button
  document.getElementById('runBtn').addEventListener('click', runChecks)

  // Download button
  document.getElementById('downloadBtn').addEventListener('click', downloadReport)

  // Apply initial lang
  applyLang('ja')
})
