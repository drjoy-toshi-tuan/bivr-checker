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

// ── Module types cho các check hỗn hợp (Property + Flow) ──────────────────────--
const TTS_RECONFIRM = 'drjoy^Text To Speech$Re-confirmation node data'
const TTS_RETRY_COUNTER = 'drjoy^Text To Speech$Speech Retry Counter'
const DTMF_CUSTOM = 'drjoy^External Integration$DTMF Custom'
const DTMF_AMIVOICE = 'drjoy^External Integration$DTMF AmiVoice STT Input'
const PHONE_NORMALIZATION = 'drjoy^TS Custom Module$Phone Normalization'
const DOB_RECONFIRM = 'drjoy^TS Custom Module$DOB Re-confirmation'
const CONTEXT_MATCH_ROUTER = 'drjoy^Context Logic$ContextMatchRouter'
const GENERATE_BY_OPENAI = 'drjoy^External Integration$generate_by_OpenAI'
const SAVE_COMPLETION_FLAG = 'drjoy^Persistence$saveCompletionFlag2db'
const SAVE2DB = 'drjoy^Persistence$save2db'
const SAVE_CONTEXT2DB = 'drjoy^Persistence$saveContext2DB'
const MODULE_RESULT_BINDER = 'drjoy^TS Custom Module$Module Result Binder'
const SCRIPT_TYPE = '@General$Script'

// Module dùng 1 prompt TTS duy nhất (params.prompt = {tts_g/tts_ai:...})
const PROMPT_SINGLE_MODULES = new Set([TTS_TYPE, TTS_RECONFIRM, PHONE_NORMALIZATION, DOB_RECONFIRM])
// Module DTMF: params.prompt = "{recstart}" (marker), TTS thật ở params.prompt_retry
const DTMF_MODULES = new Set([DTMF_CUSTOM, DTMF_AMIVOICE])
// Object hệ thống (built-in) — luôn coi như đã tạo
const BUILTIN_OBJECTS = new Set(['incoming_phone'])
const CATCH_ALL = new Set(['^.*$', '^.+$'])

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
        const isSub = isSubflow(flowName)
        const severity = isSub ? 'WARNING' : 'ERROR'
        const status = isSub ? 'empty_subflow' : 'empty'
        issues.push({ type: 'jump_module', severity: 'INFO', flow: flowName, module: modName, target: null, status })
        issues.push({ type: 'empty_jump_target', severity, flow: flowName, module: modName, target: null })
        continue
      }
      const target = flowname.startsWith('drjoy^') ? flowname.slice('drjoy^'.length) : flowname
      const valid = flowNames.has(target)
      issues.push({ type: 'jump_module', severity: 'INFO', flow: flowName, module: modName, target, status: valid ? 'ok' : 'invalid' })
      if (!valid) {
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

// ── Helpers cho check hỗn hợp (Property + Flow) ───────────────────────────────--
const _OBJECT_RE = /<%\s*([^%>]+?)\s*%>/g
const _OBJECT_ONLY_RE = /^<%\s*([^%>]+?)\s*%>$/
const _SETOBJECT_RE = /setObject\s*\(\s*["']([^"']+)["']/g

function findObjects(text) {
  if (!text) return []
  const out = []
  let m
  _OBJECT_RE.lastIndex = 0
  while ((m = _OBJECT_RE.exec(text)) !== null) out.push(m[1].trim())
  return out
}

function collectCreatedObjects(flows) {
  const objs = new Set(BUILTIN_OBJECTS)
  const add = v => { if (v && String(v).trim()) objs.add(String(v).trim()) }
  for (const flow of Object.values(flows)) {
    for (const mod of Object.values(flow.modules || {})) {
      const t = mod.type || ''
      const p = mod.params || {}
      if (t === SAVE2DB || t === SAVE_CONTEXT2DB || t === GENERATE_BY_OPENAI) {
        add(p.contextName)
      } else if (t === MODULE_RESULT_BINDER) {
        add(p.contextName); add(p.variable)
      } else if (t === SCRIPT_TYPE) {
        let m
        _SETOBJECT_RE.lastIndex = 0
        while ((m = _SETOBJECT_RE.exec(p.script || '')) !== null) add(m[1])
      }
    }
  }
  objs.delete('')
  return objs
}

function flowModuleNames(flow) {
  return new Set(Object.keys(flow.modules || {}))
}
function allModuleNames(flows) {
  const names = new Set()
  for (const flow of Object.values(flows)) for (const n of Object.keys(flow.modules || {})) names.add(n)
  return names
}

// Cú pháp prompt TTS hợp lệ: {tts_g:...} / {tts_ai:...} / {tts_ai_prop:...}{tts_ai:...}
const _TTS_G_RE = /^\{tts_g:[\s\S]*\}$/
const _TTS_AI_RE = /^\{tts_ai:[\s\S]*\}$/
const _TTS_AI_PROP_RE = /^\{tts_ai_prop:X-Aitalkd-Api-Key=.+,body_2=\{[\s\S]*\}\}\{tts_ai:[\s\S]*\}$/

function validateTtsSyntax(value) {
  if (value == null) return false
  const v = String(value).trim()
  if (!v) return false
  if (_TTS_G_RE.test(v) || _TTS_AI_RE.test(v)) return true
  if (v.startsWith('{tts_ai_prop:')) return _TTS_AI_PROP_RE.test(v)
  return false
}

// ── Check #1 (MIX): Prompt / Announce TTS ─────────────────────────────────────--
function checkPromptTts(flows, props) {
  const issues = []
  props = props || {}
  const moduleNames = allModuleNames(flows)

  // A. Các dòng .prompt trong IVR Property
  for (const [key, value] of Object.entries(props)) {
    if (!key.endsWith('.prompt')) continue
    const modName = key.slice(0, -'.prompt'.length)
    if (!validateTtsSyntax(value)) {
      issues.push({ type: 'prop_prompt_syntax', severity: 'ERROR', field: key, value })
    }
    if (!moduleNames.has(modName)) {
      issues.push({ type: 'prop_prompt_no_module', severity: 'WARNING', field: modName })
    }
  }

  // B. Prompt trong từng module TTS của flow
  for (const [flowName, flow] of Object.entries(flows)) {
    for (const [modName, mod] of Object.entries(flow.modules || {})) {
      const t = mod.type || ''
      const p = mod.params || {}
      if (PROMPT_SINGLE_MODULES.has(t)) {
        const val = (p.prompt || '').trim()
        if (val) {
          if (!validateTtsSyntax(val))
            issues.push({ type: 'flow_prompt_syntax', severity: 'ERROR', flow: flowName, module: modName, value: val })
        } else if (!(modName + '.prompt' in props)) {
          issues.push({ type: 'prompt_not_set', severity: 'ERROR', flow: flowName, module: modName })
        }
      } else if (t === TTS_RETRY_COUNTER) {
        for (const fld of ['prompt_true', 'prompt_false']) {
          const val = (p[fld] || '').trim()
          if (val && !validateTtsSyntax(val))
            issues.push({ type: 'flow_prompt_syntax', severity: 'ERROR', flow: flowName, module: modName, field: fld, value: val })
        }
      } else if (DTMF_MODULES.has(t)) {
        const val = (p.prompt_retry || '').trim()
        if (val && !validateTtsSyntax(val))
          issues.push({ type: 'flow_prompt_syntax', severity: 'ERROR', flow: flowName, module: modName, field: 'prompt_retry', value: val })
      }
    }
  }
  return issues
}

// ── Check #2 (FLOW): ContextMatchRouter — object tồn tại ──────────────────────--
function checkContextRouter(flows) {
  const issues = []
  const objects = collectCreatedObjects(flows)
  for (const [flowName, flow] of Object.entries(flows)) {
    const modNames = flowModuleNames(flow)
    for (const [modName, mod] of Object.entries(flow.modules || {})) {
      if (mod.type !== CONTEXT_MATCH_ROUTER) continue
      const p = mod.params || {}
      for (const slot of ['module1Name', 'module2Name']) {
        const raw = (p[slot] || '').trim()
        if (!raw) continue
        const m = _OBJECT_ONLY_RE.exec(raw)
        if (m) {
          const obj = m[1].trim()
          if (!objects.has(obj))
            issues.push({ type: 'ctxrouter_object_missing', severity: 'ERROR', flow: flowName, module: modName, slot, object: obj })
        } else if (!modNames.has(raw)) {
          issues.push({ type: 'ctxrouter_module_missing', severity: 'ERROR', flow: flowName, module: modName, slot, ref: raw })
        }
      }
    }
  }
  return issues
}

// ── Check #3 (FLOW): Regex condition jump dính dấu cách ───────────────────────--
function checkRegexSpace(flows) {
  const issues = []
  for (const [flowName, flow] of Object.entries(flows)) {
    for (const [modName, mod] of Object.entries(flow.modules || {})) {
      for (const nx of mod.next || []) {
        const cond = nx.condition || ''
        if (!cond) continue
        if (cond.includes(' ') || cond.includes('　')) {
          const kind = cond.includes('　') ? '全角' : '半角'
          issues.push({ type: 'regex_space', severity: 'ERROR', flow: flowName, module: modName, label: nx.label || '', condition: cond, spaceKind: kind })
        }
      }
    }
  }
  return issues
}

// ── Check #4 (FLOW): generate_by_OpenAI ───────────────────────────────────────--
function checkOpenaiModule(flows) {
  const issues = []
  for (const [flowName, flow] of Object.entries(flows)) {
    const modNames = flowModuleNames(flow)
    const refCount = {}
    const openaiMods = []
    for (const [modName, mod] of Object.entries(flow.modules || {})) {
      if (mod.type !== GENERATE_BY_OPENAI) continue
      const p = mod.params || {}
      const mref = (p.module || '').trim()
      openaiMods.push({ modName, mod, mref })
      if (mref === '' || mref === 'module' || !modNames.has(mref)) {
        const reason = mref === '' ? 'empty' : (mref === 'module' ? 'literal' : 'not_found')
        issues.push({ type: 'openai_module_invalid', severity: 'ERROR', flow: flowName, module: modName, ref: mref, reason })
      } else {
        refCount[mref] = (refCount[mref] || 0) + 1
      }
      const conds = new Set((mod.next || []).map(n => n.condition || ''))
      if (![...conds].some(c => CATCH_ALL.has(c)))
        issues.push({ type: 'openai_no_catchall', severity: 'WARNING', flow: flowName, module: modName })
    }
    const dup = new Set(Object.entries(refCount).filter(([, c]) => c >= 2).map(([r]) => r))
    for (const { modName, mref } of openaiMods) {
      if (dup.has(mref))
        issues.push({ type: 'openai_dup_module', severity: 'WARNING', flow: flowName, module: modName, ref: mref })
    }
  }
  return issues
}

// ── Check #5 (FLOW): Re-confirmation node data ────────────────────────────────--
function checkReconfirm(flows) {
  const issues = []
  const objects = collectCreatedObjects(flows)
  for (const [flowName, flow] of Object.entries(flows)) {
    const modNames = flowModuleNames(flow)
    for (const [modName, mod] of Object.entries(flow.modules || {})) {
      if (mod.type !== TTS_RECONFIRM) continue
      const prompt = (mod.params || {}).prompt || ''
      for (const obj of findObjects(prompt)) {
        if (!objects.has(obj))
          issues.push({ type: 'reconfirm_object_missing', severity: 'ERROR', flow: flowName, module: modName, object: obj })
      }
      if (prompt.includes('#data#')) {
        const node = ((mod.params || {}).nodeName || '').trim()
        if (!node) issues.push({ type: 'reconfirm_nodename_empty', severity: 'ERROR', flow: flowName, module: modName })
        else if (!modNames.has(node)) issues.push({ type: 'reconfirm_nodename_missing', severity: 'ERROR', flow: flowName, module: modName, node })
      }
    }
  }
  return issues
}

// ── Check #6 (FLOW): saveCompletionFlag2db ────────────────────────────────────--
function checkCompletionFlag(flows) {
  const issues = []
  for (const [flowName, flow] of Object.entries(flows)) {
    for (const [modName, mod] of Object.entries(flow.modules || {})) {
      if (mod.type !== SAVE_COMPLETION_FLAG) continue
      const p = mod.params || {}
      for (const [fld, itype] of [['status', 'flag_status_empty'], ['smsFlag', 'flag_sms_empty']]) {
        if (!(p[fld] || '').trim())
          issues.push({ type: itype, severity: 'WARNING', flow: flowName, module: modName, field: fld })
      }
    }
  }
  return issues
}
