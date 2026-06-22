// ── Config (ported from config/environments.yaml) ────────────────────────────
const ENV_CONFIG = {
  master: {
    'amivoice.uri': 'ws://speech.internal.assistant.com:8000/ws',
    'amivoice.language': '日本語',
    'amivoice.engine': '入力汎用',
    'amivoice.keep_filter_token': 'true',
    'amivoice.probability': '0.7',
    'amivoice.detection_flag': '検出しない',
    'amivoice.save_log': 'false',
    'pbx.db.name': 'save.db',
    'context.settings.url': 'https://reserve.drjoy.jp/api/anonymous/dr/ha/pbx/context-model',
    'acceptance_times.url': 'https://reserve.drjoy.jp/api/anonymous/dr/ha/incoming-call-by-brekeke',
    'rag_ssml.url': 'https://reserve.drjoy.jp/api/anonymous/dr/ha/rag-ssml/process-text',
    'openAI_generate.url': 'https://reserve.drjoy.jp/api/anonymous/dr/ha/openai/generate-text',
    'speech.rag.url': 'http://speech.internal.assistant.com:8000/api/v1/rag',
    'speech.rag.connect_timeout': '2',
    'speech.rag.request_timeout': '3',
    'speech.rag.credibility': '0',
    'entity_classifier.url': 'https://reserve.drjoy.jp/api/anonymous/dr/ha/brekeke-entity-classification',
    'get-intonation-from-drjoy.url': 'https://reserve.drjoy.jp/api/anonymous/dr/ha/brekeke-replace-intonation',
    'drjoy.save.url': 'https://reserve.drjoy.jp/api/anonymous/dr/ha/brekeke-booking-ai',
    'phone_2_name.url': 'https://reserve.drjoy.jp/api/anonymous/dr/ha/phone-to-name',
  },
  demo: {
    'amivoice.uri': 'ws://10.0.20.11:8000/ws',
    'amivoice.language': '日本語',
    'amivoice.engine': '入力汎用',
    'amivoice.keep_filter_token': 'true',
    'amivoice.probability': '0.7',
    'amivoice.detection_flag': '検出しない',
    'amivoice.save_log': 'false',
    'pbx.db.name': 'save.db',
    'context.settings.url': 'https://demo-reserve.famishare.jp/api/anonymous/dr/ha/pbx/context-model',
    'acceptance_times.url': 'https://demo-reserve.famishare.jp/api/anonymous/dr/ha/incoming-call-by-brekeke',
    'rag_ssml.url': 'https://demo-reserve.famishare.jp/api/anonymous/dr/ha/rag-ssml/process-text',
    'openAI_generate.url': 'https://demo-reserve.famishare.jp/api/anonymous/dr/ha/openai/generate-text',
    'speech.rag.url': 'http://10.0.20.11:8000/api/v1/rag',
    'speech.rag.connect_timeout': '2',
    'speech.rag.request_timeout': '3',
    'speech.rag.credibility': '0',
    'entity_classifier.url': 'https://demo-reserve.famishare.jp/api/anonymous/dr/ha/brekeke-entity-classification',
    'get-intonation-from-drjoy.url': 'https://demo-reserve.famishare.jp/api/anonymous/dr/ha/brekeke-replace-intonation',
    'drjoy.save.url': 'https://demo-reserve.famishare.jp/api/anonymous/dr/ha/brekeke-booking-ai',
    'phone_2_name.url': 'https://demo-reserve.famishare.jp/api/anonymous/dr/ha/phone-to-name',
  },
}
const OPTIONAL_FIELDS = new Set(['announce', 'office_id', 'amivoice.silent_detection_ms', 'amivoice.timeout_ms'])
const TEST_NUMBERS = new Set(['05017074509', '05017066071', '05017405708', '05017070320'])
const SUBFLOW_MARKERS = ['S｜', 'Ｓ｜', 'サブ｜', 'サブ', 'Sub｜', 'Sub', 'sub｜', 'sub']
const MAINFLOW_MARKERS = ['M｜', 'Ｍ｜', 'メイン｜', 'メイン', 'Main｜', 'Main', 'main｜', 'main']
const JUMP_TYPE = 'drjoy^Custom Module$Custom Jump to Flow'
const TRANSFER_TYPE = 'drjoy^Call Transfer$call-transfer'
const TTS_TYPE = 'drjoy^Text To Speech$Text to speech'

// ── Parsers ───────────────────────────────────────────────────────────────────
async function parseBivr(file) {
  const zip = await JSZip.loadAsync(file)
  const flows = {}
  for (const [path, entry] of Object.entries(zip.files)) {
    if (!path.startsWith('flows/') || !path.endsWith('.txt') || entry.dir) continue
    try {
      const text = await entry.async('text')
      const data = JSON.parse(text)
      if (data.name) flows[data.name] = data
    } catch (_) {}
  }
  return flows
}

// ── Zip-set parser (1 zip = .bivr + ivr-property.md + エクスポート詳細.txt) ─────
async function parseZipSet(file) {
  const zip = await JSZip.loadAsync(file)
  let bivrEntry = null
  let detailText = null
  const propsFiles = [] // { name, text }

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue
    const lower = path.toLowerCase()
    const base = path.split('/').pop()
    if (lower.endsWith('.bivr')) {
      bivrEntry = entry
    } else if (lower.endsWith('ivr-property.md') || lower.endsWith('.md')) {
      propsFiles.push({ name: base, text: await entry.async('text') })
    } else if (lower.endsWith('.txt')) {
      detailText = await entry.async('text')
    }
  }

  if (!bivrEntry) {
    throw new Error('zip 内に .bivr ファイルが見つかりません / Không tìm thấy file .bivr trong zip')
  }

  const bivrBuf = await bivrEntry.async('arraybuffer')
  const flows = await parseBivr(bivrBuf)
  const detail = detailText ? parseExportDetail(detailText) : { env: null, exportTime: null, flows: [] }

  return {
    bivrName: bivrEntry.name.split('/').pop(),
    flows,
    propsFiles,
    detail,
  }
}

// ── Export-detail parser (エクスポート詳細.txt) ───────────────────────────────
function flowKind(name) {
  const part = name.includes('$') ? name.split('$').slice(1).join('$') : name
  if (MAINFLOW_MARKERS.some(m => part.startsWith(m))) return 'main'
  if (SUBFLOW_MARKERS.some(m => part.startsWith(m))) return 'sub'
  return 'other'
}

function parseExportDetail(text) {
  const res = { env: null, exportTime: null, flows: [] }
  let section = null
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('エクスポート環境')) {
      if (line.includes('本番')) res.env = 'master'
      else if (line.includes('デモ')) res.env = 'demo'
      continue
    }
    if (line.startsWith('エクスポート日時')) {
      res.exportTime = line.substring(line.indexOf(':') + 1).trim()
      continue
    }
    if (line.startsWith('【フロー】')) { section = 'flow'; continue }
    if (line.startsWith('【IVRプロパティ】')) { section = 'prop'; continue }
    if (line.startsWith('■')) continue
    if (section === 'flow') {
      const m = line.match(/^\d+\.\s+(.+)$/)
      if (m) {
        const name = m[1].trim()
        res.flows.push({ name, kind: flowKind(name) })
      }
    }
  }
  return res
}

function parseIvrProperties(text) {
  const props = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx < 0) continue
    const key = line.substring(0, idx).trim()
    let value = line.substring(idx + 1).trim()
    // Handle duplicate key prefix: "key=key=actual_value"
    if (value.startsWith(key + '=')) value = value.substring(key.length + 1)
    props[key] = value
  }
  return props
}

// ── Check: API URLs ───────────────────────────────────────────────────────────
function checkApiUrls(props, env) {
  const expected = ENV_CONFIG[env] || {}
  const issues = []
  for (const [key, expVal] of Object.entries(expected)) {
    if (OPTIONAL_FIELDS.has(key)) continue
    const actual = props[key]
    if (actual === undefined || actual === null) {
      issues.push({ type: 'missing_field', severity: 'ERROR', field: key, expected: String(expVal), actual: null })
    } else if (String(actual) !== String(expVal)) {
      issues.push({ type: 'value_mismatch', severity: 'ERROR', field: key, expected: String(expVal), actual: String(actual) })
    }
  }
  return issues
}

// ── Check: Phone numbers ──────────────────────────────────────────────────────
function normalizePhone(s) {
  return s.replace(/[-\s]/g, '')
}

function extractFromPrompt(prompt) {
  const found = []
  const ssml = /<say-as[^>]*interpret-as=["']telephone["'][^>]*>([\d\-\s]+)<\/say-as>/g
  let m
  while ((m = ssml.exec(prompt)) !== null) found.push(normalizePhone(m[1]))
  const plain = /\b(0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4})\b/g
  while ((m = plain.exec(prompt)) !== null) found.push(normalizePhone(m[1]))
  return found
}

function checkPhoneNumbers(flows) {
  const issues = []
  for (const [flowName, flowData] of Object.entries(flows)) {
    for (const [modName, mod] of Object.entries(flowData.modules || {})) {
      const params = mod.params || {}
      if (mod.type === TRANSFER_TYPE) {
        const raw = params.number || ''
        if (raw) {
          const isTest = TEST_NUMBERS.has(normalizePhone(raw))
          issues.push({ type: 'transfer_number', severity: 'INFO', flow: flowName, module: modName, number: raw, isTest })
          if (isTest) issues.push({ type: 'test_number_in_transfer', severity: 'WARNING', flow: flowName, module: modName, number: raw })
        }
      } else if (mod.type === TTS_TYPE) {
        const prompt = params.prompt || ''
        if (prompt) {
          for (const phone of extractFromPrompt(prompt)) {
            if (TEST_NUMBERS.has(phone)) {
              issues.push({ type: 'test_number_in_prompt', severity: 'WARNING', flow: flowName, module: modName, number: phone })
            }
          }
        }
      }
    }
  }
  return issues
}

// ── Check: Jump to Flow ───────────────────────────────────────────────────────
function isSubflow(flowName) {
  const part = flowName.includes('$') ? flowName.split('$').slice(1).join('$') : flowName
  return SUBFLOW_MARKERS.some(m => part.startsWith(m))
}

function checkJumpToFlow(flows) {
  const issues = []
  const flowNames = new Set(Object.keys(flows))
  for (const [flowName, flowData] of Object.entries(flows)) {
    for (const [modName, mod] of Object.entries(flowData.modules || {})) {
      if (mod.type !== JUMP_TYPE) continue
      const flowname = (mod.params || {}).flowname || ''
      if (!flowname) {
        const severity = isSubflow(flowName) ? 'WARNING' : 'ERROR'
        issues.push({ type: 'empty_jump_target', severity, flow: flowName, module: modName, target: null })
        continue
      }
      const target = flowname.startsWith('drjoy^') ? flowname.slice('drjoy^'.length) : flowname
      if (!flowNames.has(target)) {
        issues.push({ type: 'invalid_jump_target', severity: 'ERROR', flow: flowName, module: modName, target })
      }
    }
  }
  return issues
}

// ── Check: Diff ───────────────────────────────────────────────────────────────
function diffFlows(flowsBase, flowsNew) {
  const issues = []
  const baseNames = new Set(Object.keys(flowsBase))
  const newNames = new Set(Object.keys(flowsNew))

  for (const n of [...baseNames].filter(x => !newNames.has(x)).sort())
    issues.push({ type: 'flow_removed', severity: 'WARNING', flow: n, detail: null })
  for (const n of [...newNames].filter(x => !baseNames.has(x)).sort())
    issues.push({ type: 'flow_added', severity: 'INFO', flow: n, detail: null })

  for (const name of [...baseNames].filter(x => newNames.has(x)).sort()) {
    const base = flowsBase[name], nw = flowsNew[name]
    if (base.start !== nw.start)
      issues.push({ type: 'start_changed', severity: 'WARNING', flow: name, detail: `\`${base.start}\` → \`${nw.start}\`` })

    const bMods = base.modules || {}, nMods = nw.modules || {}
    const bSet = new Set(Object.keys(bMods)), nSet = new Set(Object.keys(nMods))

    for (const mod of [...bSet].filter(x => !nSet.has(x)).sort())
      issues.push({ type: 'module_removed', severity: 'WARNING', flow: name, detail: `Module \`${mod}\`` })
    for (const mod of [...nSet].filter(x => !bSet.has(x)).sort())
      issues.push({ type: 'module_added', severity: 'INFO', flow: name, detail: `Module \`${mod}\`` })

    for (const mod of [...bSet].filter(x => nSet.has(x)).sort()) {
      const bm = bMods[mod], nm = nMods[mod]
      if (bm.type !== nm.type)
        issues.push({ type: 'module_type_changed', severity: 'ERROR', flow: name, detail: `Module \`${mod}\`: \`${bm.type}\` → \`${nm.type}\`` })
      if (JSON.stringify(bm.params) !== JSON.stringify(nm.params))
        issues.push({ type: 'module_params_changed', severity: 'WARNING', flow: name, detail: `Module \`${mod}\`` })
      if (JSON.stringify(bm.next) !== JSON.stringify(nm.next))
        issues.push({ type: 'module_transitions_changed', severity: 'WARNING', flow: name, detail: `Module \`${mod}\`` })
    }
  }
  return issues
}
