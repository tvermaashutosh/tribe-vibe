import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { exportToExcel } from '../export/exportToExcel.js';
import { exportAboutPdf } from '../export/exportAboutPdf.js';
import { runDiagnostics } from '../diagnostics/runDiagnostics.js';
import { resetAllData } from '../repository/resetAllData.js';
import { STATUS_ICON, STATUS_COLOR } from './statusLevel.js';
import { theme } from './theme.js';

// `editing` holds the raw settings key ('top') — this maps it to the
// human-facing word used in prompts/messages, so a reader never sees the
// internal key name itself. Only one editable setting exists today, but
// this stays a map (not an inline ternary) so a second one doesn't need its
// own branch bolted on later.
const SETTING_LABEL = { top: 'result' };

export default function Settings({ ctx, onBack }) {
  const [mode, setMode] = useState('list');
  const [editing, setEditing] = useState(null);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState(null);
  // Export success/failure are a genuine outcome pair, not a validation —
  // previously always rendered green even on failure; now tracked properly.
  const [statusLevel, setStatusLevel] = useState('success');
  const [diagnostics, setDiagnostics] = useState(null);

  const showStatus = (message, level = 'success') => {
    setStatus(message);
    setStatusLevel(level);
  };

  useInput((input, key) => {
    if (!key.escape) return;
    showStatus(null);
    if (editing) return setEditing(null);
    if (mode === 'troubleshoot' || mode === 'confirmReset') return setMode('list');
    return onBack();
  });

  const items = [
    { label: 'ℹ About', value: '__about__' },
    { label: `⚙ Result count: ${ctx.settings.top}`, value: 'top' },
    { label: '⚕ Troubleshoot', value: '__troubleshoot__' },
    { label: '⇩ Export data', value: '__export__' },
    { label: '⚠ Reset all data', value: '__resetAll__' },
    { label: '‹ Back', value: '__back__' },
  ];

  if (editing) {
    return (
      <Box flexDirection="column">
        <Text>New value for {SETTING_LABEL[editing] ?? editing}:</Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={() => {
            const parsed = Number(value);
            // Number('') is 0, not NaN — an empty submit would otherwise
            // silently save 0. Anything that isn't a positive whole number
            // (empty, 0, negative, non-numeric) keeps whatever was already
            // saved instead, with a warning explaining why.
            const isValid = value.trim() !== '' && Number.isInteger(parsed) && parsed > 0;
            if (isValid) {
              // saveSettings mutates ctx.settings in place (see
              // SettingsRepository.save) — every other screen holding the
              // same object reference sees this update too, no manual
              // re-patch needed here anymore.
              ctx.saveSettings({ ...ctx.settings, [editing]: parsed });
            } else {
              showStatus(
                `"${value}" isn't a positive whole number — kept ${SETTING_LABEL[editing] ?? editing}: ${ctx.settings[editing]}`,
                'warning',
              );
            }
            setEditing(null);
            setValue('');
          }}
        />
      </Box>
    );
  }

  if (mode === 'confirmReset') {
    const aliasCount = ctx.aliasRepo.all().length;
    const playlistCount = ctx.playlistRepo.all().length;
    // "No" listed first so it's what SelectInput focuses by default — an
    // irreversible action defaults to the safe choice, never the destructive one.
    const items = [
      { label: 'No, cancel', value: 'no' },
      { label: 'Yes, delete everything', value: 'yes' },
    ];
    return (
      <Box flexDirection="column">
        <Text bold color={theme.error}>
          Reset all data?
        </Text>
        <Text color={theme.dim}>
          Permanently deletes {aliasCount} alias{aliasCount === 1 ? '' : 'es'}, {playlistCount} playlist
          {playlistCount === 1 ? '' : 's'}, settings, and the downloaded-audio cache. Cannot be undone.
        </Text>
        <SelectInput
          items={items}
          onSelect={(item) => {
            if (item.value === 'yes') {
              resetAllData({
                aliasRepo: ctx.aliasRepo,
                playlistRepo: ctx.playlistRepo,
                saveSettings: ctx.saveSettings,
                platform: ctx.platform,
              });
              showStatus('All tv data has been reset.', 'success');
            } else {
              showStatus(null);
            }
            setMode('list');
          }}
        />
      </Box>
    );
  }

  if (mode === 'troubleshoot') {
    return (
      <Box flexDirection="column">
        <Text bold color={theme.secondary}>Troubleshoot</Text>
        {diagnostics === null && <Text color={theme.dim}>Running checks...</Text>}
        {diagnostics?.map((check) => (
          <Box flexDirection="column" key={check.name} marginBottom={1}>
            <Text color={STATUS_COLOR[check.status]}>
              {STATUS_ICON[check.status]} {check.name}: {check.message}
            </Text>
            {check.fix && <Text color={theme.dim}> → {check.fix}</Text>}
          </Box>
        ))}
        <SelectInput items={[{ label: '‹ Back', value: '__back__' }]} onSelect={() => setMode('list')} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold color={theme.secondary}>Settings</Text>
      <SelectInput
        items={items}
        onHighlight={() => showStatus(null)}
        onSelect={async (item) => {
          showStatus(null);
          if (item.value === '__back__') return onBack();
          if (item.value === '__troubleshoot__') {
            setMode('troubleshoot');
            setDiagnostics(null);
            runDiagnostics(ctx.platform).then(setDiagnostics);
            return undefined;
          }
          if (item.value === '__resetAll__') {
            setMode('confirmReset');
            return undefined;
          }
          if (item.value === '__export__') {
            try {
              const outputPath = await exportToExcel({
                aliasRepo: ctx.aliasRepo,
                playlistRepo: ctx.playlistRepo,
                resolver: ctx.resolver,
                downloadsDir: ctx.platform.getDownloadsDir(),
              });
              showStatus(`Exported to ${outputPath}`, 'success');
            } catch (err) {
              showStatus(`Export failed: ${err.message}`, 'error');
            }
            return undefined;
          }
          if (item.value === '__about__') {
            try {
              const outputPath = await exportAboutPdf({ downloadsDir: ctx.platform.getDownloadsDir() });
              showStatus(`Saved to ${outputPath}`, 'success');
            } catch (err) {
              showStatus(`Could not save About PDF: ${err.message}`, 'error');
            }
            return undefined;
          }
          setEditing(item.value);
          return undefined;
        }}
      />
      {status && (
        <Text color={STATUS_COLOR[statusLevel]}>
          {STATUS_ICON[statusLevel]} {status}
        </Text>
      )}
    </Box>
  );
}
