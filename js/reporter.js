// ── Markdown report generator (bilingual) ────────────────────────────────────
const SEV_EMOJI = { ERROR: '🔴', WARNING: '🟡', INFO: '🔵' }

function _t(key) { return t(key) }

function _renderApiSection(issues, envLabel) {
  const lines = [`## ${_t('sec_api')}`, '']
  if (!issues.length) {
    lines.push(`🟢 ${_t('api_ok')}`, '')
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
      lines.push(`| \`${i.flow}\` | \`${i.module}\` | \`${i.number}\` | ${note} |`)
    }
    lines.push('')
  } else {
    lines.push(`🟢 ${_t('phone_no_transfers')}`, '')
  }

  if (!warnings.length) {
    lines.push(`🟢 ${_t('phone_ok')}`, '')
  } else {
    for (const i of warnings) {
      const e = SEV_EMOJI[i.severity] || '⚪'
      const lbl = _t('sev_' + i.severity.toLowerCase())
      lines.push(
        `### ${e} ${lbl} — Flow: \`${i.flow}\``, '',
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
  if (!issues.length) {
    lines.push(`🟢 ${_t('jump_ok')}`, '')
    return lines
  }
  for (const i of issues) {
    const e = SEV_EMOJI[i.severity] || '⚪'
    const lbl = _t('sev_' + i.severity.toLowerCase())
    const subNote = (i.type === 'empty_jump_target' && i.severity === 'WARNING') ? ' ' + _t('subflow_note') : ''
    const targetNote = i.target ? ` — ${_t('lbl_target')}: \`${i.target}\`` : ''
    lines.push(
      `### ${e} ${lbl} — Flow: \`${i.flow}\``, '',
      `- **${_t('lbl_module')}**: \`${i.module}\``,
      `- **${_t('lbl_desc')}**: ${_t('type_' + _typeKey(i.type))}${targetNote}${subNote}`,
      '',
    )
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
    lines.push(`### Flow: \`${flow}\``, '')
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

function generateReport(opts) {
  const {
    bivrName, compareName = null, env, demoEnv = null, masterEnv = null,
    apiIssues = null, phoneIssues = null, jumpIssues = null, diffIssues = null,
  } = opts
  const envText = envLabel(env)
  const now = new Date().toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const all = [...(apiIssues || []), ...(phoneIssues || []), ...(jumpIssues || []), ...(diffIssues || [])]
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
  if (diffIssues !== null) sections.push(_renderDiffSection(diffIssues, compareName || '', envLabel(masterEnv), envLabel(demoEnv)))

  for (let i = 0; i < sections.length; i++) {
    lines.push(...sections[i])
    if (i < sections.length - 1) lines.push('---', '')
  }

  return lines.join('\n')
}
