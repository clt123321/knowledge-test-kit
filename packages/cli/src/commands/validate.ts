import { parseCommonArgs } from './args.js';
import { log } from '../log.js';
import { loadBank, summarizeBank } from '@knowledge-test/core';

export async function runValidate(argv: string[]): Promise<void> {
  const { content } = parseCommonArgs(argv);
  const bank = await loadBank(content);
  const summary = summarizeBank(bank);

  log.header('knowledge-test validate');
  log.info(`  bank id     : ${summary.bankId}`);
  log.info(`  layout      : ${summary.layout}`);
  log.info(`  content dir : ${bank.contentDir}`);
  log.info(`  config file : ${bank.configPath ?? '(none — inferred defaults)'}`);
  log.info(`  question globs : ${bank.config.content.questionGlobs.join(', ')}`);
  log.info(`  total (raw)  : ${summary.totalRaw}`);
  log.info(`  total (valid): ${summary.totalValid}`);
  log.info(`  by type      : single=${summary.byType.single} multiple=${summary.byType.multiple}`);
  log.info(
    `  by status    : draft=${summary.byStatus.draft} agent=${summary.byStatus.agent_reviewed} human=${summary.byStatus.human_reviewed} deprecated=${summary.byStatus.deprecated}`,
  );

  if (summary.byModule.length > 0) {
    log.info('  by module   :');
    for (const m of summary.byModule.slice(0, 20)) {
      log.info(`    ${m.moduleId.padEnd(40)} ${m.count}`);
    }
    if (summary.byModule.length > 20) log.info(`    …and ${summary.byModule.length - 20} more`);
  }

  if (bank.issues.length === 0) {
    log.ok('no validation issues');
    return;
  }

  log.warn(`${bank.issues.length} validation issue(s):`);
  const byFile = new Map<string, typeof bank.issues>();
  for (const iss of bank.issues) {
    const key = iss.file ?? '(unknown file)';
    const arr = byFile.get(key) ?? [];
    arr.push(iss);
    byFile.set(key, arr);
  }
  for (const [file, issues] of byFile.entries()) {
    log.info(`\n  ${file}`);
    for (const iss of issues.slice(0, 20)) {
      log.info(`    ${iss.path} — ${iss.message}${iss.questionId ? ' [' + iss.questionId + ']' : ''}`);
    }
    if (issues.length > 20) log.info(`    …and ${issues.length - 20} more`);
  }
  process.exitCode = 1;
}
