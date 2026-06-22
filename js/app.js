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
  deploy: ['api', 'phone', 'jump', 'prompt', 'ctxrouter', 'regex', 'openai', 'reconfirm', 'flag', 'submod'],
  flow: ['phone', 'jump', 'ctxrouter', 'regex', 'openai', 'reconfirm', 'flag', 'submod'],
  property: ['api'],
  compare: ['diff'],
}

// Các check cần file IVR Properties (zip phải có ivr-property.md)
const PROPS_CHECKS = new Set(['api', 'prompt'])

// Cấu hình ô upload theo mode (mode 1 file): label / hint / loại file / icon
const UPLOAD_MODE = {
  deploy:   { labelKey: 'up_deploy_label',   hintKey: 'up_deploy_hint', accept: '.zip',  icon: 'fa-file-zipper' },
  flow:     { labelKey: 'up_flow_label',     hintKey: null,             accept: '.bivr', icon: 'fa-diagram-project' },
  property: { labelKey: 'up_property_label', hintKey: null,             accept: '.md',   icon: 'fa-sliders' },
}

// Suy ra môi trường từ nội dung IVR property (khi mode chỉ upload .md)
function inferEnvFromProps(props) {
  let demo = 0, master = 0
  for (const v of Object.values(props || {})) {
    const s = String(v)
    if (s.includes('demo-reserve.famishare.jp') || s.includes('10.0.20.11')) demo++
    else if (s.includes('reserve.drjoy.jp') || s.includes('speech.internal.assistant.com')) master++
  }
  if (!demo && !master) return null
  return demo >= master ? 'demo' : 'master'
}

function flowsToDetail(flows) {
  return Object.keys(flows || {}).map(name => ({ name, kind: flowKind(name) }))
}

// Lấy tên group (phần trước "$" của tên flow) làm tên file báo cáo mặc định
function deriveGroupName(flows, fallbackName) {
  const names = Object.keys(flows || {})
  if (names.length) {
    const first = names[0]
    const grp = first.includes('$') ? first.split('$')[0] : first
    if (grp) return grp
  }
  return (fallbackName || 'report').replace(/\.[^.]+$/, '')
}

// Parse file chính theo mode → cùng định dạng kết quả với parseZipSet
async function parsePrimary(file, mode) {
  if (mode === 'property') {
    const text = await file.text()
    const props = parseIvrProperties(text)
    return { bivrName: file.name, flows: {}, propsFiles: [{ name: file.name, text }], detail: { env: inferEnvFromProps(props), flows: [] } }
  }
  if (mode === 'flow') {
    const flows = await parseBivr(file)
    return { bivrName: file.name, flows, propsFiles: [], detail: { env: null, flows: flowsToDetail(flows) } }
  }
  return await parseZipSet(file)
}

// ── Lang ──────────────────────────────────────────────────────────────────────
function applyLang(lang) {
  state.lang = lang
  window._lang = lang
  document.documentElement.lang = lang
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'))
  })
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'))
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

// Parse the primary upload (mode-aware: zip / .bivr / .md), then show a badge
async function onPrimaryUpload(file) {
  const badge = document.getElementById('zipDetected')
  badge.hidden = false
  badge.innerHTML = `<span class="detected-loading"><i class="fa-solid fa-spinner fa-spin"></i></span>`
  try {
    const result = await parsePrimary(file, state.mode)
    state.parsed.zip = result
    renderDetected(badge, result)
  } catch (err) {
    state.parsed.zip = null
    badge.innerHTML = `<span class="detected-err"><i class="fa-solid fa-circle-exclamation"></i> ${err.message}</span>`
  }
}

// Parse a compare zip (always a full export zip) to detect env + flows
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
  const flows = result.detail.flows || []
  const main = flows.filter(f => f.kind === 'main').length
  const sub = flows.filter(f => f.kind === 'sub').length
  let html = `<span class="detected-pill ${envCls}"><i class="fa-solid fa-server"></i> ${t('detected_env')}: <b>${envText}</b></span>`
  if (flows.length) {
    html += `<span class="detected-pill"><i class="fa-solid fa-diagram-project"></i> ${t('detected_flows')}: <b>${flows.length}</b>
      <span class="detected-sub">(${t('detected_main')} ${main} / ${t('detected_sub')} ${sub})</span></span>`
  }
  if (result.propsFiles.length) {
    html += `<span class="detected-pill"><i class="fa-solid fa-sliders"></i> ${t('detected_props')}: <b>${result.propsFiles.length}</b></span>`
  }
  badge.innerHTML = html
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

  // Upload layout: one file, or two zips for compare
  const isCompare = mode === 'compare'
  document.getElementById('singleUpload').hidden = isCompare
  document.getElementById('compareUpload').hidden = !isCompare

  // Configure the single-file upload zone for this mode (label / hint / accept / icon)
  const cfg = UPLOAD_MODE[mode]
  if (cfg) {
    const lblText = document.getElementById('zipLabelText')
    lblText.setAttribute('data-i18n', cfg.labelKey)
    lblText.textContent = t(cfg.labelKey)
    const hint = document.getElementById('zipHint')
    if (cfg.hintKey) {
      hint.setAttribute('data-i18n', cfg.hintKey)
      hint.textContent = t(cfg.hintKey)
      hint.hidden = false
    } else {
      hint.removeAttribute('data-i18n')
      hint.textContent = ''
      hint.hidden = true
    }
    document.getElementById('zipInput').accept = cfg.accept
    document.getElementById('zipIcon').className = 'fa-solid ' + cfg.icon
    // File type differs per mode → clear any previously selected primary file
    clearFile('zipFile', 'zipZone', 'zipInput', 'zip', 'zipDetected')
  }

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

  // Hide a category when it has no visible checks
  document.querySelectorAll('#checksGrid .check-cat').forEach(cat => {
    const anyVisible = [...cat.querySelectorAll('.check-label')].some(l => !l.hidden)
    cat.hidden = !anyVisible
  })
  // Hide a whole column when all its categories are hidden
  document.querySelectorAll('#checksGrid .check-col').forEach(col => {
    const anyVisible = [...col.querySelectorAll('.check-cat')].some(c => !c.hidden)
    col.hidden = !anyVisible
  })

  // Scroll the newly revealed section into view
  document.getElementById('modeDetail').scrollIntoView({ behavior: 'smooth', block: 'nearest' })

  syncCheckAllBtn()
}

// ── Collapsible cards ───────────────────────────────────────────────────────--
function setCollapsed(target, collapsed) {
  const body = document.getElementById(target)
  const btn = document.querySelector(`.collapse-btn[data-target="${target}"]`)
  if (!body || !btn) return
  btn.setAttribute('aria-expanded', String(!collapsed))
  if (collapsed) {
    body.style.maxHeight = body.scrollHeight + 'px'
    void body.offsetHeight // force reflow
    body.classList.add('collapsed')
  } else {
    body.classList.remove('collapsed')
    body.style.maxHeight = body.scrollHeight + 'px'
    body.addEventListener('transitionend', function clear() {
      body.style.maxHeight = ''
      body.removeEventListener('transitionend', clear)
    })
  }
}
function toggleCollapsed(target) {
  const body = document.getElementById(target)
  setCollapsed(target, !body.classList.contains('collapsed'))
}

// ── Checks state ──────────────────────────────────────────────────────────────
function getSelectedChecks() {
  return [...document.querySelectorAll('#checksGrid .check-input:checked:not(:disabled)')].map(cb => cb.value)
}

function getToggleableChecks() {
  return [...document.querySelectorAll('#checksGrid .check-input:not(:disabled)')]
    .filter(cb => !cb.closest('.check-label').hidden)
}

// Reflect current checkbox state in the check-all button label
function syncCheckAllBtn() {
  const cbs = getToggleableChecks()
  const allChecked = cbs.length > 0 && cbs.every(cb => cb.checked)
  const b = document.getElementById('checkAllBtn')
  const key = allChecked ? 'check_none' : 'check_all'
  b.setAttribute('data-i18n', key)
  b.textContent = t(key)
}

// ── Error message ─────────────────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('errorMsg')
  el.textContent = msg
  el.style.display = 'flex'
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
        groupName: deriveGroupName(demo.flows, demo.bivrName),
        diffIssues,
      }
    } else {
      if (!state.zipFile) return showError(t('err_no_zip'))
      setBusy(true)
      const set = state.parsed.zip || await parsePrimary(state.zipFile, state.mode)
      state.parsed.zip = set
      const env = set.detail.env
      const wantApi = selected.includes('api')
      const wantProps = selected.some(c => PROPS_CHECKS.has(c))

      if (wantProps && !set.propsFiles.length) return showError(t('err_need_props'))
      if (wantApi && !env) return showError(t('err_no_env'))

      let apiIssues = null, phoneIssues = null, jumpIssues = null
      let promptIssues = null, ctxrouterIssues = null, regexIssues = null
      let openaiIssues = null, reconfirmIssues = null, flagIssues = null, submodIssues = null

      if (wantApi) {
        apiIssues = []
        for (const pf of set.propsFiles) {
          const props = parseIvrProperties(pf.text)
          apiIssues.push(...checkApiUrls(props, env))
        }
      }
      if (selected.includes('prompt')) {
        const mergedProps = {}
        for (const pf of set.propsFiles) Object.assign(mergedProps, parseIvrProperties(pf.text))
        promptIssues = checkPromptTts(set.flows, mergedProps)
      }
      if (selected.includes('phone')) phoneIssues = checkPhoneNumbers(set.flows)
      if (selected.includes('jump')) jumpIssues = checkJumpToFlow(set.flows)
      if (selected.includes('ctxrouter')) ctxrouterIssues = checkContextRouter(set.flows)
      if (selected.includes('regex')) regexIssues = checkRegexSpace(set.flows)
      if (selected.includes('openai')) openaiIssues = checkOpenaiModule(set.flows)
      if (selected.includes('reconfirm')) reconfirmIssues = checkReconfirm(set.flows)
      if (selected.includes('flag')) flagIssues = checkCompletionFlag(set.flows)
      if (selected.includes('submod')) submodIssues = checkSubModule(set.flows)

      state.lastRun = {
        mode: state.mode,
        env,
        bivrName: set.bivrName,
        groupName: deriveGroupName(set.flows, set.bivrName),
        apiIssues, phoneIssues, jumpIssues,
        promptIssues, ctxrouterIssues, regexIssues,
        openaiIssues, reconfirmIssues, flagIssues, submodIssues,
      }
    }

    rerenderReport()
    setDownloadName()
    const step3 = document.getElementById('step3')
    step3.hidden = false
    // Auto-collapse the setting card, ensure results are expanded
    setCollapsed('settingBody', true)
    setCollapsed('resultBody', false)
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

  const all = [
    ...(r.apiIssues || []), ...(r.phoneIssues || []), ...(r.jumpIssues || []), ...(r.diffIssues || []),
    ...(r.promptIssues || []), ...(r.ctxrouterIssues || []), ...(r.regexIssues || []),
    ...(r.openaiIssues || []), ...(r.reconfirmIssues || []), ...(r.flagIssues || []),
    ...(r.submodIssues || []),
  ]
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

// Default download filename = "<group>_検証レポート"
function setDownloadName() {
  const input = document.getElementById('downloadName')
  if (!input || !state.lastRun) return
  const grp = state.lastRun.groupName || 'report'
  input.value = `${grp}_${t('download_suffix')}`
}

// ── Download report ───────────────────────────────────────────────────────────
function downloadReport() {
  if (!state.lastReport) return
  const input = document.getElementById('downloadName')
  let base = (input.value || '').trim().replace(/\.md$/i, '').trim()
  if (!base) { showError(t('err_no_filename')); return }
  const blob = new Blob([state.lastReport], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = base + '.md'
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
  setupUploadZone('zipZone', 'zipInput', 'zipFile', f => onPrimaryUpload(f))
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
    const cbs = getToggleableChecks()
    const allChecked = cbs.length > 0 && cbs.every(cb => cb.checked)
    cbs.forEach(cb => { cb.checked = !allChecked })
    syncCheckAllBtn()
  })

  // Per-group select-all / deselect-all toggle
  document.querySelectorAll('.cat-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.closest('.check-cat')
      const cbs = [...cat.querySelectorAll('.check-input:not(:disabled)')]
        .filter(cb => !cb.closest('.check-label').hidden)
      if (!cbs.length) return
      const allChecked = cbs.every(cb => cb.checked)
      cbs.forEach(cb => { cb.checked = !allChecked })
      syncCheckAllBtn()
    })
  })

  // Keep the check-all button label in sync when individual checks change
  document.querySelectorAll('#checksGrid .check-input').forEach(cb => {
    cb.addEventListener('change', syncCheckAllBtn)
  })

  document.getElementById('runBtn').addEventListener('click', runChecks)
  document.getElementById('downloadBtn').addEventListener('click', downloadReport)

  // Collapse / expand toggles
  document.querySelectorAll('.collapse-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleCollapsed(btn.dataset.target))
  })

  applyLang('ja')
})
