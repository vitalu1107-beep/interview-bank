#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { validateBank } from '../assets/core.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const usage = '用法：node scripts/validate.mjs [JSON路径] [--migration 原始JSON路径]';

function parseArgs(args) {
  let bankPath = resolve(projectRoot, 'questions.json');
  let migrationPath;
  let hasBankPath = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--migration') {
      if (migrationPath || !args[i + 1] || args[i + 1].startsWith('--')) {
        throw new Error(usage);
      }
      migrationPath = resolve(args[++i]);
    } else if (arg.startsWith('-') || hasBankPath) {
      throw new Error(usage);
    } else {
      bankPath = resolve(arg);
      hasBankPath = true;
    }
  }
  return { bankPath, migrationPath };
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const sha256 = value => createHash('sha256').update(value).digest('hex');

function categoryOwners(bank) {
  const owners = new Map();
  for (const category of Array.isArray(bank?.taxonomy) ? bank.taxonomy : []) {
    for (const group of Array.isArray(category?.groups) ? category.groups : []) {
      owners.set(group?.id, category?.id);
    }
  }
  return owners;
}

async function main() {
  const { bankPath, migrationPath } = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(await readFile(resolve(projectRoot, 'docs/original-manifest.json'), 'utf8'));
  const bankBytes = await readFile(bankPath);
  const bank = JSON.parse(bankBytes.toString('utf8'));
  const result = validateBank(bank, { requiredIds: manifest.requiredIds });
  const errors = [...result.errors];
  const owners = categoryOwners(bank);
  const items = new Map((Array.isArray(bank?.items) ? bank.items : []).filter(item => item && typeof item === 'object').map(item => [item.id, item]));

  // Retain original IDs and their top-level categories, while allowing answer edits and new records.
  for (const original of manifest.originalItems) {
    const item = items.get(original.id);
    if (item && owners.get(item.navGroup) !== original.category) {
      errors.push(`${original.id} 的原始目录归属必须保留为 ${original.category}`);
    }
  }

  // This explicit local check is for the initial migration only. CI never freezes answer hashes.
  if (migrationPath) {
    const sourceBytes = await readFile(migrationPath);
    const source = JSON.parse(sourceBytes.toString('utf8'));
    if (sha256(sourceBytes) !== manifest.sources.json.sha256) {
      errors.push('原始 JSON 与迁移清单中的源文件 SHA-256 不一致');
    }
    if (!bankBytes.equals(sourceBytes)) errors.push('迁移校验：目标与原始 JSON 字节不同');
    if (!isDeepStrictEqual(bank, source)) errors.push('迁移校验：目标与原始 JSON 的字段、值或数组顺序不同');
    const sourceItems = new Map((Array.isArray(source?.items) ? source.items : []).filter(item => item && typeof item === 'object').map(item => [item.id, item]));
    for (const original of manifest.originalItems) {
      const item = sourceItems.get(original.id);
      if (!item || sha256(canonical(item)) !== original.sha256) {
        errors.push(`迁移校验：原题 ${original.id} 与迁移清单的逐题 SHA-256 不一致`);
      }
    }
  }

  if (errors.length) {
    for (const error of errors) console.error(`✗ ${typeof error === 'string' ? error : JSON.stringify(error)}`);
    process.exitCode = 1;
    return;
  }
  console.log(`校验通过：${result.total} 题；目录数量 ${JSON.stringify(result.counts)}`);
  if (migrationPath) console.log('迁移校验通过：原文件 SHA-256、逐题 SHA-256、全部字段与字节一致。');
}

main().catch(error => {
  console.error(`校验失败：${error.message}`);
  process.exitCode = 1;
});
