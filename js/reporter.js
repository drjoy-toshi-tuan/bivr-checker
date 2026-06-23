// ── Markdown report generator (bilingual) ────────────────────────────────────
const SEV_EMOJI = { ERROR: '🔴', WARNING: '🟡', INFO: '🔵' }
const _FLOW_SEP = ' ／ '
const _JUMP_NOTE_KEY = {
  ok: 'jump_note_ok',
  invalid: 'jump_note_invalid',
  empty: 'jump_note_empty',
  empty_subflow: 'jump_note_empty_subflow',
}

function _t(key) { return t(key) }
function _fmtFlow(name) {
  return name ? name.replace(/\$/g, _FLOW_SEP) : ''
}

function _renderApiSection(issues, envLabel) {
  const lines = [`## ${_t('sec_api')}`, '']
  if (!issues.length) {
    lines.push(_t('api_ok'), '')
    return lines
  }
  for (const i of issues) {
    const e = SEV_EMOJI[i.severity] || '⚪'
    const lbl = _t('sev_' + i.severity.toLowerCase())
    lines.push(
      `### ${e} ${lbl} — \`${i.field}\``, '',
      `- **${_t('lbl_desc')}**: ${_t('type_' + _typeKey(i.type))}`,
      `- **${_t('lbl_actual')}**: \`${i.actual || '（なし / không có）'}\``,
      `- **${_t('lbl_expected')}**: \`${i.expected}\``,
      '',
    )
  }
  return lines
}

function _renderPhoneSection(issues) {
  const lines = [`## ${_t('sec_phone')}`, '']
  const transfers = issues.filter(i => i.type === 'transfer_number')
  const warnings = issues.filter(i => i.severity === 'WARNING')

  if (transfers.length) {
    lines.push(`### ${_t('phone_tbl_header')}`, '')
    lines.push(`| ${_t('col_flow')} | ${_t('col_module')} | ${_t('col_number')} | ${_t('col_note')} |`)
    lines.push('|---|---|---|---|')
    for (const i of transfers) {
      const note = i.isTest ? _t('test_flag') : ''
      lines.push(`| \`${_fmtFlow(i.flow)}\` | \`${i.module}\` | \`${i.number}\` | ${note} |`)
    }
    lines.push('')
  } else {
    lines.push(`🟢 ${_t('phone_no_transfers')}`, '')
  }

  if (!warnings.length) {
    lines.push(_t('phone_ok'), '')
  } else {
    for (const i of warnings) {
      const e = SEV_EMOJI[i.severity] || '⚪'
      const lbl = _t('sev_' + i.severity.toLowerCase())
      lines.push(
        `### ${e} ${lbl} — Flow: \`${_fmtFlow(i.flow)}\``, '',
        `- **${_t('lbl_module')}**: \`${i.module}\``,
        `- **${_t('lbl_number')}**: \`${i.number}\``,
        `- **${_t('lbl_desc')}**: ${_t('type_' + _typeKey(i.type))}`,
        '',
      )
    }
  }
  return lines
}

function _renderJumpSection(issues) {
  const lines = [`## ${_t('sec_jump')}`, '']
  const jumpModules = issues.filter(i => i.type === 'jump_module')
  const problems = issues.filter(i => i.type === 'empty_jump_target' || i.type === 'invalid_jump_target')

  if (jumpModules.length) {
    lines.push(`### ${_t('jump_tbl_header')}`, '')
    lines.push(`| ${_t('col_flow')} | ${_t('col_module')} | ${_t('col_jump_target')} | ${_t('col_note')} |`)
    lines.push('|---|---|---|---|')
    for (const i of jumpModules) {
      const target = i.target ? `\`${_fmtFlow(i.target)}\`` : `(${_t('jump_no_target')})`
      const note = _t(_JUMP_NOTE_KEY[i.status] || 'jump_note_ok')
      lines.push(`| \`${_fmtFlow(i.flow)}\` | \`${i.module}\` | ${target} | ${note} |`)
    }
    lines.push('')
  } else {
    lines.push(`🟢 ${_t('jump_no_modules')}`, '')
  }

  if (!problems.length) {
    lines.push(_t('jump_ok'), '')
  } else {
    for (const i of problems) {
      const e = SEV_EMOJI[i.severity] || '⚪'
      const lbl = _t('sev_' + i.severity.toLowerCase())
      const subNote = (i.type === 'empty_jump_target' && i.severity === 'WARNING') ? ' ' + _t('subflow_note') : ''
      const targetNote = i.target ? ` — ${_t('lbl_target')}: \`${_fmtFlow(i.target)}\`` : ''
      lines.push(
        `### ${e} ${lbl} — Flow: \`${_fmtFlow(i.flow)}\``, '',
        `- **${_t('lbl_module')}**: \`${i.module}\``,
        `- **${_t('lbl_desc')}**: ${_t('type_' + _typeKey(i.type))}${targetNote}${subNote}`,
        '',
      )
    }
  }
  return lines
}

function _renderDiffSection(issues, compareName, baseEnvLabel, newEnvLabel) {
  const lines = [`## ${_t('sec_diff')}`, '']
  if (baseEnvLabel && newEnvLabel) {
    lines.push(`**${baseEnvLabel} → ${newEnvLabel}**`, '')
  }
  lines.push(`**${_t('diff_compare_file')}**: \`${compareName}\``, '')
  if (!issues.length) {
    lines.push(`🟢 ${_t('diff_ok')}`, '')
    return lines
  }
  const byFlow = {}
  for (const i of issues) {
    if (!byFlow[i.flow]) byFlow[i.flow] = []
    byFlow[i.flow].push(i)
  }
  for (const [flow, flowIssues] of Object.entries(byFlow)) {
    lines.push(`### Flow: \`${_fmtFlow(flow)}\``, '')
    for (const i of flowIssues) {
      const e = SEV_EMOJI[i.severity] || '⚪'
      const desc = _t('type_' + _typeKey(i.type))
      const detail = i.detail ? ` — ${i.detail}` : ''
      lines.push(`- ${e} **${desc}**${detail}`)
    }
    lines.push('')
  }
  return lines
}

function _typeKey(type) {
  const map = {
    missing_field: 'missing_field',
    value_mismatch: 'value_mismatch',
    transfer_number: 'transfer_number',
    test_number_in_transfer: 'test_in_transfer',
    test_number_in_prompt: 'test_in_prompt',
    jump_module: 'jump_module',
    empty_jump_target: 'empty_jump',
    invalid_jump_target: 'invalid_jump',
    flow_removed: 'flow_removed',
    flow_added: 'flow_added',
    start_changed: 'start_changed',
    module_removed: 'mod_removed',
    module_added: 'mod_added',
    module_type_changed: 'mod_type_changed',
    module_params_changed: 'mod_params_changed',
    module_transitions_changed: 'mod_transitions_changed',
  }
  return map[type] || type
}

function envLabel(env) {
  if (env === 'master') return _t('env_master')
  if (env === 'demo') return _t('env_demo')
  return _t('env_unknown')
}

// ── Generic section (các check hỗn hợp — định dạng giống mục 「転送」) ──────────
function _issueDetailBullets(i) {
  const out = []
  if (i.object) out.push(`- object: \`<%${i.object}%>\``)
  if (i.ref) out.push(`- ${_t('lbl_value')}: \`${i.ref}\``)
  if (i.node) out.push(`- nodeName: \`${i.node}\``)
  if (i.label) out.push(`- label: \`${i.label}\``)
  if (i.slot) out.push(`- ${_t('lbl_slot')}: \`${i.slot}\``)
  if (i.field) out.push(`- field: \`${i.field}\``)
  if (i.condition) out.push(`- regex: \`${i.condition}\``)
  if (i.value) {
    const v = i.value.length <= 80 ? i.value : i.value.slice(0, 80) + '…'
    out.push(`- ${_t('lbl_value')}: \`${v}\``)
  }
  return out
}

function _renderGenericSection(title, issues, okMsg) {
  const lines = [`## ${title}`, '']
  if (!issues.length) {
    lines.push(okMsg, '')
    return lines
  }
  const errors = issues.filter(i => i.severity === 'ERROR').length
  const warnings = issues.filter(i => i.severity === 'WARNING').length
  lines.push(`🔴 ${errors} ${_t('errors_label')}　🟡 ${warnings} ${_t('warnings_label')}`, '')

  for (const i of issues) {
    const e = SEV_EMOJI[i.severity] || '⚪'
    const lbl = _t('sev_' + i.severity.toLowerCase())
    const loc = i.flow ? `Flow: \`${_fmtFlow(i.flow)}\`` : _t('sec_ivr_property')
    lines.push(`### ${e} ${lbl} — ${loc}`, '')
    if (i.module) lines.push(`- **${_t('lbl_module')}**: \`${i.module}\``)
    lines.push(`- **${_t('lbl_desc')}**: ${_t('type_' + _typeKey(i.type))}`)
    lines.push(..._issueDetailBullets(i))
    lines.push('')
  }
  return lines
}

function generateReport(opts) {
  const {
    bivrName, compareName = null, env, demoEnv = null, masterEnv = null,
    apiIssues = null, phoneIssues = null, jumpIssues = null, diffIssues = null,
    promptIssues = null, ctxrouterIssues = null, regexIssues = null,
    openaiIssues = null, reconfirmIssues = null, flagIssues = null, submodIssues = null,
    scriptIssues = null, entityIssues = null,
  } = opts
  const envText = envLabel(env)
  const now = new Date().toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const all = [
    ...(apiIssues || []), ...(phoneIssues || []), ...(jumpIssues || []), ...(diffIssues || []),
    ...(promptIssues || []), ...(ctxrouterIssues || []), ...(regexIssues || []),
    ...(openaiIssues || []), ...(reconfirmIssues || []), ...(flagIssues || []),
    ...(submodIssues || []), ...(scriptIssues || []), ...(entityIssues || []),
  ]
  const totalErrors = all.filter(i => i.severity === 'ERROR').length
  const totalWarnings = all.filter(i => i.severity === 'WARNING').length
  const verdict = totalErrors === 0 ? '✅ PASS' : '❌ FAIL'

  const lines = [
    `# ${_t('rpt_title')}`, '',
    '| | |', '|---|---|',
    `| **${_t('rpt_file')}** | \`${bivrName}\` |`,
    `| **${_t('rpt_env')}** | ${envText} |`,
    `| **${_t('rpt_time')}** | ${now} |`,
    `| **${_t('rpt_result')}** | ${verdict} |`,
    '', '---', '',
    `## ${_t('rpt_overview')}`, '',
    '| | |', '|---|---|',
    `| 🔴 ${_t('rpt_errors')} | **${totalErrors}** |`,
    `| 🟡 ${_t('rpt_warnings')} | **${totalWarnings}** |`,
    '', '---', '',
  ]

  const sections = []
  if (apiIssues !== null) sections.push(_renderApiSection(apiIssues, envText))
  if (phoneIssues !== null) sections.push(_renderPhoneSection(phoneIssues))
  if (jumpIssues !== null) sections.push(_renderJumpSection(jumpIssues))
  if (promptIssues !== null) sections.push(_renderGenericSection(_t('sec_prompt'), promptIssues, _t('no_issues')))
  if (ctxrouterIssues !== null) sections.push(_renderGenericSection(_t('sec_ctxrouter'), ctxrouterIssues, _t('no_issues')))
  if (regexIssues !== null) sections.push(_renderGenericSection(_t('sec_regex'), regexIssues, _t('no_issues')))
  if (openaiIssues !== null) sections.push(_renderGenericSection(_t('sec_openai'), openaiIssues, _t('no_issues')))
  if (reconfirmIssues !== null) sections.push(_renderGenericSection(_t('sec_reconfirm'), reconfirmIssues, _t('no_issues')))
  if (flagIssues !== null) sections.push(_renderGenericSection(_t('sec_flag'), flagIssues, _t('no_issues')))
  if (submodIssues !== null) sections.push(_renderGenericSection(_t('sec_submod'), submodIssues, _t('no_issues')))
  if (scriptIssues !== null) sections.push(_renderGenericSection(_t('sec_script'), scriptIssues, _t('no_issues')))
  if (entityIssues !== null) sections.push(_renderGenericSection(_t('sec_entity'), entityIssues, _t('no_issues')))
  if (diffIssues !== null) sections.push(_renderDiffSection(diffIssues, compareName || '', envLabel(masterEnv), envLabel(demoEnv)))

  for (let i = 0; i < sections.length; i++) {
    lines.push(...sections[i])
    if (i < sections.length - 1) lines.push('---', '')
  }

  return lines.join('\n')
}
